import fs from 'fs/promises';
import multer from 'multer';
import { randomUUID } from 'crypto';
// @ts-ignore
import parsePdb from 'parse-pdb';
import type { UUID } from 'crypto';
import type { PDBFile, Metadata, metrics, Analysis_results } from "./types.js";

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['pdb', 'cif', 'mmcif'];
export const JOBS_DIR = 'public/jobs';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, JOBS_DIR);
    },
    filename: function (req, file, cb) {
        const ext = file.originalname.split('.').pop();
        const filename = `${randomUUID() + '.' + ext}`;
        cb(null, filename);
    }
});

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
    }
});

export async function uploadFileFromPDBCode(rnaFile: File, newName: string) {
    const arrayBuffer = await rnaFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(`${JOBS_DIR}/${newName}`, buffer);
}

export async function uploadFile(rnaFile: File, jobID: string, newName: string) {
    const arrayBuffer = await rnaFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, buffer);
}

export async function moveToJobDirectroy(filename: string, jobID: UUID) {
    // create directory if it does not exist
    try {
        await fs.mkdir(`${JOBS_DIR}/${jobID}`);
        await fs.mkdir(`${JOBS_DIR}/${jobID}/models`);
    } catch (err: any) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }

    return fs.rename(`${JOBS_DIR}/${filename}`, `${JOBS_DIR}/${jobID}/${filename}`);
}

// Saves a JSON file to the models directory
export async function saveJSONFileModels(data: any, jobID: string, newName: string) {
    await fs.writeFile(`${JOBS_DIR}/${jobID}/models/${newName}`, JSON.stringify(data));
}

// Saves a JSON file to the job's root directory
export async function saveJSONFileRoot(data: any, jobID: string, newName: string) {
    await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, JSON.stringify(data));
}

export async function saveMetadata(jobID: UUID, metadata: Metadata) {
    await fs.writeFile(`${JOBS_DIR}/${jobID}/metadata.json`, JSON.stringify(metadata), { flag: 'w' });
}

export async function readMetadata(jobID: UUID): Promise<Metadata> {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/metadata.json`);
    return JSON.parse(data.toString());
}

export async function saveResults(jobID: UUID, results: Analysis_results) {
    await fs.writeFile(`${JOBS_DIR}/${jobID}/results.json`, JSON.stringify(results));
}

export async function readResults(jobID: UUID): Promise<Analysis_results | null> {
    try {
        const data = await fs.readFile(`${JOBS_DIR}/${jobID}/results.json`);
        return JSON.parse(data.toString());
    } catch (error: any) {
        if (error.code === 'ENOENT') {
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
    await fs.rm(`${JOBS_DIR}/${id}`, { recursive: true });
}

export const generateFilename = (id: UUID, file: File) => {
    const extension = file.name.split('.').pop();
    return `${id}.${extension}`;
}

export function validateFile(file: Express.Multer.File, maxFileSize: number, allowedExtensions: string[]) {
    if (file.size > maxFileSize) {
        return 'File is too large';
    }
    if (!allowedExtensions.includes(file.filename.split('.').pop() || '')) {
        return 'Invalid file type';
    }
    return null;
}

export async function fetchPdbFile(pdbCode: string) {
    var response = await fetch(`https://files.rcsb.org/download/${pdbCode}.pdb`);

    // fallback to cif if pdb is not available
    if (!response.ok) {
        var response = await fetch(`https://files.rcsb.org/download/${pdbCode}.cif`);
        if (!response.ok) {
            return "Error fetching PDB file: neither PDB nor CIF file found on RCSB server.";
        }
    }

    const data = await response.blob();
    const file = new File([data], `${pdbCode}.pdb`);
    return file;
}

export async function fetchJSONFile(jobID: UUID, filename: string, modelNumber?: string) {
    if (modelNumber) {
        const data = await fs.readFile(`${JOBS_DIR}/${jobID}/models/${filename}`);
        return JSON.parse(data.toString());
    } else {
        const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${filename}`);
        return JSON.parse(data.toString());
    }
}

export async function fetchPdbFileAsJSON(jobID: UUID, modelNumber?: string): Promise<PDBFile | null> {
    try {
        const filename = modelNumber ? `${modelNumber}.pdb` : `${jobID}.pdb`;
        const filePath = modelNumber ? `${JOBS_DIR}/${jobID}/models/${filename}` : `${JOBS_DIR}/${jobID}/${filename}`;
        const data = await fs.readFile(filePath, 'utf-8');
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
        if (error.code === 'ENOENT') {
            return '';
        } else {
            throw error;
        }
    }
}

export async function saveOriginalNumeration(jobID: UUID, numberOfModels: number) {
    const numeration = [];
    for (let i = 1; i <= numberOfModels; i++) {
        const pdbFile = await fetchPdbFileAsJSON(jobID, i.toString());
        if (!pdbFile) {
            console.error(`PDB file (Model ${i}) not found while saving its numeration.`);
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
        saveJSONFileModels(Object.fromEntries(newNumeration), jobID, `${i}_numeration.json`);
    }

    return numeration;
}

export async function analyzeStructureFragment(jobID: UUID, modelNumber: string, residueIds: number[]): Promise<metrics> {
    const pdbFile = await fs.readFile(`${JOBS_DIR}/${jobID}/models/${modelNumber}.pdb`, 'utf8');
    const textByLine = pdbFile.split("\n");
    var newPdbFile = "";
    textByLine.forEach((line) => {
        if (line.startsWith("ATOM") && !residueIds.includes(parseInt(line.substring(23, 26)))) {

        } else {

            newPdbFile += line + "\n";
        }
    });

    //save the new file
    await fs.writeFile(`${JOBS_DIR}/${jobID}/${jobID}_selected.pdb`, newPdbFile);

    // run clashscore
    const res = await fetch(`http://molprobity:3001/oneline-analysis?filename=/${jobID}/${jobID}_selected.pdb`);
    const data: metrics = await res.json() as metrics;
    return data;
}