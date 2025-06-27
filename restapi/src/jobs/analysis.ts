import fs from "fs/promises";
import type { UUID } from "crypto";
import type {
  Metadata,
  metrics,
  Analysis_results,
  nucleotideResult,
  residueMetrics,
  ChainElement,
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
    residues: ChainElement[];
    radius: number;
    interval: number;
    metadata: Metadata;
  }>(
    "analysis",
    async (job) => {
      const { jobID, modelNumber, residues, radius, interval, metadata } = job.data;
      await performAnalysis(jobID, modelNumber, residues, radius, interval, metadata);
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
  residues: ChainElement[],
  radius: number,
  interval: number,
  metadata: Metadata
) {
  await analysisQueue.add("analyze-structure", {
    jobID,
    modelNumber,
    residues,
    radius,
    interval,
    metadata,
  }, {jobId: jobID});
}
  

async function performAnalysis(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  radius: number,
  interval: number,
  metadata: Metadata
) {
  try {
    const analyzeSphereFilesEnabled = (radius < 0 || interval < 0) ? false : true;

    const analysisOutput = await analyzeStructure(
      jobID,
      modelNumber,
      residues,
      radius,
      interval,
      metadata,
      analyzeSphereFilesEnabled
    );

    if (!analysisOutput) {
      throw new Error("Analysis output is empty or undefined");
    }

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

export async function analyzeStructure(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  radius: number,
  interval: number,
  metadata: Metadata,
  analyzeSphereFilesEnabled: boolean
): Promise<Analysis_results> {
  metadata.status = "running";
  await saveMetadata(jobID, metadata);

  const oneLineAnalysis = await fetchOneLineAnalysis(jobID, modelNumber);
  const residueAnalysisArray = await fetchResidueAnalysis(jobID, modelNumber);

  const initialData: nucleotideResult[] = residueAnalysisArray.map((res) => ({
    residue_number: extractResidueNumber(res.residue),
    residueMetrics: res,
  }));

  await saveResults(jobID, {
    // mode: analyzeSphereFilesEnabled ? "full" : "fragment",
    data: initialData,
    modelMetrics: oneLineAnalysis,
  });

  if (!analyzeSphereFilesEnabled) {
    return {
      // mode: "fragment",
      data: initialData,
      modelMetrics: oneLineAnalysis,
    };
  }

  await createWalkingSphere(jobID, modelNumber, residues, radius, interval);

  const files = await fs.readdir(`${JOBS_DIR}/${jobID}/sphere`);
  const results = await analyzeSphereFilesIncremental(
    files,
    jobID,
    residueAnalysisArray,
    initialData,
    oneLineAnalysis
  );

  return {
    // mode: "full",
    data: results,
    modelMetrics: oneLineAnalysis,
  };
}

async function analyzeSphereFilesIncremental(
  files: string[],
  jobID: UUID,
  residueAnalysisArray: residueMetrics[],
  initialData: nucleotideResult[],
  modelMetrics: metrics
): Promise<nucleotideResult[]> {
  const resultMap = new Map<number, nucleotideResult>();
  initialData.forEach((res) => resultMap.set(res.residue_number, { ...res }));

  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batchFiles = files.slice(i, i + batchSize);
    const batchTasks = batchFiles.map((file) => async () => {
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

    const batchResults = await Promise.allSettled(batchTasks.map((t) => t()));
    const fulfilled = batchResults
      .filter(
        (p): p is PromiseFulfilledResult<nucleotideResult> =>
          p.status === "fulfilled"
      )
      .map((p) => p.value)
      .filter((result) => result !== null) as nucleotideResult[];

    for (const res of fulfilled) {
      if (res) {
        resultMap.set(res.residue_number, res);
      }
    }

    const sortedResults = Array.from(resultMap.values()).sort(
      (a, b) => a.residue_number - b.residue_number
    );
    await saveResults(jobID, {
      // mode: "full",
      data: sortedResults,
      modelMetrics,
    });
  }

  return Array.from(resultMap.values()).sort(
    (a, b) => a.residue_number - b.residue_number
  );
}

function extractResidueNumber(residue: string): number {
  const match = residue.match(/\s+(\d+)\s+/);
  return match ? Number(match[1]) : -1;
}

async function createWalkingSphere(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  radius: number,
  interval: number
) {

  // save residues to a file
  const residuesFilePath = `${JOBS_DIR}/${jobID}/models/${modelNumber}_residues.json`;
  await fs.writeFile(residuesFilePath, JSON.stringify(residues, null, 2));

  const walkingSphere = await fetch(
    `${TOOLS_URL}/sphere?id=${jobID}&modelNumber=${modelNumber}&radius=${radius}&interval=${interval}`,
    { method: "POST" }
  );
  if (!walkingSphere.ok) {
    throw new Error("Sphere error: " + walkingSphere.statusText);
  }
}

async function fetchResidueAnalysis(
  jobID: UUID,
  modelNumber: string
): Promise<residueMetrics[]> {
  const residueAnalysis = await fetch(
    `${MOLPROBITY_URL}/residue-analysis?filename=/${jobID}/models/${modelNumber}.pdb`,
    { keepalive: true }
  );
  if (!residueAnalysis.ok) {
    throw new Error("Residue analysis error: " + residueAnalysis.statusText);
  }
  return (await residueAnalysis.json()) as residueMetrics[];
}

async function fetchOneLineAnalysis(
  jobID: UUID,
  modelNumber: string
): Promise<metrics> {
  const response = await fetch(
    `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/models/${modelNumber}.pdb`,
    { keepalive: true }
  );
  if (!response.ok) {
    throw new Error("One-line analysis error: " + response.statusText);
  }
  return (await response.json()) as metrics;
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
