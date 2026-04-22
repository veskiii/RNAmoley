import express from "express";
import { createSimWorker, enqueueSimJob, simQueue } from "./wrappers.js";

const app = express();
const port = 3001;
const simWorker = createSimWorker();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/sim-jobs", async (req, res) => {
  const {
    environmentPath,
    modelNumber,
    restraintBackboneForce,
    restraintGlobalForce,
    restraintBasePairsForce,
    rmsdCutoff,
  } = req.body ?? {};

  if (
    !environmentPath
    || !modelNumber
    || restraintBackboneForce === undefined
    || restraintGlobalForce === undefined
    || restraintBasePairsForce === undefined
    || rmsdCutoff === undefined
  ) {
    res.status(400).json({
      error: "Missing required fields: environmentPath, modelNumber, restraintBackboneForce, restraintGlobalForce, restraintBasePairsForce, rmsdCutoff",
    });
    return;
  }

  const parsedRestraintBackboneForce = Number(restraintBackboneForce);
  const parsedRestraintGlobalForce = Number(restraintGlobalForce);
  const parsedRestraintBasePairsForce = Number(restraintBasePairsForce);
  const parsedRmsdCutoff = Number(rmsdCutoff);

  const numericParams: Array<[string, number]> = [
    ["restraintBackboneForce", parsedRestraintBackboneForce],
    ["restraintGlobalForce", parsedRestraintGlobalForce],
    ["restraintBasePairsForce", parsedRestraintBasePairsForce],
    ["rmsdCutoff", parsedRmsdCutoff],
  ];

  for (const [name, value] of numericParams) {
    if (!Number.isFinite(value)) {
      res.status(422).json({ error: `Invalid ${name}` });
      return;
    }
  }

  console.log("[sim-api] Accepted simulation start request:", {
    environmentPath: String(environmentPath),
    modelNumber: String(modelNumber),
    restraintBackboneForce: parsedRestraintBackboneForce,
    restraintGlobalForce: parsedRestraintGlobalForce,
    restraintBasePairsForce: parsedRestraintBasePairsForce,
    rmsdCutoff: parsedRmsdCutoff,
  });

  try {
    const job = await enqueueSimJob({
      environmentPath: String(environmentPath),
      modelNumber: String(modelNumber),
      restraintBackboneForce: parsedRestraintBackboneForce,
      restraintGlobalForce: parsedRestraintGlobalForce,
      restraintBasePairsForce: parsedRestraintBasePairsForce,
      rmsdCutoff: parsedRmsdCutoff,
    });

    res.status(202).json({
      message: "Simulation job accepted",
      jobId: job.id,
      queue: job.queueName,
      name: job.name,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: details });
  }
});

app.get("/sim-jobs/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();

  if (!id) {
    res.status(400).json({ error: "Missing job id" });
    return;
  }

  try {
    const job = await simQueue.getJob(id);

    if (!job) {
      res.status(404).json({ error: `Job ${id} not found` });
      return;
    }

    const state = await job.getState();

    res.json({
      id: job.id,
      name: job.name,
      state,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: details });
  }
});

simWorker.on("ready", () => {
  console.log("Sim worker is ready.");
});

simWorker.on("active", (job) => {
  console.log(`Sim job active: ${job.id}`);
});

simWorker.on("completed", (job, result) => {
  console.log(`Sim job completed: ${job.id}`, result);
});

simWorker.on("failed", (job, error) => {
  console.error(`Sim job failed: ${job?.id ?? "unknown"}`, error);
});

async function shutdown() {
  console.log("Shutting down server and worker...");
  await simWorker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});


app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
