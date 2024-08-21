import { execSync } from 'child_process';

async function handler(command: string) {
    const output = execSync(command, { encoding: 'utf-8' }).toString();
    const splt = output.split('/\r?\n/');
    const filtered = splt.filter((line) => line !== '');
    return JSON.stringify(filtered);
}

export async function runAnnotator(filename: string) {
    
}