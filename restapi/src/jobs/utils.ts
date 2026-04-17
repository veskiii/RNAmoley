import fs from "fs/promises";
import { createWriteStream } from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
// @ts-ignore
import parsePdb from "parse-pdb";
import type { UUID } from "crypto";
import type {
  PDBFile,
  Metadata,
  metrics,
  Analysis_results,
  Job,
  nucleotideResult,
  residueMetrics,
} from "./types.js";
import archiver from "archiver";
import { MOLPROBITY_URL, TOOLS_URL } from "../server.js";

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["pdb", "cif", "mmcif"];
export const JOBS_DIR = "public/jobs";
export const DEMO_FILES_DIR = "public/demo_files";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, JOBS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".").pop();
    const filename = `${randomUUID() + "." + ext}`;
    cb(null, filename);
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export async function uploadFileFromPDBCode(rnaFile: File, newName: string) {
  const arrayBuffer = await rnaFile.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  console.log(`Writing file at ${JOBS_DIR}/${newName}`);
  await fs.writeFile(`${JOBS_DIR}/${newName}`, buffer);
}

export async function uploadFile(
  rnaFile: File,
  jobID: string,
  newName: string
) {
  const arrayBuffer = await rnaFile.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, buffer);
}

export async function getDemoFiles(filename: string) {
  const data = await fs.readFile(`${DEMO_FILES_DIR}/${filename}`);
  return data;
}

export async function moveToJobDirectroy(filename: string, jobID: UUID) {
  // create directory if it does not exist
  try {
    console.log(`Creating directory ${JOBS_DIR}/${jobID}`);
    console.log(`Creating directory ${JOBS_DIR}/${jobID}/models`);
    await fs.mkdir(`${JOBS_DIR}/${jobID}`);
    await fs.mkdir(`${JOBS_DIR}/${jobID}/models`);
  } catch (err: any) {
    if (err.code !== "EEXIST") {
      throw err;
    }
    console.log(err);
  }
  console.log(
    `Moving ${JOBS_DIR}/${filename} to ${JOBS_DIR}/${jobID}/${filename}`
  );
  return fs.rename(
    `${JOBS_DIR}/${filename}`,
    `${JOBS_DIR}/${jobID}/${filename}`
  );
}

// Saves a JSON file to the models directory
export async function saveJSONFileModels(
  data: any,
  jobID: string,
  newName: string
) {
  await fs.writeFile(
    `${JOBS_DIR}/${jobID}/models/${newName}`,
    JSON.stringify(data)
  );
}

// Saves a JSON file to the job's root directory
export async function saveJSONFileRoot(
  data: any,
  jobID: string,
  newName: string
) {
  await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, JSON.stringify(data));
}

export async function saveMetadata(jobID: UUID, metadata: Metadata) {
  await fs.writeFile(
    `${JOBS_DIR}/${jobID}/metadata.json`,
    JSON.stringify(metadata),
    { flag: "w" }
  );
}

export function updateModelMetadata(
  metadata: Metadata, 
  modelNumber: string, 
  status: `created` | `starting` | `running` | `completed` | `failed` | `sim_starting` | `sim_running` | `sim_finished` | `sim_analyzing` | `sim_completed` | `sim_failed`,
  errorMessage?: string) {
  if (!metadata.resultsStatus) {
    metadata.resultsStatus = {};
  }
  metadata.resultsStatus[modelNumber] = { modelNumber, status, error_message: errorMessage };
  return metadata;
}

export async function readMetadata(jobID: UUID): Promise<Metadata> {
  const data = await fs.readFile(`${JOBS_DIR}/${jobID}/metadata.json`);
  return JSON.parse(data.toString());
}

export async function saveResults(
  jobID: UUID,
  modelNumber: string,
  results: Analysis_results,
  resultsSuffix = "_results"
) {
  await fs.writeFile(
    `${JOBS_DIR}/${jobID}/${modelNumber}${resultsSuffix}.json`,
    JSON.stringify(results)
  );
}

