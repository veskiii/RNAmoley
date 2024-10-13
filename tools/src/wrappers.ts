import { execSync } from 'child_process';
import { log } from 'console';
import { resolve } from 'path';
import fs from 'fs';

const JOBS_DIR = 'user_data';

interface annotatorOutput {
    sequnece?: string;
    dotbracket?: string;
}

async function handler(command: string) {
    const output = execSync(command, { encoding: 'utf-8' }).toString();
    const splt = output.split('/\r?\n/');
    const filtered = splt.filter((line) => line !== '');
    return JSON.stringify(filtered);
}

export async function runConverter(filename: string) {
    const filenameNoExt = filename.split('.')[0];
    try {
        console.log(`converting ${filename} to pdb`);
        const result = await handler(`maxit -input ${JOBS_DIR}/${filename} -output ${JOBS_DIR}/${filenameNoExt}.pdb -o 2`);
        return result;

    } catch (error) {
        console.error('Error converting file: ', error);
    }
}

export async function runAnnotator(filename: string) {
    try {
        const result = await handler(`annotator ${JOBS_DIR}/${filename}`);
        const resultSplit = result.split("\\n");
        const output: annotatorOutput = {
            sequnece: resultSplit[1],
            dotbracket: resultSplit[2]
        }
        console.log(output);

        // save output as json file
        const outputFilename = filename.split('.')[0] + '.json';
        const outputString = JSON.stringify(output);
        const outputFilePath = resolve(JOBS_DIR, outputFilename);
        fs.writeFileSync(outputFilePath, outputString);

        return output;

    } catch (error) {
        console.error('Error running annotator: ', error);
    }

}