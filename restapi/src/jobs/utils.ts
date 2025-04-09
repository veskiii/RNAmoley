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

export async function readMetadata(jobID: UUID): Promise<Metadata> {
  const data = await fs.readFile(`${JOBS_DIR}/${jobID}/metadata.json`);
  return JSON.parse(data.toString());
}

export async function saveResults(jobID: UUID, results: Analysis_results) {
  await fs.writeFile(
    `${JOBS_DIR}/${jobID}/results.json`,
    JSON.stringify(results)
  );
}

export async function readResults(
  jobID: UUID
): Promise<Analysis_results | null> {
  try {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/results.json`);
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
  try {
    await fs.unlink(`${JOBS_DIR}/${id}.zip`);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  await fs.rm(`${JOBS_DIR}/${id}`, { recursive: true });
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
  modelNumber?: string
) {
  if (modelNumber) {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/models/${filename}`);
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

    const newNumeration = new Map<string, [number, string]>();
    var originalNumeration: Array<number> = [];
    var number = 1;

    pdbFile.atoms.forEach((atom) => {
      if (atom.resSeq != originalNumeration.at(-1)) {
        originalNumeration.push(atom.resSeq);
        newNumeration.set(number.toString(), [atom.resSeq, atom.chainID]);
        number++;
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

export async function analyzeStructureFragment(
  jobID: UUID,
  modelNumber: string,
  residueIds: number[]
): Promise<metrics> {
  const pdbFile = await fs.readFile(
    `${JOBS_DIR}/${jobID}/models/${modelNumber}.pdb`,
    "utf8"
  );
  const textByLine = pdbFile.split("\n");
  var newPdbFile = "";
  textByLine.forEach((line) => {
    if (
      line.startsWith("ATOM") &&
      !residueIds.includes(parseInt(line.substring(23, 26)))
    ) {
    } else {
      newPdbFile += line + "\n";
    }
  });

  //save the new file
  await fs.writeFile(`${JOBS_DIR}/${jobID}/${jobID}_selected.pdb`, newPdbFile);

  // run clashscore
  const res = await fetch(
    `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/${jobID}_selected.pdb`
  );
  const data: metrics = (await res.json()) as metrics;
  return data;
}

const findResidueInResidueAnalysis = (
  residues: residueMetrics[],
  residueNumber: number
): residueMetrics | undefined => {
  return residues.find((residue) => {
    const match = residue.residue.match(/\s+(\d+)\s+/);
    return match ? Number(match[1]) === residueNumber : false;
  });
};

const processInBatches = async (
  tasks: (() => Promise<any>)[],
  batchSize: number
) => {
  let results: any[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((task) => task());
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  return results;
};

export async function analyzeStructureWalkingSphere(
  jobID: UUID,
  modelNumber: string,
  radius: number,
  interval: number,
  metadata: Metadata
): Promise<Analysis_results> {
  // fetch metadata
  metadata.status = "running";
  await saveMetadata(jobID, metadata);

  // call tools to create a directory of pdb files
  const walkingSphere = await fetch(
    `${TOOLS_URL}/sphere?id=${jobID}&modelNumber=${modelNumber}&radius=${radius}&interval=${interval}`,
    { method: "POST" }
  );
  if (!walkingSphere.ok) {
    metadata.status = "failed";
    await saveMetadata(jobID, metadata);
    throw new Error("Sphere error: " + walkingSphere.statusText);
  }

  // run residue-analysis
  const residueAnalysis = await fetch(
    `${MOLPROBITY_URL}/residue-analysis?filename=/${jobID}/models/1.pdb`, // TODO: hardcoded model number
    { keepalive: true }
  );
  if (!residueAnalysis.ok) {
    metadata.status = "failed";
    await saveMetadata(jobID, metadata);
    throw new Error("Residue analysis error: " + residueAnalysis.statusText);
  }

  const residueAnalysisArray =
    (await residueAnalysis.json()) as residueMetrics[];

  // for each file in the directory, run clashscore
  const result = {} as Analysis_results;
  result.mode = "full";
  result.data = [];

  const files = await fs.readdir(`${JOBS_DIR}/${jobID}/sphere`);
  const promises = files.map((file) => async () => {
    try {
      console.log(
        `Fetching ${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/sphere/${file}`
      );
      const res = await fetch(
        `${MOLPROBITY_URL}/oneline-analysis?filename=/${jobID}/sphere/${file}`,
        { keepalive: true }
      );

      if (!res.ok) {
        throw new Error(`Error analyzing file ${file}: ${res.statusText}`);
      } else {
        console.log("Molprobity analysis successful.");
      }

      const tmpMetrics: metrics = (await res.json()) as metrics;
      const nucleotideNumber = parseInt(file.split(".")[0] ?? "");
      const residueMetrics = findResidueInResidueAnalysis(
        residueAnalysisArray,
        nucleotideNumber
      );

      return {
        residue_number: nucleotideNumber,
        metrics: tmpMetrics,
        residueMetrics: residueMetrics,
      } as nucleotideResult;
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
      return null;
    }
  });

  const promisesResults = await processInBatches(promises, 10);

  const results = promisesResults
    .filter(
      (p): p is PromiseFulfilledResult<nucleotideResult> =>
        p.status === "fulfilled"
    )
    .map((p) => p.value)
    .filter((result) => result !== null);

  // sort results by residue number
  results.sort((a, b) => a.residue_number - b.residue_number);

  result.data.push(...results);

  metadata.status = "completed";
  await saveMetadata(jobID, metadata);

  return result;
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
