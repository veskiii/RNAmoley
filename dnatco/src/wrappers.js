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

async function cleanPdbElementSymbols(pdbPath, outputPath) {
  const content = await fs.readFile(pdbPath, "utf-8");
  const lines = content.split("\n");

  const cleanedLines = lines.map((line) => {
    if ((line.startsWith("ATOM") || line.startsWith("HETATM")) && line.length >= 76) {
      // Kolumny PDB: element 77-78, charge 79-80. Czyścimy do neutralnego symbolu (np. O1+ -> O)
      const beforeElement = line.substring(0, 76);
      const tail = line.substring(76);
      const match = tail.match(/\s*([A-Za-z]{1,2})\s*\d*[+-]?/);
      const cleanElement = (match?.[1] ?? "").slice(0, 2).toUpperCase();
      const formattedElement = cleanElement.padStart(2, " ");

      // Zachowaj długość i wyzeruj pole charge.
      const afterCharge = line.length > 80 ? line.substring(80) : "";
      return `${beforeElement}${formattedElement}  ${afterCharge}`;
    }
    return line;
  });

  const cleanedContent = cleanedLines.join("\n");
  await fs.writeFile(outputPath, cleanedContent);
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

  // Użyj stabilnej nazwy wejściowej, żeby DNATCO nie wyprowadzał prefiksu z oryginalnej nazwy pliku.
  const cleanedCoordsPath = path.join(outputDir, "custom.pdb");
  await cleanPdbElementSymbols(coordsPath, cleanedCoordsPath);

  const outputPrefix = String(data.prefix ?? "custom").trim() || "custom";

  const args = [
    "/opt/dnatco/dnatco/bin/dnatco.js",
    "--coords", cleanedCoordsPath,
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

  args.push("--prefix", outputPrefix);

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

  let producedFiles = await fs.readdir(outputDir);

  // Fallback: jeśli DNATCO mimo --prefix użyje innego prefiksu, przepnij wyniki na oczekiwany.
  const maybePrimaryCsv = producedFiles.find((name) => name.endsWith("_assigned_ntcs.csv"));
  if (maybePrimaryCsv && !maybePrimaryCsv.startsWith(`${outputPrefix}_`)) {
    const fromPrefix = maybePrimaryCsv.replace(/_assigned_ntcs\.csv$/, "");
    const renamedFiles = [];

    for (const fileName of producedFiles) {
      if (fileName.startsWith(`${fromPrefix}_`)) {
        const targetName = `${outputPrefix}_${fileName.slice(fromPrefix.length + 1)}`;
        await fs.rename(path.join(outputDir, fileName), path.join(outputDir, targetName));
        renamedFiles.push(targetName);
      } else {
        renamedFiles.push(fileName);
      }
    }

    producedFiles = renamedFiles;
  }

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
