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

export async function uploadFile(rnaFile: File, newName: string) {
    const arrayBuffer = await rnaFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await fs.writeFile(`${JOBS_DIR}/${newName}`, buffer);
}

export async function deleteFile(filename: string) {
    await fs.unlink(`${JOBS_DIR}/${filename}`);
}

export async function deleteJobFiles(id: UUID) {
    const files = await fs.readdir(JOBS_DIR);
    const jobFiles = files.filter(file => file.startsWith(id));
    for (const file of jobFiles) {
        await fs.unlink(`${JOBS_DIR}/${file}`);
    }
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

export async function fetchPdbFile(pdbId: string) {
    const response = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
    if (!response.ok) {
        return "Error fetching PDB file";
    }
    const data = await response.blob();
    const file = new File([data], `${pdbId}.pdb`);
    return file;
}

export async function fetchAnnotationFile(id: UUID) {
    const filename = `${id}.json`;
    const data = await fs.readFile(`${JOBS_DIR}/${filename}`);
    return JSON.parse(data.toString());
}

export async function fetchPdbFileAsJSON(id: UUID) {
    const filename = `${id}.pdb`;
    const data = await fs.readFile(`${JOBS_DIR}/${filename}`, 'utf-8');
    const parsed = parsePdb(data);
    return parsed;
}

export async function analyzeStructureFragment(id: UUID, residueIds: number[]) {
    const pdbFile = await fs.readFile(`${JOBS_DIR}/${id}.pdb`, 'utf8');
    const textByLine = pdbFile.split("\n");
    var newPdbFile = "";
    textByLine.forEach((line) => {
        if (line.startsWith("ATOM") && !residueIds.includes(parseInt(line.substring(23, 26)))) {

        } else {

            newPdbFile += line + "\n";
        }
    });

    //save the new file
    await fs.writeFile(`${JOBS_DIR}/${id}_selected.pdb`, newPdbFile);

    // run clashscore
    const res = await fetch(`http://molprobity:3001/oneline-analysis?filename=${id}_selected.pdb`);
    const data = await res.json();
    return data;
}