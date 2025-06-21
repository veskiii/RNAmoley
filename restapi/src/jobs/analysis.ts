import fs from "fs/promises";
import type { UUID } from "crypto";
import type {
  Metadata,
  metrics,
  Analysis_results,
  nucleotideResult,
  residueMetrics,
} from "./types.js";
import { MOLPROBITY_URL, TOOLS_URL } from "../server.js";
import {
    JOBS_DIR,
    saveMetadata,
    saveResults,
} from "./utils.js";
import { Queue, Worker } from "bullmq";

export const analysisQueue = new Queue("analysis", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

export function createAnalysisWorker() {
  const worker = new Worker<{
    jobID: UUID;
    modelNumber: string;
    radius: number;
    interval: number;
    metadata: Metadata;
  }>(
    "analysis",
    async (job) => {
      const { jobID, modelNumber, radius, interval, metadata } = job.data;
      await performAnalysis(jobID, modelNumber, radius, interval, metadata);
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      concurrency: 1,
    }
  );

  return worker;
}

export async function addAnalysisTask(
  jobID: UUID,
  modelNumber: string,
  radius: number,
  interval: number,
  metadata: Metadata
) {
  await analysisQueue.add("analyze-structure", {
    jobID,
    modelNumber,
    radius,
    interval,
    metadata,
  }, {jobId: jobID});
}
  

async function performAnalysis(
  jobID: UUID,
  modelNumber: string,
  radius: number,
  interval: number,
  metadata: Metadata
) {
  try {
    const analysisOutput = await analyzeStructureWalkingSphere(
      jobID,
      modelNumber,
      radius,
      interval,
      metadata
    );

    if (!analysisOutput) {
      throw new Error("Analysis output is empty or undefined");
    }

    // save the result as json file
    await saveResults(jobID, analysisOutput);
    metadata.status = "completed";
    metadata.last_used_model = parseInt(modelNumber);
    await saveMetadata(jobID, metadata);

  } catch (error) {
    console.error("Error during analysis:", error);
    metadata.status = "failed";
    metadata.error_message = error instanceof Error ? error.message : String(error);
    await saveMetadata(jobID, metadata);
  }
}

export async function analyzeStructureWalkingSphere(
  jobID: UUID,
  modelNumber: string,
  radius: number,
  interval: number,
  metadata: Metadata
): Promise<Analysis_results> {
  metadata.status = "running";
  await saveMetadata(jobID, metadata);

  await createWalkingSphere(jobID, modelNumber, radius, interval);

  const residueAnalysisArray = await fetchResidueAnalysis(jobID);

  const files = await fs.readdir(`${JOBS_DIR}/${jobID}/sphere`);
  const results = await analyzeSphereFiles(
    files,
    jobID,
    residueAnalysisArray
  );

  const result: Analysis_results = {
    mode: "full",
    data: results,
  };

  return result;
}

async function createWalkingSphere(
  jobID: UUID,
  modelNumber: string,
  radius: number,
  interval: number
) {
  const walkingSphere = await fetch(
    `${TOOLS_URL}/sphere?id=${jobID}&modelNumber=${modelNumber}&radius=${radius}&interval=${interval}`,
    { method: "POST" }
  );
  if (!walkingSphere.ok) {
    throw new Error("Sphere error: " + walkingSphere.statusText);
  }
}

async function fetchResidueAnalysis(
  jobID: UUID
): Promise<residueMetrics[]> {
  const residueAnalysis = await fetch(
    `${MOLPROBITY_URL}/residue-analysis?filename=/${jobID}/models/1.pdb`,
    { keepalive: true }
  );
  if (!residueAnalysis.ok) {
    throw new Error("Residue analysis error: " + residueAnalysis.statusText);
  }
  return (await residueAnalysis.json()) as residueMetrics[];
}

async function analyzeSphereFiles(
  files: string[],
  jobID: UUID,
  residueAnalysisArray: residueMetrics[]
): Promise<nucleotideResult[]> {
  const promises = files.map((file) => async () => {
    try {
      const res = await fetch(
        `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/sphere/${file}`,
        { keepalive: true }
      );

      if (!res.ok) {
        throw new Error(`Error analyzing file ${file}: ${res.statusText}`);
      }

      const tmpMetrics: metrics = (await res.json()) as metrics;
      const nucleotideNumber = parseInt(file.split(".")[0] ?? "");
      const residueMetrics = findResidueInResidueAnalysis(
        residueAnalysisArray,
        nucleotideNumber
      );

      return {
        residue_number: nucleotideNumber,
        metrics: tmpMetrics,
        residueMetrics: residueMetrics,
      } as nucleotideResult;
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
      return null;
    }
  });

  const promisesResults = await processInBatches(promises, 10);

  const results = promisesResults
    .filter(
      (p): p is PromiseFulfilledResult<nucleotideResult> =>
        p.status === "fulfilled"
    )
    .map((p) => p.value)
    .filter((result) => result !== null);

  results.sort((a, b) => a.residue_number - b.residue_number);

  return results;
}

const findResidueInResidueAnalysis = (
  residues: residueMetrics[],
  residueNumber: number
): residueMetrics | undefined => {
  return residues.find((residue) => {
    const match = residue.residue.match(/\s+(\d+)\s+/);
    return match ? Number(match[1]) === residueNumber : false;
  });
};

const processInBatches = async (
  tasks: (() => Promise<any>)[],
  batchSize: number
) => {
  let results: any[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((task) => task());
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  return results;
};