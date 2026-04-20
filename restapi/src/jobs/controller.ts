import db from "../db/index.js";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { getJobsQuery, getJobByIdQuery, createJobQuery } from "./queries.js";
import {
  ALLOWED_EXTENSIONS,
  deleteFile,
  deleteJobDirectory,
  fetchJSONFile,
  fetchPdbFile,
  fetchPdbFileAsJSON,
  generateFilename,
  MAX_FILE_SIZE,
  moveToJobDirectroy,
  saveOriginalNumeration,
  uploadFileFromPDBCode,
  validateFile,
  saveMetadata,
  fetchModelFileAsString,
  readMetadata,
  readResults,
  createZip,
  getDemoFiles,
  JOBS_DIR,
} from "./utils.js";
import fetch from "node-fetch";
import type { UUID } from "crypto";
import type {
  Analysis_results,
  Annotation,
  ChainElement,
  Job,
  Metadata,
  splitModelsResponse,
  StructuralElement,
} from "./types.js";
import { TOOLS_URL } from "../server.js";
import { addAnalysisTask } from "./analysis.js";
import { addSimulationTask, fetchSimulationStatus, type SimulationParameters } from "./simulation.js";
import { existsSync } from "fs";
import { join } from "path";
import fs from "fs/promises";
import { addCreateJobTask } from "./jobCreation.js";

const MODEL_SIMULATION_IN_PROGRESS_STATUSES = new Set([
  "sim_starting",
  "sim_running",
  "sim_finished",
  "sim_analyzing",
]);

async function clearPreviousSimulationArtifacts(id: UUID) {
  const jobDir = join(JOBS_DIR, id);
  const simDir = join(jobDir, "sim");

  // Ensure stale simulated structures and annotations cannot leak into a new run.
  await fs.rm(simDir, { recursive: true, force: true });
  await fs.mkdir(simDir, { recursive: true });

  const jobFiles = await fs.readdir(jobDir);
  const simResultsFiles = jobFiles.filter((filename) =>
    filename.endsWith("_sim_results.json")
  );

  await Promise.all(
    simResultsFiles.map((filename) => fs.rm(join(jobDir, filename), { force: true }))
  );
}

export async function getJobs(req: Request, res: Response) {
  db.query(getJobsQuery, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: "Database error." });
      return;
    }
    res.status(200).json(result.rows);
  });
}

export async function getJobById(req: Request, res: Response) {
  const id = req.params.id as UUID;
  const modelNumber = (req.params.modelNumber as string) || "1";
  const resultsSource = ((req.query.resultsSource as string) || "original").toLowerCase();

  if (!id) {
    res.status(400).send({ error: "Job ID is required." });
    return;
  }

  if (id.length !== 36) {
    res.status(422).send({ error: "Invalid job ID." });
    return;
  }

  if (!Number.isInteger(parseInt(modelNumber))) {
    res.status(422).send({ error: "Invalid model number." });
    return;
  }

  if (!["original", "simulation"].includes(resultsSource)) {
    res.status(422).send({ error: "Invalid results source." });
    return;
  }

  const modelsDir = resultsSource === "simulation" ? "sim" : "models";
  const resultsSuffix = resultsSource === "simulation" ? "_sim_results" : "_results";

  let metadata: Metadata;
  try {
    metadata = await readMetadata(id);
    if (!metadata) {
      res.status(500).send({ error: "Metadata file not found." });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(404).send({ error: "Job not found." });
    return;
  }

  if (
    parseInt(modelNumber) > metadata.model_count ||
    parseInt(modelNumber) < 1
  ) {
    res.status(404).send({ error: "Model not found." });
    return;
  }

  db.query(getJobByIdQuery, [id], async (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: "Database error." });
      return;
    }
    if (result.rows.length === 0) {
      res.status(404).send({ error: "Job not found." });
      return;
    }
    // res.status(200).json(result.rows[0]);
    //load annotation json file
    const annotation = await fetchJSONFile(
      id,
      `${modelNumber}_annotation.json`,
      modelNumber,
      modelsDir
    );
    if (!annotation) {
      res.status(500).send({ error: "Annotation file not found." });
      return;
    }

    const numeration = await fetchJSONFile(
      id,
      `${modelNumber}_numeration.json`,
      modelNumber,
      modelsDir
    );
    if (!numeration) {
      res.status(500).send({ error: "Numeration file not found." });
      return;
    }

    const motifs = await fetchJSONFile(
      id,
      `${modelNumber}_motifs.json`,
      modelNumber,
      modelsDir
    );
    if (!motifs) {
      res.status(500).send({ error: "Motifs file not found." });
      return;
    }

    const pdbFile = await fetchPdbFileAsJSON(id, modelNumber, modelsDir);
    if (!pdbFile) {
      res.status(500).send({ error: "PDB file not found." });
      return;
    }

    const file_string = await fetchModelFileAsString(id, modelNumber, modelsDir);
    if (!file_string) {
      res.status(500).send({ error: "Blob file not found." });
      return;
    }

    // check if results file exists
    const resultsFilePath = join(JOBS_DIR, id, modelNumber + `${resultsSuffix}.json`);
    let results: Analysis_results | null = null;
    if (existsSync(resultsFilePath)) {
      results = await readResults(id, modelNumber, resultsSuffix);
    }

    const jobResponse: Job = {
      id: result.rows[0].id,
      original_filename: result.rows[0].original_filename,
      name: result.rows[0].name,
      metadata: metadata,
      model_number: parseInt(modelNumber),
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
      annotation: annotation,
      numeration: numeration,
      motifs: motifs,
      pdb_file: pdbFile,
      pdb_file_string: file_string,
      results: results,
    };

    res.status(200).json(jobResponse);
  });
}

