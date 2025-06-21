import db from "../db/index.js";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { getJobsQuery, getJobByIdQuery, createJobQuery } from "./queries.js";
import {
  ALLOWED_EXTENSIONS,
  analyzeStructureFragment,
  deleteFile,
  deleteJobDirectory,
  fetchJSONFile,
  fetchPdbFile,
  fetchPdbFileAsJSON,
  generateFilename,
  MAX_FILE_SIZE,
  moveToJobDirectroy,
  saveOriginalNumeration,
  uploadFile,
  uploadFileFromPDBCode,
  saveJSONFileModels,
  saveJSONFileRoot,
  validateFile,
  saveMetadata,
  fetchModelFileAsString,
  readMetadata,
  readResults,
  saveResults,
  analyzeStructureWalkingSphere,
  createZip,
  getDemoFiles,
} from "./utils.js";
import fetch from "node-fetch";
import type { UUID } from "crypto";
import type {
  Analysis_results,
  Annotation,
  Job,
  Metadata,
  nucleotideResult,
  splitModelsResponse,
  StructuralElement,
} from "./types.js";
import { TOOLS_URL } from "../server.js";
import { addAnalysisTask } from "./analysis.js";

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
      modelNumber
    );
    if (!annotation) {
      res.status(500).send({ error: "Annotation file not found." });
      return;
    }

    const numeration = await fetchJSONFile(
      id,
      `${modelNumber}_numeration.json`,
      modelNumber
    );
    if (!numeration) {
      res.status(500).send({ error: "Numeration file not found." });
      return;
    }

    const motifs = await fetchJSONFile(
      id,
      `${modelNumber}_motifs.json`,
      modelNumber
    );
    if (!motifs) {
      res.status(500).send({ error: "Motifs file not found." });
      return;
    }

    const pdbFile = await fetchPdbFileAsJSON(id, modelNumber);
    if (!pdbFile) {
      res.status(500).send({ error: "PDB file not found." });
      return;
    }

    const file_string = await fetchModelFileAsString(id, modelNumber);
    if (!file_string) {
      res.status(500).send({ error: "Blob file not found." });
      return;
    }

    const results = await readResults(id);

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
  var finalFilename: string;
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
    status: "running",
    model_count: 1,
  };

  saveMetadata(id, metadata);

  // if not pdb, convert to pdb
  console.log(originalExtension);
  if (originalExtension != "pdb") {
    const convertResponse = await fetch(
      `${TOOLS_URL}/convert?id=${id}&filename=${newFilename}`,
      {
        method: "POST",
      }
    );

    if (!convertResponse.ok) {
      console.error("Conversion error");
      deleteJobDirectory(id);
      res.status(500).send({ error: "CIF to PDB conversion error." });
      return;
    } else {
      console.log("Conversion successful.");
    }

    finalFilename = newFilename.split(".")[0] + ".pdb";
  } else {
    finalFilename = newFilename;
  }

  // check if pdb file exists after conversion
  const pdbFile = await fetchPdbFileAsJSON(id);
  if (!pdbFile) {
    console.error("PDB file not found after conversion.");
    deleteJobDirectory(id);
    res.status(500).send({ error: "Conversion error." });
    return;
  }

  // split file into models
  var numberOfModels = 1;
  const splitResponse = await fetch(`${TOOLS_URL}/split?id=${id}`, {
    method: "POST",
  });
  numberOfModels = ((await splitResponse.json()) as splitModelsResponse)
    .numberOfModels;

  // save the original numeration of all the models
  const newNumeration = await saveOriginalNumeration(id, numberOfModels);
  if (!newNumeration) {
    console.error("Numeration error");
    deleteJobDirectory(id);
    res.status(500).send({ error: "Numeration error" });
    return;
  }

  // temporary fix for very very large structures
  //@ts-ignore
  // const wait = (ms) => {
  //   return new Promise((resolve) => setTimeout(resolve, ms));
  // };
  // await wait(5000);

  // run clean up script on  all the models
  const correctResponse = await fetch(
    `${TOOLS_URL}/correct?id=${id}&numberOfModels=${numberOfModels}`,
    {
      method: "POST",
    }
  );
  if (!correctResponse.ok) {
    deleteJobDirectory(id);
    res
      .status(500)
      .send({ error: "An error occurred while cleaning up the files." });
    return;
  }

  // annotate all the models
  const annotateResponse = await fetch(
    `${TOOLS_URL}/annotate?id=${id}&numberOfModels=${numberOfModels}`,
    {
      method: "POST",
    }
  );

  if (!annotateResponse.ok) {
    console.error("Annotation error");
    //deleteJobDirectory(id);
    res.status(500).send({ error: "Annotation error" });
    return;
  } else {
    console.log("Annotation successful.");
  }
  const annotateResult: Annotation[][] =
    (await annotateResponse.json()) as Annotation[][];

  // extract motifs
  const extractMotifsResponse = await fetch(
    `${TOOLS_URL}/extractMotifs?id=${id}&numberOfModels=${numberOfModels}`,
    {
      method: "POST",
    }
  );

  if (!extractMotifsResponse.ok) {
    console.error("Motif extraction error");
    //deleteJobDirectory(id);
    res.status(500).send({ error: "Motif extraction error" });
    return;
  } else {
    console.log("Motif extraction successful.");
  }
  const extractMotifsResult: StructuralElement[][] =
    (await extractMotifsResponse.json()) as StructuralElement[][];

  // create a metadata file for the job
  metadata.model_count = numberOfModels;
  metadata.status = "completed";

  db.query(
    createJobQuery,
    [id, originalFilename, jobname],
    async (err, result) => {
      if (err) {
        console.error(err);
        deleteJobDirectory(id);
        res.status(500).send({ error: "Database error." });
        return;
      }

      // get the first model as blob
      const blob = await fetchModelFileAsString(id, "1");

      // get the first model as json
      const pdbFile = await fetchPdbFileAsJSON(id, "1");

      // send fields from result with annotatnion and numeration for the first model
      const jobResponse: Job = {
        id: result.rows[0].id,
        original_filename: result.rows[0].original_filename,
        name: result.rows[0].name,
        metadata: metadata,
        model_number: 1,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at,
        annotation: annotateResult[0] ? annotateResult[0] : [],
        numeration: newNumeration[0]
          ? Object.fromEntries(newNumeration[0])
          : {},
        motifs: extractMotifsResult[0] ? extractMotifsResult[0] : [],
        pdb_file: pdbFile
          ? pdbFile
          : {
              atoms: [],
              seqRes: { serNum: 0, chainID: "", numRes: 0, resNames: [] },
              residues: [],
              chains: new Map(),
            },
        pdb_file_string: blob,
      };
      saveMetadata(id, metadata);
      res.status(201).json(jobResponse);
    }
  );
}

