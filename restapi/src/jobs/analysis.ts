import fs from "fs/promises";
import type { UUID } from "crypto";
import { join } from "path";
import type {
  Metadata,
  metrics,
  Analysis_results,
  nucleotideResult,
  residueMetrics,
  ChainElement,
  Annotation,
  StructuralElement,
  Numeration,
  NumerationItem,
  ClashscoreParsedResult,
  GeoResidueSummary,
} from "./types.js";
import { MOLPROBITY_URL, TOOLS_URL } from "../server.js";
import http from "http";
import https from "https";
import {
    JOBS_DIR,
    DEMO_FILES_DIR,
    saveMetadata,
    saveResults,
    fetchJSONFile,
    updateModelMetadata,
} from "./utils.js";
import { Queue, Worker } from "bullmq";

const PRE_CALCULATED_RESULTS: Record<string, { filename: string; radius: number; interval: number; selection: string }> = {
  "Example 1": {"filename" : "example_1.json", "radius": 5, "interval": 1, "selection": "(1:A:1-90)"},
  "Example 2": {"filename" : "example_2.json", "radius": 5, "interval": 1, "selection": "(1:A:11-36)"},
  "Example 3": {"filename" : "example_3.json", "radius": 5, "interval": 1, "selection": "(1:A:8-12),(1:A:44-49)"},
  "Example 4": {"filename" : "example_4.json", "radius": 5, "interval": 1, "selection": "(1:A:42-83)"},
  "Example 5": {"filename" : "example_5.json", "radius": 8, "interval": 1, "selection": "(1:A:1-39),(1:A:83-90)"},
  "Example 6": {"filename" : "example_6_<model_number>.json", "radius": 5, "interval": 1, "selection": "(1:0:1-30),(3:0:1-30),(5:0:1-30)"},
}

function normalizeSelection(selection: string) {
  return selection.replace(/\s+/g, "");
}

function createAnalysisLogger(jobID: UUID, modelNumber: string) {
  const logFilePath = `${JOBS_DIR}/${jobID}/${modelNumber}_analysis.log`;

  function record(message: string) {
    const line = `${new Date().toISOString()} [Job ${jobID}, Model ${modelNumber}] ${message}`;
    // append immediately so background coordinators also persist logs
    void fs.appendFile(logFilePath, `${line}\n`).catch((err) => {
      console.error(`[AnalysisLogger] failed to append to ${logFilePath}:`, err);
    });
    console.info(line);
  }

  // flush is now a no-op because records are appended immediately
  async function flush() {
    return;
  }

  return { record, flush };
}

function logStepDuration(
  record: (message: string) => void,
  stepName: string,
  startedAt: number
) {
  const durationMs = Date.now() - startedAt;
  record(`${stepName} took ${durationMs}ms`);
}

async function hasPreCalculatedDemoFiles(
  demoResult: { filename: string; radius: number; interval: number; selection: string }
): Promise<boolean> {
  const placeholder = "<model_number>";

  if (!demoResult.filename.includes(placeholder)) {
    try {
      await fs.access(join(DEMO_FILES_DIR, demoResult.filename));
      return true;
    } catch {
      return false;
    }
  }

  const [prefix = "", suffix = ""] = demoResult.filename.split(placeholder);
  const demoFiles = await fs.readdir(DEMO_FILES_DIR);
  return demoFiles.some((fileName) => fileName.startsWith(prefix) && fileName.endsWith(suffix));
}

