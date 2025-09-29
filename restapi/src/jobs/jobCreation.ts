
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
  }>(
    "create-job",
    async (job) => {
      const { id, original_filename, original_extension, new_filename, name, metadata } = job.data;

      await performJobCreation({
        id,
        original_filename,
        original_extension,
        new_filename,
        name,
        metadata
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
  metadata: Metadata
) {
  await createJobQueue.add("create-job", {
    id,
    original_filename,
    original_extension,
    new_filename,
    name,
    metadata
  });
}


export const performJobCreation = async (job:NewJob) => {
    var pdbFile;

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
    const numberOfModels = await splitFileIntoModels(job.id, job.original_extension);
    console.log(`Number of models: ${numberOfModels} in job ${job.id}`);

    job.metadata.model_count = numberOfModels;
    await saveMetadata(job.id, job.metadata);

    var annotations = await annotateModels(job.id, job.metadata, numberOfModels, job.original_extension);
    if (!annotations) {
        handleAnalysisError(job.id, job.metadata, "Failed to annotate models.");
        return;
    }


    // Correct models
    // await correctModels(job.id, job.metadata, numberOfModels, job.original_extension);

    if (job.original_extension !== "pdb") {
      // convert models to PDB
      for (let i = 0; i < numberOfModels; i++) {
        const modelPath = `models/${i + 1}.${job.original_extension}`;
        await convertToPDB(job.id, job.metadata, modelPath);
      }
    }

    // var annotations = await annotateModels(job.id, job.metadata, numberOfModels, job.original_extension);
    // if (!annotations) {
    //     handleAnalysisError(job.id, job.metadata, "Failed to annotate models.");
    //     return;
    // }

    var structuralElements = await extractStructuralElements(job.id, job.metadata, numberOfModels);
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

const splitFileIntoModels = async (jobId : UUID, sourceFormat: string) : Promise<number> => {
    var numberOfModels = 1;
      const splitResponse = await fetch(`${TOOLS_URL}/split?id=${jobId}&sourceFormat=${sourceFormat}`, {
        method: "POST",
      });
      numberOfModels = ((await splitResponse.json()) as splitModelsResponse)
        .numberOfModels;
    return numberOfModels;
}

const correctModels = async (jobId: UUID, metadata: Metadata, numberOfModels: number, sourceFormat: string) => {
    const correctResponse = await fetch(
        `${TOOLS_URL}/correct?id=${jobId}&numberOfModels=${numberOfModels}&sourceFormat=${sourceFormat}`,
        {
            method: "POST",
        }
    );
    if (!correctResponse.ok) {
        handleAnalysisError(jobId, metadata, "Model correction failed.");
        return;
    }
}

const annotateModels = async (jobId: UUID, metadata: Metadata, numberOfModels: number, sourceFormat: string): Promise<Annotation[][] | undefined> => {
    const annotateResponse = await fetch(
        `${TOOLS_URL}/annotate?id=${jobId}&numberOfModels=${numberOfModels}&sourceFormat=${sourceFormat}`,
        {
          method: "POST",
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

const extractStructuralElements = async (jobId: UUID, metadata: Metadata, numberOfModels: number) : Promise<StructuralElement[][] | undefined> => {
    const extractMotifsResponse = await fetch(
        `${TOOLS_URL}/extractMotifs?id=${jobId}&numberOfModels=${numberOfModels}`,
        {
          method: "POST",
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