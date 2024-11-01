import fs from 'fs/promises';
import multer from 'multer';
import { randomUUID } from 'crypto';
// @ts-ignore
import parsePdb from 'parse-pdb';
import type { UUID } from 'crypto';

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

export async function uploadFile(rnaFile: File, jobID: string, newName: string) {
    const arrayBuffer = await rnaFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, buffer);
}

export async function moveToJobDirectroy(filename: string, jobID: UUID) {
    return fs.rename(JOBS_DIR, `${JOBS_DIR}/${jobID}/${filename}`);
}

export async function uploadJSONFile(data: any, jobID: string, newName: string) {
    await fs.writeFile(`${JOBS_DIR}/${jobID}/${newName}`, JSON.stringify(data));
}

export async function deleteFile(filename: string) {
    await fs.unlink(`${JOBS_DIR}/${filename}`);
}

// export async function deleteJobFiles(jobID: UUID) {
//     const files = await fs.readdir(JOBS_DIR);
//     const jobFiles = files.filter(file => file.startsWith(jobID));
//     for (const file of jobFiles) {
//         await fs.unlink(`${JOBS_DIR}/${file}`);
//     }
// }

export async function deleteJobDirectory(id: UUID) {
    await fs.rmdir(`${JOBS_DIR}/${id}`, { recursive: true });
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
    const response = await fetch(`https://files.rcsb.org/download/${pdbCode}.pdb`);
    if (!response.ok) {
        return "Error fetching PDB file";
    }
    const data = await response.blob();
    const file = new File([data], `${pdbCode}.pdb`);
    return file;
}

export async function fetchJSONFile(jobID: UUID, filename: string) {
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${filename}`);
    return JSON.parse(data.toString());
}

export async function fetchPdbFileAsJSON(jobID: UUID) {
    const filename = `${jobID}.pdb`;
    const data = await fs.readFile(`${JOBS_DIR}/${jobID}/${filename}`, 'utf-8');
    const parsed = parsePdb(data);
    return parsed;
}

export async function analyzeStructureFragment(jobID: UUID, residueIds: number[]) {
    const pdbFile = await fs.readFile(`${JOBS_DIR}/${jobID}/${jobID}.pdb`, 'utf8');
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
    const res = await fetch(`http://molprobity:3001/oneline-analysis?filename=${jobID}/${jobID}_selected.pdb`);
    const data = await res.json();
    return data;
}