function buildSelectionSignature(models: Record<number, ChainElement[]>) {
  const modelKeys = Object.keys(models)
    .map((modelKey) => Number(modelKey))
    .filter((modelKey) => Number.isFinite(modelKey))
    .sort((left, right) => left - right);

  if (modelKeys.length === 0) {
    console.info("[PreCalculatedDemo] buildSelectionSignature skipped: no model keys provided");
    return null;
  }

  const selectionParts: string[] = [];

  modelKeys.forEach((modelKey) => {
    const residues = models[modelKey] || [];
    if (residues.length === 0) {
      return;
    }

    const chainIds = [...new Set(residues.map((residue) => residue.chainID).filter(Boolean))].sort();

    chainIds.forEach((chainID) => {
      const residueIds = residues
        .filter((residue) => residue.chainID === chainID)
        .map((residue) => residue.residueID)
        .filter((residueID): residueID is number => Number.isInteger(residueID))
        .sort((left, right) => left - right);

      if (residueIds.length === 0) {
        return;
      }

      const uniqueResidueIds = Array.from(new Set(residueIds));
      const firstResidueID = uniqueResidueIds[0];
      if (firstResidueID === undefined) {
        return;
      }

      let rangeStart = firstResidueID;
      let previousResidueID = firstResidueID;

      for (let index = 1; index < uniqueResidueIds.length; index++) {
        const residueID = uniqueResidueIds[index];
        if (residueID === undefined) {
          return;
        }
        if (residueID === previousResidueID + 1) {
          previousResidueID = residueID;
          continue;
        }

        selectionParts.push(`(${modelKey}:${chainID}:${rangeStart}-${previousResidueID})`);
        rangeStart = residueID;
        previousResidueID = residueID;
      }

      selectionParts.push(`(${modelKey}:${chainID}:${rangeStart}-${previousResidueID})`);
    });
  });

  if (selectionParts.length === 0) {
    console.info("[PreCalculatedDemo] buildSelectionSignature produced no selection parts");
    return null;
  }

  return selectionParts.join(",");
}

export async function getPreCalculatedDemoResult(
  jobName: string,
  radius: number,
  interval: number,
  models: Record<number, ChainElement[]>
) {
  console.info(
    `[PreCalculatedDemo] Checking job="${jobName}" radius=${Number(radius)} interval=${Number(interval)} modelKeys=${Object.keys(models).join(",")}`
  );

  const demoResult = PRE_CALCULATED_RESULTS[jobName];
  if (!demoResult) {
    console.info(`[PreCalculatedDemo] No configured demo result for job="${jobName}"`);
    return null;
  }

  const demoFilesExist = await hasPreCalculatedDemoFiles(demoResult);
  if (!demoFilesExist) {
    console.info(
      `[PreCalculatedDemo] Demo result file does not exist for job="${jobName}": pattern="${demoResult.filename}"`
    );
    return null;
  }

  const selectedResiduesSelection = buildSelectionSignature(models);
  if (!selectedResiduesSelection) {
    console.info(
      `[PreCalculatedDemo] Selection signature could not be built for job="${jobName}". This usually means model count is not supported by current matcher.`
    );
    return null;
  }

  const normalizedSelected = normalizeSelection(selectedResiduesSelection);
  const normalizedExpected = normalizeSelection(demoResult.selection);
  const radiusMatches = Number(radius) === demoResult.radius;
  const intervalMatches = Number(interval) === demoResult.interval;
  const selectionMatches = normalizedSelected === normalizedExpected;

  console.info(
    `[PreCalculatedDemo] Match details for job="${jobName}": radiusMatches=${radiusMatches}, intervalMatches=${intervalMatches}, selectionMatches=${selectionMatches}`
  );
  if (!selectionMatches) {
    console.info(
      `[PreCalculatedDemo] Selection mismatch: expected="${demoResult.selection}" got="${selectedResiduesSelection}"`
    );
  }

  if (
    !radiusMatches ||
    !intervalMatches ||
    !selectionMatches
  ) {
    console.info(`[PreCalculatedDemo] Demo result rejected for job="${jobName}"`);
    return null;
  }

  console.info(
    `[PreCalculatedDemo] Demo result accepted for job="${jobName}" using file pattern "${demoResult.filename}"`
  );
  return demoResult;
}

