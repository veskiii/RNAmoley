
import type { UUID } from "crypto";
import db from "../db/index.js";
import { TOOLS_URL } from "../server.js";
import type { NewJob, Annotation, splitModelsResponse, StructuralElement, Metadata } from "./types.js";
import {
  fetchPdbFileAsJSON,
  saveMetadata,
  saveOriginalNumeration
} from "./utils.js";
import { Queue, Worker } from "bullmq";
import { createJobQuery } from "./queries.js";

interface OriginalFileInspection {
  fileFormat: "pdb" | "cif" | "unknown";
  containsOnlyRNA: boolean;
  hasRNA: boolean;
  hasProtein: boolean;
  hasDNA: boolean;
  hasOtherNonWaterComponents: boolean;
  hasWater: boolean;
  observedResidues: string[];
  nonRNAContents: string[];
  notes: string[];
}

export const createJobQueue = new Queue("create-job", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

export function createJobCreationWorker() {
  const worker = new Worker<{
      id: UUID;
      original_filename: string;
      original_extension: string;
      new_filename: string;
      name: string;
      metadata: Metadata;
      modelsDir?: string;
  }>(
    "create-job",
    async (job) => {
      const { id, original_filename, original_extension, new_filename, name, metadata, modelsDir = "models" } = job.data;

      await performJobCreation({
        id,
        original_filename,
        original_extension,
        new_filename,
        name,
        metadata,
        modelsDir
      });
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

export async function addCreateJobTask(
  id: UUID,
  original_filename: string,
  original_extension: string,
  new_filename: string,
  name: string,
  metadata: Metadata,
  modelsDir = "models"
) {
  await createJobQueue.add("create-job", {
    id,
    original_filename,
    original_extension,
    new_filename,
    name,
    metadata,
    modelsDir
  });
}


export const performJobCreation = async (job:NewJob & { modelsDir?: string }) => {
    const modelsDir = job.modelsDir || "models";
    var pdbFile;

  const originalInspection = await inspectOriginalFileComposition(job.id, job.new_filename, job.metadata);
  if (originalInspection) {
    job.metadata.containsNonRNA = !originalInspection.containsOnlyRNA;
    job.metadata.nonRNAContents = originalInspection.nonRNAContents;
    await saveMetadata(job.id, job.metadata);
  }

    // Convert to PDB if needed
    if (job.original_extension != "pdb") {
        await convertToPDB(job.id, job.metadata, job.new_filename);
    }

    // Check if PDB file exists
    pdbFile = await fetchPdbFileAsJSON(job.id);
    if (!pdbFile) {
        handleAnalysisError(job.id, job.metadata, "Failed to fetch PDB file.");
        return;
    }
    else {
        console.log(`PDB file for job ${job.id} fetched successfully.`);
    }

    // Split file into models
    const modelNumbers = await splitFileIntoModels(job.id, job.metadata, job.original_extension, modelsDir);
    console.log(`Number of models: ${modelNumbers} in job ${job.id}`);

    job.metadata.models = modelNumbers;
    await saveMetadata(job.id, job.metadata);

    var annotations = await annotateModels(job.id, job.metadata, modelNumbers, job.original_extension, modelsDir);
    if (!annotations) {
        handleAnalysisError(job.id, job.metadata, "Failed to annotate models.");
        return;
    }


    // Correct models
    // await correctModels(job.id, job.metadata, numberOfModels, job.original_extension, modelsDir);

    if (job.original_extension !== "pdb") {
      // convert models to PDB
      for (const modelNumber of modelNumbers) {
        const modelPath = `${modelsDir}/${modelNumber}.${job.original_extension}`;
        await convertToPDB(job.id, job.metadata, modelPath);
      }
    }

    // var annotations = await annotateModels(job.id, job.metadata, numberOfModels, job.original_extension, modelsDir);
    // if (!annotations) {
    //     handleAnalysisError(job.id, job.metadata, "Failed to annotate models.");
    //     return;
    // }

    var structuralElements = await extractStructuralElements(job.id, job.metadata, modelNumbers, modelsDir);
    if (!structuralElements) {
        handleAnalysisError(job.id, job.metadata, "Failed to extract structural elements.");
        return;
    }

    writeJobToDatabase(job.id, job.original_filename, job.name, job.metadata);
}

const convertToPDB = async (jobId: UUID, metadata: Metadata, newFilename: string) => {
    const convertResponse = await fetch(
        `${TOOLS_URL}/convert?id=${jobId}&filename=${newFilename}`,
        {
        method: "POST",
        }
    );
    
    if (!convertResponse.ok) {
        handleAnalysisError(jobId, metadata, "CIF to PDB conversion failed.");
        console.error("Conversion error");
        return;
    } else {
        console.log(`Conversion for job ${jobId} successful.`);
    }
}

const inspectOriginalFileComposition = async (
  jobId: UUID,
  filename: string,
  metadata: Metadata
): Promise<OriginalFileInspection | undefined> => {
  const inspectResponse = await fetch(
    `${TOOLS_URL}/inspectOriginal?id=${jobId}&filename=${filename}`,
    {
      method: "POST",
    }
  );

  if (!inspectResponse.ok) {
    handleAnalysisError(jobId, metadata, "Original file inspection failed.");
    return;
  }

  return (await inspectResponse.json()) as OriginalFileInspection;
};

const splitFileIntoModels = async (jobId : UUID, metadata : Metadata,sourceFormat: string, modelsDir = "models") : Promise<number[]> => {
  const splitResponse = await fetch(`${TOOLS_URL}/split?id=${jobId}&sourceFormat=${sourceFormat}&modelsDir=${modelsDir}`, {
    method: "POST",
  });
  if (!splitResponse.ok) {
    handleAnalysisError(jobId, metadata, "Model splitting failed.");
    return [];
  }
  const splitResponseJson = ((await splitResponse.json()) as splitModelsResponse);
  const modelNumbers = splitResponseJson.modelNumbers;
  return modelNumbers;
}

const correctModels = async (jobId: UUID, metadata: Metadata, modelNumbers: (number | string)[], sourceFormat: string, modelsDir = "models") => {
    const correctResponse = await fetch(
        `${TOOLS_URL}/correct?id=${jobId}&sourceFormat=${sourceFormat}&modelsDir=${modelsDir}`,
        {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ modelNumbers }),
        }
    );
    if (!correctResponse.ok) {
        handleAnalysisError(jobId, metadata, "Model correction failed.");
        return;
    }
}

const annotateModels = async (jobId: UUID, metadata: Metadata, modelNumbers: (number | string)[], sourceFormat: string, modelsDir = "models"): Promise<Annotation[][] | undefined> => {
    const annotateResponse = await fetch(
        `${TOOLS_URL}/annotate?id=${jobId}&sourceFormat=${sourceFormat}&modelsDir=${modelsDir}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ modelNumbers }),
        }
      );
    
      if (!annotateResponse.ok) {
        handleAnalysisError(jobId, metadata, "Annotation failed.");
        return undefined;
      } else {
        console.log(`Annotation for job ${jobId} successful.`);
      }
      const annotateResult: Annotation[][] =
        (await annotateResponse.json()) as Annotation[][];
      return annotateResult;
}

const extractStructuralElements = async (jobId: UUID, metadata: Metadata, modelNumbers: (number | string)[], modelsDir = "models") : Promise<StructuralElement[][] | undefined> => {
    const extractMotifsResponse = await fetch(
        `${TOOLS_URL}/extractMotifs?id=${jobId}&modelsDir=${modelsDir}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ modelNumbers }),
        }
      );
    
      if (!extractMotifsResponse.ok) {
        handleAnalysisError(jobId, metadata, "Motif extraction failed.");
        return undefined;
      } else {
        console.log(`Motif extraction for job ${jobId} successful.`);
      }
      const extractMotifsResult: StructuralElement[][] =
        (await extractMotifsResponse.json()) as StructuralElement[][];
    return extractMotifsResult;
}

const writeJobToDatabase = (id: UUID, original_filename: string, name: string, metadata: Metadata) => {
  db.query(
    createJobQuery,
    [id, original_filename, name],
    (err, result) => {
      if (err) {
        console.error("Error writing job to database:", err);
        handleAnalysisError(id, metadata, "Database write failed.");
        return;
      }
      console.log(`Job ${id} successfully written to database.`);
      metadata.status = "created";
      saveMetadata(id, metadata);

    }
  )
}

const handleAnalysisError = (jobId: UUID, metadata: Metadata, error: string) => {
    console.error(`Error in analysis job ${jobId}: ${error}`);

    metadata.status = "failed";
    metadata.error_message = error;
    saveMetadata(jobId, metadata);
}