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
} from "./types.js";
import { MOLPROBITY_URL, TOOLS_URL } from "../server.js";
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
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

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
  updateMetadataStatus = true
): Promise<Analysis_results> {
  if (updateMetadataStatus) {
    updateModelMetadata(metadata, modelNumber, "starting");
    metadata.status = "starting";
    await saveMetadata(jobID, metadata);
  }

  const resultsSuffix = modelsDir === "models" ? "_results" : "_sim_results";

  await writeSelectedResiduesToFile(jobID, modelNumber, residues, modelsDir);
  await createFragmentPDB(jobID, modelNumber, modelsDir);
  const fragmentMetrics = await fetchFragmentMetrics(jobID, modelNumber, modelsDir);

  const modelMetrics = await fetchModelMetrics(jobID, modelNumber, modelsDir);
  const residueAnalysisArray = await fetchResidueAnalysis(jobID, modelNumber, modelsDir);
  // TODO - calculate median suiteness for model and fragment
  console.log(`[Job ${jobID}, Model ${modelNumber}] residueAnalysisArray length: ${residueAnalysisArray?.length || 0}. First few items:`, residueAnalysisArray?.slice(0, 3));

  const numeration = await fetchNumeration(jobID, modelNumber, modelsDir);
  const annotations = await fetchAnnotations(jobID, modelNumber, modelsDir);
  const motifs = await fetchMotifs(jobID, modelNumber, modelsDir);

  // analysis of residues
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
      // const sampleEntries = Object.entries(numeration).slice(0, 3).map(([idx, item]) => 
      //   `idx=${idx} auth=(chain=${item.auth_chain_id} res=${item.auth_residue_number}) label=(chain=${item.label_chain_id} res=${item.label_residue_number})`
      // ).join(' | ');
      // console.error(`Numeration not found for residue ${res.residue}. Looking for chainID='${chainID}' residueNum=${original_index}. Sample: ${sampleEntries}`);
      return null;
    }
    const residueNumber = residueNumeration.annotator_residue_number;
    // const chainID = residueNumeration.new_chain_id;
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

  console.log(`Saving results for job ${jobID}, model ${modelNumber}. Number of residues: ${initialData.length}`);
  await saveResults(jobID, modelNumber, {
    data: initialData,
    modelMetrics: modelMetrics,
    fragmentMetrics: fragmentMetrics,
  }, resultsSuffix);

  if (updateMetadataStatus) {
    updateModelMetadata(metadata, modelNumber, "running");
    metadata.status = "running";
    await saveMetadata(jobID, metadata);
  }

  if (!analyzeSphereFilesEnabled) {
    return {
      data: initialData,
      modelMetrics: modelMetrics,
      fragmentMetrics: fragmentMetrics,
    };
  }

  await createWalkingSphere(jobID, modelNumber, residues, radius, interval, modelsDir);

  const files = await fs.readdir(`${JOBS_DIR}/${jobID}/${modelNumber}_sphere`);
  const results = await analyzeSphereFilesIncremental(
    files,
    jobID,
    modelNumber,
    initialData,
    modelMetrics,
    fragmentMetrics,
    resultsSuffix
  );

  return {
    data: results,
    modelMetrics: modelMetrics,
    fragmentMetrics: fragmentMetrics,
  };
}

async function analyzeSphereFilesIncremental(
  files: string[],
  jobID: UUID,
  modelNumber: string,
  initialData: nucleotideResult[],
  modelMetrics: metrics,
  fragmentMetrics: metrics,
  resultsSuffix: string
): Promise<nucleotideResult[]> {
  const resultMap = new Map<number, nucleotideResult>();
  initialData.forEach((res) => resultMap.set(res.residue_number, { ...res }));

  const batchSize = 5;
  const maxRetries = 3;
  const initialDelay = 1000; // 1 second

  async function fetchWithRetry(file: string, retryCount = 0): Promise<nucleotideResult | null> {
    try {
      const res = await fetch(
        `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${modelNumber}_sphere/${file}`,
        { keepalive: true }
      );

      if (!res.ok) {
        throw new Error(`Error analyzing file ${file}: ${res.statusText}`);
      }

      const tmpMetrics: metrics = (await res.json()) as metrics;
      const [chainId, originalNumberStr] = file.split(".")[0]?.split("_") ?? [];
      const originalNumber = parseInt(originalNumberStr ?? "");
      // find in initialData the nucleotide with this original index and chain id
      if (!chainId || isNaN(originalNumber)) {
        throw new Error(`Invalid file name format: ${file}`);
      }
      const initialNucleotide = initialData.find((n) => n.original_index === originalNumber && n.chainID === chainId);
      if (!initialNucleotide) {
        throw new Error(`Initial nucleotide not found for chain ${chainId} and index ${originalNumber} in file ${file}`);
      }
      const initialNucleotideResults = resultMap.get(initialNucleotide.residue_number);

      return {
        ...initialNucleotideResults,
        metrics: tmpMetrics,
      } as nucleotideResult;
    } catch (error) {
      const isTransientError = error instanceof Error && 
        (error.message.includes('ECONNRESET') || 
         error.message.includes('ETIMEDOUT') || 
         error.message.includes('ECONNREFUSED') ||
         error.message.includes('fetch failed'));
      
      if (isTransientError && retryCount < maxRetries) {
        const delay = initialDelay * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`[Job ${jobID}, Model ${modelNumber}] Transient error for file ${file}, retry ${retryCount + 1}/${maxRetries} after ${delay}ms:`, error instanceof Error ? error.message : error);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(file, retryCount + 1);
      }

      console.error(`Error processing file ${file}:`, error);
      return null;
    }
  }

  for (let i = 0; i < files.length; i += batchSize) {
    const batchFiles = files.slice(i, i + batchSize);
    const batchTasks = batchFiles.map((file) => fetchWithRetry(file));

    const batchResults = await Promise.allSettled(batchTasks);
    const fulfilled = batchResults
      .filter(
        (p): p is PromiseFulfilledResult<nucleotideResult | null> =>
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

    console.log(`Saving results for job ${jobID}, model ${modelNumber}. Number of residues: ${sortedResults.length}`);
    await saveResults(jobID, modelNumber, {
      data: sortedResults,
      modelMetrics,
      fragmentMetrics,
    }, resultsSuffix);
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
  const residueAnalysis = await fetch(
    `${MOLPROBITY_URL}/residue-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`,
    { keepalive: true }
  );
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
  const response = await fetch(
    `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}.pdb`,
    { keepalive: true }
  );
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
  const response = await fetch(
    `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${modelsDir}/${modelNumber}_fragment.pdb`,
    { keepalive: true }
  );
  if (!response.ok) {
    throw new Error("One-line analysis error: " + response.statusText);
  }
  const metrics = (await response.json()) as metrics;
  const filePath = `${JOBS_DIR}/${jobID}/${modelsDir}/${modelNumber}_FragmentMetrics.json`;
  await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));
  return metrics;
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