export async function applyPreCalculatedDemoResult(
  jobID: UUID,
  metadata: Metadata,
  demoResult: { filename: string; radius: number; interval: number; selection: string }
): Promise<Analysis_results> {
  const placeholder = "<model_number>";
  const hasModelPlaceholder = demoResult.filename.includes(placeholder);
  const demoFiles = await fs.readdir(DEMO_FILES_DIR);
  const analysisResults: Analysis_results[] = [];

  console.info(
    `[PreCalculatedDemo] Applying demo results for job=${jobID}. filenamePattern="${demoResult.filename}" hasModelPlaceholder=${hasModelPlaceholder}`
  );

  const filesToCopy = hasModelPlaceholder
    ? demoFiles.filter((fileName) => {
        const prefix = demoResult.filename.split(placeholder)[0] ?? "";
        const suffix = demoResult.filename.split(placeholder)[1] ?? "";
        return fileName.startsWith(prefix) && fileName.endsWith(suffix);
      })
    : [demoResult.filename];

  if (filesToCopy.length === 0) {
    throw new Error(`No demo files found for ${demoResult.filename}`);
  }

  console.info(
    `[PreCalculatedDemo] Files selected for copy: ${filesToCopy.join(", ")}`
  );

  for (const fileName of filesToCopy) {
    const sourceFilePath = join(DEMO_FILES_DIR, fileName);
    const modelNumber = hasModelPlaceholder
      ? fileName.slice(
          demoResult.filename.split(placeholder)[0]?.length ?? 0,
          fileName.length - (demoResult.filename.split(placeholder)[1]?.length ?? 0)
        )
      : "1";

    const destinationFilePath = join(JOBS_DIR, jobID, `${modelNumber}_results.json`);
    await fs.copyFile(sourceFilePath, destinationFilePath);
    console.info(
      `[PreCalculatedDemo] Copied ${fileName} -> ${modelNumber}_results.json for job=${jobID}`
    );

    const analysisResult = JSON.parse(await fs.readFile(sourceFilePath, "utf-8")) as Analysis_results;
    analysisResults.push(analysisResult);

    if (!metadata.resultsStatus) {
      metadata.resultsStatus = {};
    }
    metadata.resultsStatus[modelNumber] = {
      modelNumber,
      status: "completed",
      error_message: undefined,
      chains: metadata.resultsStatus[modelNumber]?.chains || [],
      selectedFragments: metadata.resultsStatus[modelNumber]?.selectedFragments || {},
    };
  }

  // Ensure metadata reflects that the demo results are completed
  if (!metadata.resultsStatus) {
    metadata.resultsStatus = {};
  }

  metadata.status = "completed";
  await saveMetadata(jobID, metadata);
  console.info(`[PreCalculatedDemo] Metadata marked as completed for job=${jobID}`);

  const firstAnalysisResult = analysisResults[0];
  if (!firstAnalysisResult) {
    throw new Error(`No analysis result could be loaded for ${demoResult.filename}`);
  }

  return firstAnalysisResult;
}

