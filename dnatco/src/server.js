import express from "express";
import { createDnatcoWorker, dnatcoQueue, enqueueDnatcoJob } from "./wrappers.js";

const app = express();
const port = 3001;
const dnatcoWorker = createDnatcoWorker();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("DNATCO service is running");
});

app.post("/dnatco-jobs", async (req, res) => {
  const { environmentPath, coordsPath } = req.body ?? {};

  if (!environmentPath || !coordsPath) {
    res.status(400).json({
      error: "Missing required fields: environmentPath, coordsPath",
    });
    return;
  }

  try {
    const job = await enqueueDnatcoJob({
      environmentPath: String(environmentPath),
      coordsPath: String(coordsPath),
      outputDirName: req.body?.outputDirName,
      prefix: req.body?.prefix,
      report: req.body?.report,
      reportText: req.body?.reportText,
      ntcCsv: req.body?.ntcCsv,
      ntcJson: req.body?.ntcJson,
      extendedCIF: req.body?.extendedCIF,
      busterRestraints: req.body?.busterRestraints,
      refmacRestraints: req.body?.refmacRestraints,
      cootRestraints: req.body?.cootRestraints,
      phenixRestraints: req.body?.phenixRestraints,
    });

    res.status(202).json({
      message: "DNATCO job accepted",
      jobId: job.id,
      queue: job.queueName,
      name: job.name,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: details });
  }
});

app.get("/dnatco-jobs/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();

  if (!id) {
    res.status(400).json({ error: "Missing job id" });
    return;
  }

  try {
    const job = await dnatcoQueue.getJob(id);

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

dnatcoWorker.on("ready", () => {
  console.log("DNATCO worker is ready.");
});

dnatcoWorker.on("active", (job) => {
  console.log(`DNATCO job active: ${job.id}`);
});

dnatcoWorker.on("completed", (job, result) => {
  console.log(`DNATCO job completed: ${job.id}`, result);
});

dnatcoWorker.on("failed", (job, error) => {
  console.error(`DNATCO job failed: ${job?.id ?? "unknown"}`, error);
});

async function shutdown() {
  console.log("Shutting down DNATCO service and worker...");
  await dnatcoWorker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

app.listen(port, () => {
  console.log(`DNATCO server started at http://localhost:${port}`);
});
