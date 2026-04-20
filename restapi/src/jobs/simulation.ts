import fs from "fs/promises";
import type { UUID } from "crypto";
import type { ChainElement, Metadata } from "./types.js";
import { SIM_URL, TOOLS_URL } from "../server.js";
import {
    JOBS_DIR,
    saveMetadata,
    updateModelMetadata,
} from "./utils.js";
import { Queue, Worker } from "bullmq";
import { analyzeStructure } from "./analysis.js";

export const simulationQueue = new Queue("simulation", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

export type SimulationParameters = {
  restraintBackboneForce: number;
  restraintGlobalForce: number;
  restraintBasePairsForce: number;
  rmsdCutoff: number;
};

export function createSimulationWorker() {
  const worker = new Worker<{
    jobID: UUID;
    modelNumber: string;
    environmentPath: string;
    metadata: Metadata;
    simulationParams: SimulationParameters;
  }>(
    "simulation",
    async (job) => {
      const { jobID, modelNumber, environmentPath, metadata, simulationParams } = job.data;
      await performSimulation(jobID, modelNumber, environmentPath, metadata, simulationParams);
      await analyzeSimulationResults(jobID, modelNumber, metadata);
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Simulation job completed: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Simulation job failed: ${job?.id ?? "unknown"}`, error);
  });

  return worker;
}

export async function addSimulationTask(
  jobID: UUID,
  modelNumber: string,
  environmentPath: string,
  metadata: Metadata,
  simulationParams: SimulationParameters
) {
  const queueJobId = `${jobID}_sim_${modelNumber}`;
  const existingJob = await simulationQueue.getJob(queueJobId);
  if (existingJob) {
    await existingJob.remove();
  }

  await simulationQueue.add("run-simulation", {
    jobID,
    modelNumber,
    environmentPath,
    metadata,
    simulationParams,
  }, { jobId: queueJobId });
}

async function performSimulation(
  jobID: UUID,
  modelNumber: string,
  environmentPath: string,
  metadata: Metadata,
  simulationParams: SimulationParameters
) {
  try {
    updateModelMetadata(metadata, modelNumber, "sim_starting");
    await saveMetadata(jobID, metadata);

    // Start simulation in sim service
    const simJobResponse = await fetch(`${SIM_URL}/sim-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        environmentPath: environmentPath,
        modelNumber: modelNumber,
        restraintBackboneForce: simulationParams.restraintBackboneForce,
        restraintGlobalForce: simulationParams.restraintGlobalForce,
        restraintBasePairsForce: simulationParams.restraintBasePairsForce,
        rmsdCutoff: simulationParams.rmsdCutoff,
      }),
    });

    if (!simJobResponse.ok) {
      throw new Error(`Failed to start simulation: ${simJobResponse.statusText}`);
    }

    const simJobData = (await simJobResponse.json()) as {
      jobId: string;
      message: string;
    };

    const simJobId = simJobData.jobId;
    console.log(`Simulation started with ID: ${simJobId}`);

    // Store simulation job ID in metadata
    if (!metadata.simulations) {
      metadata.simulations = {};
    }
    metadata.simulations[modelNumber] = {
      simJobId: simJobId,
      status: "running",
      startedAt: new Date().toISOString(),
    };

    updateModelMetadata(metadata, modelNumber, "sim_running");
    await saveMetadata(jobID, metadata);

    // Poll for simulation completion
    let simCompleted = false;
    let pollCount = 0;
    const maxPolls = 1440; // 24 hours with 60-second intervals
    const pollInterval = 60000; // 60 seconds

    while (!simCompleted && pollCount < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollCount++;

      const statusResponse = await fetch(`${SIM_URL}/sim-jobs/${simJobId}`);

      if (!statusResponse.ok) {
        console.error(`Failed to get simulation status: ${statusResponse.statusText}`);
        continue;
      }

      const statusData = (await statusResponse.json()) as {
        state: string;
        returnvalue?: unknown;
        failedReason?: string;
      };

      const state = statusData.state;

      if (state === "completed") {
        simCompleted = true;
        if (metadata.simulations) {
          metadata.simulations[modelNumber].status = "completed";
          metadata.simulations[modelNumber].completedAt = new Date().toISOString();
        }
        updateModelMetadata(metadata, modelNumber, "sim_finished");
        console.log(`Simulation ${simJobId} completed`);
      } else if (state === "failed") {
        throw new Error(
          `Simulation failed: ${statusData.failedReason || "Unknown error"}`
        );
      }

      await saveMetadata(jobID, metadata);
    }

    if (!simCompleted) {
      throw new Error("Simulation polling timeout - max retries exceeded");
    }

  } catch (error) {
    console.error("Error during simulation:", error);
    updateModelMetadata(
      metadata,
      modelNumber,
      "sim_failed",
      error instanceof Error ? error.message : String(error)
    );
    await saveMetadata(jobID, metadata);
    throw error;
  }
}