export const analysisQueue = new Queue("analysis", {
  connection: {
    host: process.env.REDIS_HOST ?? "redis",
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

// Use explicit per-request agents to avoid connection reuse causing sticky routing
const defaultHttpAgent = new http.Agent({ keepAlive: false });
const defaultHttpsAgent = new https.Agent({ keepAlive: false });
function getAgentForUrl(url: string | URL) {
  try {
    const protocol = typeof url === "string" ? new URL(url).protocol : url.protocol;
    return protocol === "https:" ? defaultHttpsAgent : defaultHttpAgent;
  } catch {
    return undefined;
  }
}

export function createAnalysisWorker() {
  const worker = new Worker<{
    jobID: UUID;
    models: Record<number, ChainElement[]>;
    radius: number;
    interval: number;
    metadata: Metadata;
    analyzeSphereFilesEnabled: boolean;
    modelsDir?: string;
  }>(
    "analysis",
    async (job) => {
      const { jobID, models, radius, interval, metadata, analyzeSphereFilesEnabled, modelsDir = "models" } = job.data;

      for (const [modelNumber, residues] of Object.entries(models)) {
        await performAnalysis(jobID, modelNumber, residues, radius, interval, metadata, analyzeSphereFilesEnabled, modelsDir);
      }

      const allFailed = Object.values(metadata.resultsStatus || {}).every(
        (status) => status.status === "failed"
      );
      if (allFailed) {
        metadata.status = "failed";
      } else { 
        metadata.status = "completed";
      }
      await saveMetadata(jobID, metadata);
    },
    {
      connection: {
        host: process.env.REDIS_HOST ?? "redis",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
      concurrency: 1,
    }
  );

  return worker;
}

export async function addAnalysisTask(
  jobID: UUID,
  models: Record<number, ChainElement[]>,
  radius: number,
  interval: number,
  metadata: Metadata,
  analyzeSphereFilesEnabled: boolean,
  modelsDir = "models"
) {
  await analysisQueue.add("analyze-structure", {
    jobID,
    models,
    radius,
    interval,
    metadata,
    analyzeSphereFilesEnabled,
    modelsDir,
  }, {jobId: jobID});
}
  

async function performAnalysis(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  radius: number,
  interval: number,
  metadata: Metadata,
  analyzeSphereFilesEnabled: boolean,
  modelsDir = "models"
) {
  try {
    const analysisOutput = await analyzeStructure(
      jobID,
      modelNumber,
      residues,
      radius,
      interval,
      metadata,
      analyzeSphereFilesEnabled,
      modelsDir
    );

    if (!analysisOutput) {
      throw new Error("Analysis output is empty or undefined");
    }

    await saveResults(jobID, modelNumber, analysisOutput);
    updateModelMetadata(metadata, modelNumber, "completed");
    await saveMetadata(jobID, metadata);

  } catch (error) {
    console.error("Error during analysis:", error);
    updateModelMetadata(metadata, modelNumber, "failed", error instanceof Error ? error.message : String(error));
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
  analyzeSphereFilesEnabled: boolean,
  modelsDir = "models",
  updateMetadataStatus = true,
  simJobId?: string
): Promise<Analysis_results> {
  const analysisStartedAt = Date.now();
  const logger = createAnalysisLogger(jobID, modelNumber);

  if (updateMetadataStatus) {
    updateModelMetadata(metadata, modelNumber, "starting");
    metadata.status = "starting";
    await saveMetadata(jobID, metadata);
  }

  logger.record(
    `analyzeStructure started. radius=${radius} interval=${interval} analyzeSphereFilesEnabled=${analyzeSphereFilesEnabled} modelsDir=${modelsDir} residues=${residues.length}`
  );

  const resultsSuffix = modelsDir === "models" ? "_results" : "_sim_results";

  try {
    let stepStartedAt = Date.now();
    await writeSelectedResiduesToFile(jobID, modelNumber, residues, modelsDir);
    logStepDuration(logger.record, "writeSelectedResiduesToFile", stepStartedAt);

    stepStartedAt = Date.now();
    await createFragmentPDB(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "createFragmentPDB", stepStartedAt);

    stepStartedAt = Date.now();
    const fragmentMetrics = await fetchFragmentMetrics(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchFragmentMetrics", stepStartedAt);

    stepStartedAt = Date.now();
    const modelMetrics = await fetchModelMetrics(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchModelMetrics", stepStartedAt);

    stepStartedAt = Date.now();
    const residueAnalysisArray = await fetchResidueAnalysis(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchResidueAnalysis", stepStartedAt);

    stepStartedAt = Date.now();
    const clashscoreAnalysis = await fetchClashscoreAnalysis(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchClashscoreAnalysis", stepStartedAt);

    stepStartedAt = Date.now();
    const geometryAnalysis = await fetchGeometryAnalysis(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchGeometryAnalysis", stepStartedAt);
    // TODO - calculate median suiteness for model and fragment
    logger.record(`residueAnalysisArray length: ${residueAnalysisArray?.length || 0}. First few items: ${JSON.stringify(residueAnalysisArray?.slice(0, 3))}`);

    stepStartedAt = Date.now();
    const numeration = await fetchNumeration(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchNumeration", stepStartedAt);

    stepStartedAt = Date.now();
    const annotations = await fetchAnnotations(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchAnnotations", stepStartedAt);

    stepStartedAt = Date.now();
    const motifs = await fetchMotifs(jobID, modelNumber, modelsDir);
    logStepDuration(logger.record, "fetchMotifs", stepStartedAt);

    // analysis of residues
    stepStartedAt = Date.now();
    const initialData: nucleotideResult[] = residueAnalysisArray.map((res) => {
      const original_index = extractResidueNumber(res.residue);
      const chainID = extractChainID(res.residue);

      // Try to find in numeration with fallbacks: auth first, then label
      let residueNumeration = Object.values(numeration).find(
        (n: NumerationItem) => n.auth_residue_number === original_index && n.auth_chain_id === chainID);
      
      // Fallback: try label fields if auth didn't match
      if (!residueNumeration) {
        residueNumeration = Object.values(numeration).find(
          (n: NumerationItem) => n.label_residue_number === original_index && n.label_chain_id === chainID);
      }
      
      // Fallback: try by label_chain_id matching chainID (if label_residue_number is missing)
      if (!residueNumeration) {
        residueNumeration = Object.values(numeration).find(
          (n: NumerationItem) => n.label_chain_id === chainID && n.label_residue_number === original_index);
      }

      if (!residueNumeration) {
        return null;
      }
      const residueNumber = residueNumeration.annotator_residue_number;
      const base = residueNumeration.annotator_nucleotide_name;
      const secondaryStructure = residueNumeration.annotator_dotbracket;
      const structuralElements = findStructuralElementsForNucleotide(
        motifs,
        residueNumber
      );

      return {
        residue_number: residueNumber,
        original_index: original_index,
        base: base,
        structure: secondaryStructure,
        chainID:  chainID,
        original_chain_id: residueNumeration.auth_chain_id,
        selected: residues.some(
          (r) => r.chainID === chainID && r.residueID === original_index
        ),
        structuralElements: structuralElements,
        residueMetrics: res,
      };
    }).filter((item): item is nucleotideResult => item !== null);
    logStepDuration(logger.record, "residue mapping", stepStartedAt);

    logger.record(`Saving results for model ${modelNumber}. Number of residues: ${initialData.length}`);
    stepStartedAt = Date.now();
    await saveResults(jobID, modelNumber, {
      data: initialData,
      modelMetrics: modelMetrics,
      fragmentMetrics: fragmentMetrics,
    }, resultsSuffix);
    logStepDuration(logger.record, "saveResults (initial)", stepStartedAt);

    if (updateMetadataStatus) {
      updateModelMetadata(metadata, modelNumber, "running");
      metadata.status = "running";
      await saveMetadata(jobID, metadata);
    }

    if (!analyzeSphereFilesEnabled) {
      logStepDuration(logger.record, "analyzeStructure total", analysisStartedAt);
      return {
        data: initialData,
        modelMetrics: modelMetrics,
        fragmentMetrics: fragmentMetrics,
      };
    }

    stepStartedAt = Date.now();
    await createWalkingSphere(jobID, modelNumber, residues, radius, interval, modelsDir);
    logStepDuration(logger.record, "createWalkingSphere", stepStartedAt);

    stepStartedAt = Date.now();
    const files = await fs.readdir(`${JOBS_DIR}/${jobID}/${modelNumber}_sphere`);
    logStepDuration(logger.record, `read sphere directory (${files.length} files)`, stepStartedAt);

    stepStartedAt = Date.now();
    const sphereProcessedData = await analyzeSphereFilesIncremental(
      files,
      jobID,
      modelNumber,
      initialData,
      clashscoreAnalysis,
      geometryAnalysis,
      logger.record,
    );
    await saveResults(jobID, modelNumber, {
      data: sphereProcessedData,
      modelMetrics,
      fragmentMetrics,
    }, resultsSuffix);
    logStepDuration(logger.record, "analyzeSphereFilesSimple", stepStartedAt);

    if (!updateMetadataStatus) {
      updateModelMetadata(metadata, modelNumber, "sim_completed");
      metadata.status = "simulation_completed";
      await saveMetadata(jobID, metadata);
    }

    logStepDuration(logger.record, "analyzeStructure initial_phase_total", analysisStartedAt);

    return {
      data: sphereProcessedData,
      modelMetrics: modelMetrics,
      fragmentMetrics: fragmentMetrics,
    };
  } catch (error) {
    logger.record(`Error in analyzeStructure: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
   finally {
    await logger.flush();
  }
}

async function analyzeSphereFilesIncremental(
  files: string[],
  jobID: UUID,
  modelNumber: string,
  initialData: nucleotideResult[],
  clashscoreAnalysis: ClashscoreParsedResult,
  geometryAnalysis: GeoResidueSummary[],
  recordLog: (message: string) => void
): Promise<nucleotideResult[]> {
  const resultMap = new Map<number, nucleotideResult>();
  initialData.forEach((res) => resultMap.set(res.residue_number, { ...res }));

  function normalizeAtomName(atomName: string): string {
    return atomName.trim().replace(/\s+/g, "").toUpperCase();
  }

  function parseSphereFileAtoms(content: string): Array<{ chainID: string; residueID: number; atomName: string }> {
    const atoms: Array<{ chainID: string; residueID: number; atomName: string }> = [];
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) {
        continue;
      }

      const atomName = normalizeAtomName(line.substring(12, 16));
      const chainID = line.substring(21, 22).trim();
      const residueID = Number(line.substring(22, 26).trim());

      if (!atomName || !chainID || !Number.isFinite(residueID)) {
        continue;
      }

      atoms.push({ chainID, residueID, atomName });
    }

    return atoms;
  }

  function parseSphereFilename(fileName: string): { chainID: string; residueID: number } | null {
    const stem = fileName.split(".")[0] ?? "";
    const separatorIndex = stem.lastIndexOf("_");
    if (separatorIndex <= 0) {
      return null;
    }

    const chainID = stem.slice(0, separatorIndex).trim();
    const residueID = Number(stem.slice(separatorIndex + 1).trim());
    if (!chainID || !Number.isFinite(residueID)) {
      return null;
    }

    return { chainID, residueID };
  }

  function parseGeometryResidueID(resId: string): number | null {
    const match = resId.match(/-?\d+/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildAtomKey(chainID: string, residueID: number, atomName: string): string {
    return `${chainID}:${residueID}:${normalizeAtomName(atomName)}`;
  }

  function formatPercent(count: number, total: number): string {
    if (total <= 0) {
      return "0.00";
    }
    return ((count / total) * 100).toFixed(2);
  }

  for (const file of files) {
    const startedAt = Date.now();

    try {
      const sourceResidue = parseSphereFilename(file);
      if (!sourceResidue) {
        recordLog(`Skipping sphere file with invalid filename format: ${file}`);
        continue;
      }

      const initialNucleotide = initialData.find(
        (nucleotide) =>
          nucleotide.chainID === sourceResidue.chainID && nucleotide.original_index === sourceResidue.residueID,
      );
      if (!initialNucleotide) {
        recordLog(`No initial nucleotide found for sphere file ${file}`);
        continue;
      }

      const sphereFilePath = `${JOBS_DIR}/${jobID}/${modelNumber}_sphere/${file}`;
      const sphereFileContent = await fs.readFile(sphereFilePath, "utf-8");
      const sphereAtoms = parseSphereFileAtoms(sphereFileContent);

      const atomKeys = new Set<string>();
      const atomsByResidue = new Map<string, Set<string>>();
      for (const atom of sphereAtoms) {
        atomKeys.add(buildAtomKey(atom.chainID, atom.residueID, atom.atomName));
        const residueKey = `${atom.chainID}:${atom.residueID}`;
        const existing = atomsByResidue.get(residueKey) ?? new Set<string>();
        existing.add(normalizeAtomName(atom.atomName));
        atomsByResidue.set(residueKey, existing);
      }

      let clashCount = 0;
      for (const clash of clashscoreAnalysis.clashes) {
        // if (
        //   normalizeAtomName(clash.source.atomName).startsWith("H") ||
        //   normalizeAtomName(clash.target.atomName).startsWith("H")
        // ) {
        //   continue;
        // }
        const sourceKey = buildAtomKey(
          clash.source.chain,
          Number(clash.source.residueNumber),
          clash.source.atomName,
        );
        const targetKey = buildAtomKey(
          clash.target.chain,
          Number(clash.target.residueNumber),
          clash.target.atomName,
        );

        if (atomKeys.has(sourceKey) && atomKeys.has(targetKey)) {
          clashCount += 1;
        }
      }

      let badBondCount = 0;
      let totalBondCount = 0;
      let badAngleCount = 0;
      let totalAngleCount = 0;

      for (const geometryResidue of geometryAnalysis) {
        const residueID = parseGeometryResidueID(geometryResidue.resId);
        if (residueID === null) {
          continue;
        }

        const residueKey = `${geometryResidue.chainId}:${residueID}`;
        const residueAtoms = atomsByResidue.get(residueKey);
        if (!residueAtoms || residueAtoms.size === 0) {
          continue;
        }

        totalBondCount += geometryResidue.bondCount;
        totalAngleCount += geometryResidue.angleCount;

        badBondCount += geometryResidue.badBonds.filter((bond) =>
          bond.atoms.some((atom) => residueAtoms.has(normalizeAtomName(atom))),
        ).length;

        badAngleCount += geometryResidue.badAngles.filter((angle) =>
          angle.atoms.some((atom) => residueAtoms.has(normalizeAtomName(atom))),
        ).length;
      }

      const clashscoreFromSphere = (clashCount / Math.max(sphereAtoms.length, 1)) * 1000;
      const residueMetricsFromSphere: metrics = {
        pdbFileName: file,
        chains: "1",
        residues: "1",
        clashscore: String(clashscoreFromSphere),
        numbadbonds: String(badBondCount),
        numbonds: String(Math.max(totalBondCount, badBondCount)),
        pct_badbonds: formatPercent(badBondCount, Math.max(totalBondCount, badBondCount)),
        pct_resbadbonds: badBondCount > 0 ? "100.00" : "0.00",
        numbadangles: String(badAngleCount),
        numangles: String(Math.max(totalAngleCount, badAngleCount)),
        pct_badangles: formatPercent(badAngleCount, Math.max(totalAngleCount, badAngleCount)),
        pct_resbadangles: badAngleCount > 0 ? "100.00" : "0.00",
        numSuiteOutliers: "-",
        numSuites: "-",
      };

      const current = resultMap.get(initialNucleotide.residue_number);
      if (current) {
        resultMap.set(initialNucleotide.residue_number, {
          ...current,
          metrics: residueMetricsFromSphere,
        });
      }
      else {
        recordLog(`No existing nucleotide result found for ${file} to update with sphere metrics`);
      }

    } catch (error) {
      recordLog(
        `sphere file ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`Error processing sphere file ${file}:`, error);
    }
  }

  return Array.from(resultMap.values()).sort(
    (a, b) => a.residue_number - b.residue_number
  );
}

function extractResidueNumber(residue: string): number {
  return Number(residue.substring(2,6));
}

function extractChainID(residue: string): string {
  return residue.substring(0,2).trim();
}

async function createWalkingSphere(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  radius: number,
  interval: number,
  modelsDir = "models"
) {
  const residuesFilePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_residues.json`;
  await fs.writeFile(residuesFilePath, JSON.stringify(residues, null, 2));

  const walkingSphere = await fetch(
    `${TOOLS_URL}/sphere?id=${jobID}&modelNumber=${modelNumber}&radius=${radius}&interval=${interval}&modelsDir=${modelsDir}`,
    { method: "POST" }
  );
  if (!walkingSphere.ok) {
    throw new Error("Sphere error: " + walkingSphere.statusText);
  }
}

async function fetchResidueAnalysis(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<residueMetrics[]> {
  const residueAnalysisUrl = `${MOLPROBITY_URL}/residue-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`;
  const residueAnalysis = await fetch(residueAnalysisUrl, { agent: getAgentForUrl(residueAnalysisUrl) } as any);
  if (!residueAnalysis.ok) {
    throw new Error("Residue analysis error: " + residueAnalysis.statusText);
  }
  const metrics = (await residueAnalysis.json()) as residueMetrics[];
  const filePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_ResidueMetrics.json`;
  await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));
  return metrics;
}

async function fetchModelMetrics(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<metrics> {
  const modelMetricsUrl = `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`;
  const response = await fetch(modelMetricsUrl, { agent: getAgentForUrl(modelMetricsUrl) } as any);
  if (!response.ok) {
    throw new Error("One-line analysis error: " + response.statusText);
  }
  const metrics = (await response.json()) as metrics;
  const filePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_ModelMetrics.json`;
  await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));
  return metrics;
}

async function fetchFragmentMetrics(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<metrics> {
  const fragmentMetricsUrl = `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}_fragment.pdb`;
  const response = await fetch(fragmentMetricsUrl, { agent: getAgentForUrl(fragmentMetricsUrl) } as any);
  if (!response.ok) {
    throw new Error("One-line analysis error: " + response.statusText);
  }
  const metrics = (await response.json()) as metrics;
  const filePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_FragmentMetrics.json`;
  await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));
  return metrics;
}

async function fetchClashscoreAnalysis(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<ClashscoreParsedResult> {
  const clashscoreUrl = `${MOLPROBITY_URL}/clashscore?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`;
  const response = await fetch(clashscoreUrl, { agent: getAgentForUrl(clashscoreUrl) } as any);
  if (!response.ok) {
    throw new Error("Clashscore analysis error: " + response.statusText);
  }
  const responseData = (await response.json()) as {
    success?: boolean;
    [key: string]: unknown;
  };

  if (!responseData.success) {
    throw new Error("Clashscore analysis failed: " + JSON.stringify(responseData));
  }

  const clashscoreData = await fetchJSONFile(jobID, `${modelNumber}.clash`, modelNumber, modelsDir);
  if (!clashscoreData) {
    throw new Error(`Clashscore file for model ${modelNumber} not found`);
  }
  return clashscoreData as ClashscoreParsedResult;
}

async function fetchGeometryAnalysis(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<GeoResidueSummary[]> {
  const mpGeoUrl = `${MOLPROBITY_URL}/mpgeo-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`;
  const response = await fetch(mpGeoUrl, { agent: getAgentForUrl(mpGeoUrl) } as any);
  if (!response.ok) {
    throw new Error("Geometry analysis error: " + response.statusText);
  }
  const responseData = (await response.json()) as {
    success?: boolean;
    [key: string]: unknown;
  };

  if (!responseData.success) {
    throw new Error("Geometry analysis failed: " + JSON.stringify(responseData));
  }
  
  const geometryData = await fetchJSONFile(jobID, `${modelNumber}.geo.json`, modelNumber, modelsDir);
  if (!geometryData) {
    throw new Error(`Geometry file for model ${modelNumber} not found`);
  }
  return geometryData as GeoResidueSummary[];
}

async function fetchNumeration(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<Numeration> {
  const numeration = await fetchJSONFile(
    jobID,
    `${modelNumber}_numeration.json`,
    modelNumber,
    modelsDir
  );
  if (!numeration) {
    throw new Error(`Numeration file for model ${modelNumber} not found`);
  }
  return numeration;
}

async function fetchAnnotations(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<Annotation[]> {
  const annotation = await fetchJSONFile(
    jobID,
    `${modelNumber}_annotation.json`,
    modelNumber,
    modelsDir
  );
  if (!annotation) {
    throw new Error(`Annotation file for model ${modelNumber} not found`);
  }
  return annotation;
}

async function fetchMotifs(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
): Promise<StructuralElement[]> {
  const motifs = await fetchJSONFile(
    jobID,
    `${modelNumber}_motifs.json`,
    modelNumber,
    modelsDir
  );
  if (!motifs) {
    throw new Error(`Motifs file for model ${modelNumber} not found`);
  }
  return motifs;
}

  export function findStructuralElementsForNucleotide(
  elements: StructuralElement[],
  nucleotideIndex: number
  ): StructuralElement[] {
  if (!elements || elements.length === 0) {
    return [];
  }
  return elements.filter((element) =>
    element.residues?.some(
      (range) =>
        range.start !== undefined &&
        range.end !== undefined &&
        nucleotideIndex >= range.start &&
        nucleotideIndex <= range.end
    )
  );
}

async function writeSelectedResiduesToFile(
  jobID: UUID,
  modelNumber: string,
  residues: ChainElement[],
  modelsDir = "models"
): Promise<void> {
  const residuesFilePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_residues.json`;
  await fs.writeFile(residuesFilePath, JSON.stringify(residues, null, 2));
}

async function createFragmentPDB(
  jobID: UUID,
  modelNumber: string,
  modelsDir = "models"
) {
  const fragment = await fetch(
    `${TOOLS_URL}/fragment?id=${jobID}&modelNumber=${modelNumber}&modelsDir=${modelsDir}`,
    { method: "POST" }
  );
  if (!fragment.ok) {
    throw new Error("Fragment extraction error: " + fragment.statusText);
  }
}