export async function getJobCreation(req: Request, res: Response) {
  const jobID = req.params.id as UUID;
  // read metadata and return it
  if (!jobID) {
    res.status(400).send({ error: "Job ID is required." });
    return;
  }

  let metadata: Metadata;
  try {
    metadata = await readMetadata(jobID);
    if (!metadata) {
      res.status(500).send({ error: "Metadata file not found." });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(404).send({ error: "Job not found." });
    return;
  }

  return res.status(200).json({
    id: jobID,
    metadata: metadata,
  });
}

export async function createJob(req: Request, res: Response) {
  const rnaFile = req.file as Express.Multer.File;
  var pdbCode = req.body.pdbCode;
  const jobname = (req.body.jobName as string) || "Untitled job";
  const demoFileName = (req.body.radioButton as string) || "None";

  console.log(
    "Creating job. rnaFile: ",
    rnaFile,
    " pdbCode: ",
    pdbCode,
    " jobName: ",
    jobname,
    " demoFileName: ",
    demoFileName
  );

  var id: UUID;
  var newFilename: string;
  var originalFilename: string;
  var originalExtension: string;

  if (!rnaFile && pdbCode === "" && demoFileName === "None") {
    res.status(400).send({ error: "Either RNA file or PDB code is required" });
    return;
  }

  const possible_demo_files = ["good", "medium", "bad"];
  if (demoFileName !== "None" && !possible_demo_files.includes(demoFileName)) {
    res.status(422).send({ error: "Invalid demo file." });
    return;
  }

  if (demoFileName !== "None") {
    const demoFileBuffer = await getDemoFiles(demoFileName + ".pdb");

    id = randomUUID();
    originalFilename = demoFileName + ".pdb";
    originalExtension = "pdb";
    newFilename = id + ".pdb";
    await uploadFileFromPDBCode(
      new File([demoFileBuffer], newFilename),
      newFilename
    );
  } else if (rnaFile && rnaFile.size > 0) {
    const error = validateFile(rnaFile, MAX_FILE_SIZE, ALLOWED_EXTENSIONS);
    if (error) {
      deleteFile(rnaFile.filename);
      res.status(422).send(error);
      return;
    }

    id = rnaFile.filename.split(".")[0] as UUID;
    newFilename = rnaFile.filename;
    originalFilename = rnaFile.originalname;
    originalExtension = rnaFile.originalname.split(".").pop() as string;
  } else {
    // use pdbCode
    if (pdbCode && pdbCode.length !== 4) {
      res.status(422).send({ error: "Invalid PDB code." });
      return;
    }

    // fetch pdb file
    const pdbCodeFile = await fetchPdbFile(pdbCode);
    if (typeof pdbCodeFile === "string") {
      res.status(500).send(pdbCodeFile);
      return;
    }

    id = randomUUID();
    originalFilename = pdbCodeFile.name;
    originalExtension = pdbCodeFile.name.split(".").pop() as string;
    newFilename = generateFilename(id, pdbCodeFile);
    await uploadFileFromPDBCode(pdbCodeFile, newFilename);
  }

  // move file to job directory
  await moveToJobDirectroy(newFilename, id);

  const metadata: Metadata = {
    status: "creating",
    model_count: 1,
  };

  await saveMetadata(id, metadata);

  addCreateJobTask(
    id,
    originalFilename,
    originalExtension,
    newFilename,
    jobname,
    metadata
  );

  return res.status(202).json({
    id: id,
    original_filename: originalFilename,
    name: jobname,
    metadata: metadata,
    message: "Job creation is in progress. Please check back later.",
  });
}

export async function analyzeStructure(req: Request, res: Response) {
  res.setMaxListeners(0);
  res.setTimeout(0);

  const id: UUID = req.body.id;
  const models: Record<number, ChainElement[]> = req.body.models || {};
  const radius = req.body.radius || 5;
  const interval = req.body.interval || 1;
  var analyzeNeighborhoods = false;

  console.log(
    "Analyzing whole structure. id: ",
    id,
    " radius: ",
    radius,
    " interval: ",
    interval
  );

  if (!id) {
    res.status(400).send({ error: "ID is required." });
    return;
  }

  if (id.length !== 36) {
    res.status(422).send({ error: "Invalid job ID." });
    return;
  }

  if (!Number.isInteger(parseInt(radius))) {
    res.status(422).send({ error: "Invalid radius." });
    return;
  }

  if (!Number.isInteger(parseInt(interval))) {
    res.status(422).send({ error: "Invalid interval." });
    return;
  }

  const metadata = await readMetadata(id);
  if (!metadata) {
    res.status(500).send({ error: "Metadata file not found." });
    return;
  }

  analyzeNeighborhoods = (radius < 0 || interval < 0) ? false : true;
  metadata.analyzeNeighborhoods = analyzeNeighborhoods;

  metadata.status = "starting";
  if (metadata.resultsStatus === undefined) {
    metadata.resultsStatus = {};
  }
  for (let modelNumber in models) {
    metadata.resultsStatus[modelNumber] = {modelNumber: modelNumber, status: "starting"};
  }
  await saveMetadata(id, metadata);

  addAnalysisTask(id, models, radius, interval, metadata, analyzeNeighborhoods);

  db.query(getJobByIdQuery, [id], async (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: "Database error." });
      return;
    }
    if (result.rows.length === 0) {
      res.status(404).send({ error: "Job not found." });
      return;
    }

    res.status(200).json({
      id: result.rows[0].id,
      original_filename: result.rows[0].original_filename,
      name: result.rows[0].name,
      metadata: metadata,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
      message: "Structure analysis is running. Please check back later.",});
  });
}