// export async function analyzeFragment(req: Request, res: Response) {
//   const id: UUID = req.body.id;
//   const residues: number[] = req.body.residues;
//   const modelNumber = req.body.modelNumber || "1";

//   const metadata = await readMetadata(id);

//   if (id.length !== 36) {
//     res.status(422).send({ error: "Invalid job ID." });
//     return;
//   }

//   if (!id || residues?.length === 0) {
//     saveMetadata(id, { ...metadata, status: "failed" });
//     res.status(400).send({ error: "ID and residue list are required." });
//     return;
//   }

//   metadata.status = "running";
//   metadata.last_used_model = parseInt(modelNumber);
//   saveMetadata(id, metadata);

//   db.query(getJobByIdQuery, [id], async (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).send({ error: "Database error." });
//       return;
//     }
//     if (result.rows.length === 0) {
//       res.status(404).send({ error: "Job not found." });
//       return;
//     }

//     const output = await analyzeStructureFragment(id, modelNumber, residues);
//     if (!output) {
//       metadata.status = "failed";
//       saveMetadata(id, metadata);
//       res.status(500).send({ error: "Structure analysis error." });
//       return;
//     }

//     const outputData: nucleotideResult[] = residues.map((res_num) => {
//       const tempNucleotide = {} as nucleotideResult;
//       tempNucleotide.residue_number = res_num;
//       tempNucleotide.metrics = output;
//       return tempNucleotide;
//     });

//     const analysisResult: Analysis_results = {
//       mode: "fragment",
//       data: outputData,
//     };

//     // save the result as json file
//     await saveResults(id, analysisResult);
//     metadata.status = "completed";
//     metadata.last_used_model = parseInt(modelNumber);
//     saveMetadata(id, metadata);

//     //load annotation json file
//     const annotation = await fetchJSONFile(
//       id,
//       `${modelNumber}_annotation.json`,
//       modelNumber
//     );
//     if (!annotation) {
//       res.status(500).send({ error: "Annotation file not found." });
//       return;
//     }

//     const numeration = await fetchJSONFile(
//       id,
//       `${modelNumber}_numeration.json`,
//       modelNumber
//     );
//     if (!numeration) {
//       res.status(500).send({ error: "Numeration file not found." });
//       return;
//     }

//     const pdbFile = await fetchPdbFileAsJSON(id, modelNumber);
//     if (!pdbFile) {
//       res.status(500).send({ error: "PDB file not found." });
//       return;
//     }

//     const file_string = await fetchModelFileAsString(id, modelNumber);
//     if (!file_string) {
//       res.status(500).send({ error: "Could not load model file." });
//       return;
//     }

//     const jobResponse: Job = {
//       id: result.rows[0].id,
//       original_filename: result.rows[0].original_filename,
//       name: result.rows[0].name,
//       metadata: metadata,
//       model_number: parseInt(modelNumber),
//       created_at: result.rows[0].created_at,
//       updated_at: result.rows[0].updated_at,
//       annotation: annotation,
//       numeration: numeration,
//       pdb_file: pdbFile,
//       pdb_file_string: file_string,
//       results: analysisResult,
//     };

//     res.status(200).json(jobResponse);
//   });
// }

export async function analyzeStructure(req: Request, res: Response) {
  res.setMaxListeners(0);
  res.setTimeout(0);

  const id: UUID = req.body.id;
  const modelNumber = req.body.modelNumber || "1";
  const residues: number[] = req.body.residues;
  const radius = req.body.radius || 5;
  const interval = req.body.interval || 1;
  var analyzeNeighborhoods = false;

  console.log(
    "Analyzing whole structure. id: ",
    id,
    " modelNumber: ",
    modelNumber,
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

  if (!Number.isInteger(parseInt(modelNumber))) {
    res.status(422).send({ error: "Invalid model number." });
    return;
  }

  if (residues?.length === 0) {
    res.status(400).send({ error: "Residue list are required." });
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

  if (parseInt(modelNumber) < 1) {
    res.status(422).send({ error: "Model number must be greater than 0." });
    return;
  }

  const metadata = await readMetadata(id);
  if (!metadata) {
    res.status(500).send({ error: "Metadata file not found." });
    return;
  }

  if (
    parseInt(modelNumber) > metadata.model_count ||
    parseInt(modelNumber) < 1
  ) {
    res.status(404).send({ error: "Model not found." });
    return;
  }

  metadata.status = "starting";
  metadata.last_used_model = parseInt(modelNumber);
  await saveMetadata(id, metadata);

  addAnalysisTask(id, modelNumber, radius, interval, metadata);

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
      model_number: parseInt(modelNumber),
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