export async function fetchSimulationStatus(
  jobID: UUID,
  metadata: Metadata
): Promise<Record<string, unknown>> {
  if (!metadata.simulations) {
    return {};
  }

  const simulationStatuses: Record<string, unknown> = {};

  for (const [modelNumber, simInfo] of Object.entries(metadata.simulations)) {
    try {
      const statusResponse = await fetch(
        `${SIM_URL}/sim-jobs/${simInfo.simJobId}`
      );

      if (!statusResponse.ok) {
        simulationStatuses[modelNumber] = {
          simJobId: simInfo.simJobId,
          status: "unknown",
          error: `Failed to fetch status: ${statusResponse.statusText}`,
        };
        continue;
      }

      const statusData = (await statusResponse.json()) as {
        state: string;
        progress?: unknown;
        returnvalue?: unknown;
        failedReason?: string;
      };
      simulationStatuses[modelNumber] = {
        simJobId: simInfo.simJobId,
        status: statusData.state,
        progress: statusData.progress,
        returnvalue: statusData.returnvalue,
        failedReason: statusData.failedReason,
      };
    } catch (error) {
      simulationStatuses[modelNumber] = {
        simJobId: simInfo.simJobId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return simulationStatuses;
}

async function analyzeSimulationResults(
  jobID: UUID,
  modelNumber: string,
  metadata: Metadata
) {
  const modelsDir = "sim";
  const sourceFormat = "pdb";
  const radius = 5;
  const interval = 1;
  const analyzeSphereFilesEnabled = Boolean(metadata.analyzeNeighborhoods);

  try {
    updateModelMetadata(metadata, modelNumber, "sim_analyzing");
    metadata.status = "simulation_running";
    await saveMetadata(jobID, metadata);

    const selectedResiduesPath = `${JOBS_DIR}/${jobID}/models/${modelNumber}_residues.json`;
    const selectedResiduesRaw = await fs.readFile(selectedResiduesPath, "utf-8");
    const selectedResidues = JSON.parse(selectedResiduesRaw) as ChainElement[];

    if (!Array.isArray(selectedResidues) || selectedResidues.length === 0) {
      throw new Error(`Selected residues are missing for model ${modelNumber}`);
    }

    const simulatedPdbPath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_sim.pdb`;
    const analysisPdbPath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}.pdb`;
    await fs.copyFile(simulatedPdbPath, analysisPdbPath);

    const annotateResponse = await fetch(
      `${TOOLS_URL}/annotate?id=${jobID}&numberOfModels=1&sourceFormat=${sourceFormat}&modelsDir=${modelsDir}`,
      {
        method: "POST",
      }
    );

    if (!annotateResponse.ok) {
      throw new Error(`Annotation failed: ${annotateResponse.statusText}`);
    }

    const motifsResponse = await fetch(
      `${TOOLS_URL}/extractMotifs?id=${jobID}&numberOfModels=1&modelsDir=${modelsDir}`,
      {
        method: "POST",
      }
    );

    if (!motifsResponse.ok) {
      throw new Error(`Motif extraction failed: ${motifsResponse.statusText}`);
    }

    await analyzeStructure(
      jobID,
      modelNumber,
      selectedResidues,
      radius,
      interval,
      metadata,
      analyzeSphereFilesEnabled,
      modelsDir,
      false
    );

    updateModelMetadata(metadata, modelNumber, "sim_completed");
    metadata.status = "simulation_completed";
    await saveMetadata(jobID, metadata);
  } catch (error) {
    updateModelMetadata(
      metadata,
      modelNumber,
      "sim_failed",
      error instanceof Error ? error.message : String(error)
    );
    metadata.status = "simulation_failed";
    metadata.error_message = error instanceof Error ? error.message : String(error);
    await saveMetadata(jobID, metadata);
    throw error;
  }
}