export async function downloadJobFiles(req: Request, res: Response) {
  const id = req.params.id as UUID;

  if (!id) {
    res.status(400).send({ error: "Job ID is required." });
    return;
  }

  if (id.length !== 36) {
    res.status(422).send({ error: "Invalid job ID." });
    return;
  }

  let metadata: Metadata;
  try {
    metadata = await readMetadata(id);
    if (!metadata) {
      res.status(500).send({ error: "Metadata file not found." });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(404).send({ error: "Job not found." });
    return;
  }

  const zipFilePath = await createZip(id);

  if (!zipFilePath) {
    res.status(500).send({ error: "Error creating zip file." });
    return;
  }

  res.download(zipFilePath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: "Error downloading zip file." });
    }
  });
}

export async function startSimulation(req: Request, res: Response) {
  res.setMaxListeners(0);
  res.setTimeout(0);

  const id: UUID = req.body.id;
  const modelNumber = (req.body.modelNumber as string) || "1";
  const restraintBackboneForce = Number(req.body.restraintBackboneForce);
  const restraintGlobalForce = Number(req.body.restraintGlobalForce);
  const restraintBasePairsForce = Number(req.body.restraintBasePairsForce);
  const rmsdCutoff = Number(req.body.rmsdCutoff);

  console.log(
    "Starting simulation. id: ",
    id,
    " modelNumber: ",
    modelNumber
  );

  if (!id) {
    res.status(400).send({ error: "ID is required." });
    return;
  }

  if (id.length !== 36) {
    res.status(422).send({ error: "Invalid job ID." });
    return;
  }

  if (!Number.isInteger(parseInt(modelNumber))) {
    res.status(422).send({ error: "Invalid model number." });
    return;
  }

  const numericParams: Array<[string, number]> = [
    ["restraintBackboneForce", restraintBackboneForce],
    ["restraintGlobalForce", restraintGlobalForce],
    ["restraintBasePairsForce", restraintBasePairsForce],
    ["rmsdCutoff", rmsdCutoff],
  ];

  for (const [name, value] of numericParams) {
    if (!Number.isFinite(value)) {
      res.status(422).send({ error: `Invalid ${name}.` });
      return;
    }
  }

  if (restraintBackboneForce < 0 || restraintGlobalForce < 0 || restraintBasePairsForce < 0) {
    res.status(422).send({ error: "Restraint forces must be non-negative." });
    return;
  }

  if (rmsdCutoff <= 0) {
    res.status(422).send({ error: "rmsdCutoff must be greater than 0." });
    return;
  }

  const metadata = await readMetadata(id);
  if (!metadata) {
    res.status(500).send({ error: "Metadata file not found." });
    return;
  }

  const currentModelStatus = metadata.resultsStatus?.[modelNumber]?.status;
  if (currentModelStatus && MODEL_SIMULATION_IN_PROGRESS_STATUSES.has(currentModelStatus)) {
    res.status(409).send({ error: "Simulation is already in progress for this model." });
    return;
  }

  try {
    await clearPreviousSimulationArtifacts(id);
  } catch (error) {
    console.error("Failed to clear previous simulation artifacts:", error);
    res.status(500).send({ error: "Failed to clean previous simulation artifacts." });
    return;
  }

  // Construct environment path from job directory
  const environmentPath = `${JOBS_DIR}/${id}`;
  const simulationParams: SimulationParameters = {
    restraintBackboneForce,
    restraintGlobalForce,
    restraintBasePairsForce,
    rmsdCutoff,
  };

  console.log("Starting simulation with parameters:", {
    id,
    modelNumber,
    ...simulationParams,
  });

  metadata.status = "simulation_starting";
  if (metadata.resultsStatus === undefined) {
    metadata.resultsStatus = {};
  }
  metadata.resultsStatus[modelNumber] = {
    modelNumber,
    status: "sim_starting",
    error_message: undefined,
  };
  if (metadata.simulations === undefined) {
    metadata.simulations = {};
  }
  metadata.simulations[modelNumber] = {
    simJobId: "",
    status: "starting",
  };
  await saveMetadata(id, metadata);

  addSimulationTask(id, modelNumber, environmentPath, metadata, simulationParams);

  db.query(getJobByIdQuery, [id], async (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ error: "Database error." });
      return;
    }
    if (result.rows.length === 0) {
      res.status(404).send({ error: "Job not found." });
      return;
    }

    res.status(202).json({
      id: result.rows[0].id,
      original_filename: result.rows[0].original_filename,
      name: result.rows[0].name,
      metadata: metadata,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
      message: "Simulation is starting. Please check back later.",
    });
  });
}

