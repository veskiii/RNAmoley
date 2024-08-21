import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['pdb', 'cif', 'mmcif'];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/jobs");
    },
    filename: function (req, file, cb) {
        const ext = file.originalname.split('.').pop();
        const filename = `${uuidv4() + '.' + ext}`;
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

    await fs.writeFile(`public/jobs/${newName}`, buffer);
}

export async function deleteFile(filename: string) {
    await fs.unlink(`public/jobs/${filename}`);
}

export const generateFilename = (id: string, file: File) => {
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