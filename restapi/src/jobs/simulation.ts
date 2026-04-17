import type { UUID } from "crypto";
import type { Metadata } from "./types.js";
import { SIM_URL } from "../server.js";
import {
    JOBS_DIR,
    saveMetadata,
    updateModelMetadata,
} from "./utils.js";
import { Queue, Worker } from "bullmq";

export const simulationQueue = new Queue("simulation", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

export function createSimulationWorker() {
  const worker = new Worker<{
    jobID: UUID;
    modelNumber: string;
    environmentPath: string;
    metadata: Metadata;
  }>(
    "simulation",
    async (job) => {
      const { jobID, modelNumber, environmentPath, metadata } = job.data;
      await performSimulation(jobID, modelNumber, environmentPath, metadata);
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
  metadata: Metadata
) {
  await simulationQueue.add("run-simulation", {
    jobID,
    modelNumber,
    environmentPath,
    metadata,
  }, { jobId: `${jobID}_sim_${modelNumber}` });
}

async function performSimulation(
  jobID: UUID,
  modelNumber: string,
  environmentPath: string,
  metadata: Metadata
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
        updateModelMetadata(metadata, modelNumber, "sim_completed");
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