export async function readResults(
  jobID: UUID,
  modelNumber: string,
  resultsSuffix = "_results"
): Promise<Analysis_results | null> {
  try {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${modelNumber}${resultsSuffix}.json`);
    return JSON.parse(data.toString());
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    } else {
      throw error;
    }
  }
}

// not used anymore
export async function deleteFile(filename: string) {
  await fs.unlink(`${JOBS_DIR}/${filename}`);
}

// Removes the job directory and all its contents, used when deleting a job or an error occurs
export async function deleteJobDirectory(id: UUID) {
  // check if zip file exists and delete it
  console.log(`Deleting job directory ${JOBS_DIR}/${id}`);
  // try {
  //   await fs.unlink(`${JOBS_DIR}/${id}.zip`);
  // } catch (err: any) {
  //   if (err.code !== "ENOENT") {
  //     throw err;
  //   }
  // }
  // await fs.rm(`${JOBS_DIR}/${id}`, { recursive: true });
}

export const generateFilename = (id: UUID, file: File) => {
  const extension = file.name.split(".").pop();
  return `${id}.${extension}`;
};

export function validateFile(
  file: Express.Multer.File,
  maxFileSize: number,
  allowedExtensions: string[]
) {
  if (file.size > maxFileSize) {
    return "File is too large";
  }
  if (!allowedExtensions.includes(file.filename.split(".").pop() || "")) {
    return "Invalid file type";
  }
  return null;
}

export async function fetchPdbFile(pdbCode: string) {
  var filename = `${pdbCode}.pdb`;
  var response = await fetch(`https://files.rcsb.org/download/${pdbCode}.pdb`);

  // fallback to cif if pdb is not available
  if (!response.ok) {
    var response = await fetch(
      `https://files.rcsb.org/download/${pdbCode}.cif`
    );
    filename = `${pdbCode}.cif`;
    if (!response.ok) {
      return "Error fetching PDB file: neither PDB nor CIF file found on RCSB server.";
    }
  }

  const data = await response.blob();
  const file = new File([data], filename);
  return file;
}

export async function fetchJSONFile(
  jobID: UUID,
  filename: string,
  modelNumber?: string,
  modelsDir = "models"
) {
  if (modelNumber) {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${modelsDir}/${filename}`);
    return JSON.parse(data.toString());
  } else {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${filename}`);
    return JSON.parse(data.toString());
  }
}

export async function fetchPdbFileAsJSON(
  jobID: UUID,
  modelNumber?: string
): Promise<PDBFile | null> {
  try {
    const filename = modelNumber ? `${modelNumber}.pdb` : `${jobID}.pdb`;
    const filePath = modelNumber
      ? `${JOBS_DIR}/${jobID}/models/${filename}`
      : `${JOBS_DIR}/${jobID}/${filename}`;
    const data = await fs.readFile(filePath, "utf-8");
    const parsed: PDBFile = parsePdb(data);
    return parsed;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchModelFileAsString(jobID: UUID, modelNumber: string) {
  const filename = `${modelNumber}.pdb`;
  try {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/models/${filename}`);
    return data.toString();
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return "";
    } else {
      throw error;
    }
  }
}

export async function saveOriginalNumeration(
  jobID: UUID,
  numberOfModels: number
) {
  const numeration = [];
  for (let i = 1; i <= numberOfModels; i++) {
    const pdbFile = await fetchPdbFileAsJSON(jobID, i.toString());
    if (!pdbFile) {
      console.error(
        `PDB file (Model ${i}) not found while saving its numeration.`
      );
      return;
    }

    const newNumeration = new Map<string, [number, string, string]>();
    var originalNumeration: Array<[number, string]> = [];
    var number = 1;
    var chainLetter = "A";

    pdbFile.atoms.forEach((atom) => {
      if (["A", "C", "G", "U", ""].includes(atom.resName)) {
        if (atom.resSeq != originalNumeration.at(-1)?.[0]) {
          if (atom.chainID !== originalNumeration.at(-1)?.[1]) {
            chainLetter = String.fromCharCode(
              chainLetter.charCodeAt(0) + 1
            );
          }
          originalNumeration.push([atom.resSeq, atom.chainID]);
          newNumeration.set(number.toString(), [atom.resSeq, atom.chainID, chainLetter]);
          number++;
          
        }
      }
    });

    numeration.push(newNumeration);
    saveJSONFileModels(
      Object.fromEntries(newNumeration),
      jobID,
      `${i}_numeration.json`
    );
  }

  return numeration;
}

// zip whole job directory and return a blob
export async function createZip(jobID: UUID) {
  const zipPath = `${JOBS_DIR}/${jobID}.zip`;

  // delete old archive if exists
  try {
    await fs.access(zipPath);
    await fs.unlink(zipPath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  const output = createWriteStream(zipPath);
  const archive = archiver("zip", {
    zlib: { level: 9 },
    forceZip64: true,
    store: false,
  });

  archive.on("warning", function (err) {
    if (err.code === "ENOENT") {
      console.log(err);
    } else {
      // throw error
      throw err;
    }
  });

  archive.on("error", function (err) {
    throw err;
  });

  archive.pipe(output);
  archive.directory(`${JOBS_DIR}/${jobID}`, false);

  // Wait for the archive to finish writing
  // https://github.com/archiverjs/node-archiver/issues/476#issuecomment-1792896115
  const thisArchive = archive;
  const streamingCompletedPromise = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    thisArchive.on("error", (err: Error) => reject(err));
  });
  const originalArchiverFinalize = archive.finalize;
  archive.finalize = async () => {
    await originalArchiverFinalize.call(thisArchive);
    await streamingCompletedPromise;
  };

  await archive.finalize();

  return `${process.cwd()}/${zipPath}`;
}

// export async function deleteOldFiles(age: number = 14 * 24 * 60 * 60 * 1000) {
//     const files = await fs.readdir(JOBS_DIR);
//     const now = Date.now();
//     const promises = files.map(async (file) => {
//         const stats = await fs.stat(`${JOBS_DIR}/${file}`);
//         if (now - stats.mtimeMs > age) {
//             await fs.rm(`${JOBS_DIR}/${file}`, { recursive: true });
//         }
//     });
//     await Promise.all(promises);
// }