export async function getSimulationStatus(req: Request, res: Response) {
  const id = req.params.id as UUID;

  if (!id) {
    res.status(400).send({ error: "Job ID is required." });
    return;
  }

  if (id.length !== 36) {
    res.status(422).send({ error: "Invalid job ID." });
    return;
  }

  let metadata: Metadata;
  try {
    metadata = await readMetadata(id);
    if (!metadata) {
      res.status(500).send({ error: "Metadata file not found." });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(404).send({ error: "Job not found." });
    return;
  }

  const simStatus = await fetchSimulationStatus(id, metadata);

  res.status(200).json({
    id: id,
    metadata: metadata,
    simulations: simStatus,
  });
}

// clean up the job directory and db every 2 weeks
export async function cleanUpJobs(time: number = 12096e5) {
  const age = new Date(Date.now() - time);
  const ageString = age.toISOString();

  const query = "SELECT id FROM jobs WHERE createdAt < $1";

  const res = await db.query(query, [ageString]);
  const result = res.rows.map((row) => row.id);
  // console.log(result);

  result.forEach(async (id: UUID) => {
    deleteJobDirectory(id);
  });

  const deleteQuery = "DELETE FROM jobs WHERE createdAt < $1";
  db.query(deleteQuery, [ageString], (err, result) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log("Clean up completed.");
  });
}
