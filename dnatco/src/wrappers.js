import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Queue, Worker } from "bullmq";

const execFileAsync = promisify(execFile);

export const dnatcoQueueName = "dnatco-jobs";

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

export const dnatcoQueue = new Queue(dnatcoQueueName, {
  connection: redisConnection,
});

export async function enqueueDnatcoJob(data, options) {
  return dnatcoQueue.add("analyze", data, options);
}

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }
  return Boolean(value);
}

function resolveCoordsPath(environmentPath, coordsPath) {
  if (!coordsPath) {
    throw new Error("Missing coordsPath");
  }

  if (path.isAbsolute(coordsPath)) {
    return path.resolve(coordsPath);
  }

  return path.resolve(environmentPath, coordsPath);
}

function ensureWithinEnvironment(environmentPath, targetPath, label) {
  const relative = path.relative(environmentPath, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside environmentPath`);
  }
}

export async function processDnatcoJob(data) {
  const environmentPath = path.resolve(String(data.environmentPath ?? "").trim());
  if (!environmentPath) {
    throw new Error("Missing environmentPath");
  }

  const coordsPath = resolveCoordsPath(environmentPath, String(data.coordsPath ?? "").trim());
  const outputDirName = String(data.outputDirName ?? "dnatco").trim() || "dnatco";
  const outputDir = path.resolve(environmentPath, outputDirName);

  ensureWithinEnvironment(environmentPath, coordsPath, "coordsPath");
  ensureWithinEnvironment(environmentPath, outputDir, "outputDirName");

  await fs.access(coordsPath);
  await fs.mkdir(outputDir, { recursive: true });

  const args = [
    "/opt/dnatco/dnatco/bin/dnatco.js",
    "--coords", coordsPath,
    "--outputDir", outputDir,
  ];

  const requestedFlags = {
    report: toBool(data.report, true),
    reportText: toBool(data.reportText, true),
    ntcCsv: toBool(data.ntcCsv, true),
    ntcJson: toBool(data.ntcJson, true),
    extendedCIF: toBool(data.extendedCIF, false),
    busterRestraints: toBool(data.busterRestraints, false),
    refmacRestraints: toBool(data.refmacRestraints, false),
    cootRestraints: toBool(data.cootRestraints, false),
    phenixRestraints: toBool(data.phenixRestraints, false),
  };

  for (const [flag, enabled] of Object.entries(requestedFlags)) {
    if (enabled) {
      args.push(`--${flag}`);
    }
  }

  if (data.prefix) {
    args.push("--prefix", String(data.prefix));
  }

  console.log("[dnatco] Running:", "node", args.join(" "));

  const { stdout, stderr } = await execFileAsync("node", args, {
    cwd: outputDir,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (stdout?.trim()) {
    console.log(`[dnatco] stdout:\n${stdout}`);
  }
  if (stderr?.trim()) {
    console.log(`[dnatco] stderr:\n${stderr}`);
  }

  const producedFiles = await fs.readdir(outputDir);

  return {
    environmentPath,
    coordsPath,
    outputDir,
    producedFiles,
  };
}

export function createDnatcoWorker(connection = redisConnection) {
  return new Worker(
    dnatcoQueueName,
    async (job) => processDnatcoJob(job.data),
    {
      connection,
      concurrency: Number(process.env.DNATCO_WORKER_CONCURRENCY ?? 1),
    },
  );
}
