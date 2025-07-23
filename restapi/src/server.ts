import express from "express";
import type { Express, Request, Response } from "express";
import runDbMigrations from "./db/migrations/index.js";
import { router as jobRoutes } from "./jobs/routes.js";
import { cleanUpJobs } from "./jobs/controller.js";
import cors from "cors";
import { createAnalysisWorker } from "./jobs/analysis.js";
import { createJobCreationWorker } from "./jobs/jobCreation.js";

const app = express();
app.use(express.json());

// expose public folder
app.use(express.static("public"));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || "localhost";

export const TOOLS_URL = process.env.TOOLS_URL
  ? process.env.TOOLS_URL
  : "http://tools:3002";
export const MOLPROBITY_URL = process.env.MOLPROBITY_URL
  ? process.env.MOLPROBITY_URL
  : "http://molprobity:3001";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS"],
    allowedHeaders: "*",
  })
);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World! Rest API is running");
});

app.use("/v1/jobs", jobRoutes);

await runDbMigrations();

// Clean up jobs
console.log("Cleaning up jobs...");
cleanUpJobs();
setInterval(() => {
  console.log("Cleaning up jobs...");
  cleanUpJobs();
}, 1000 * 60 * 60 * 24);

createJobCreationWorker();
createAnalysisWorker();

app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
