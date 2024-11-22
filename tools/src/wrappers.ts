import { execSync } from 'child_process';
import { resolve } from 'path';
import fs from "node:fs/promises";

const JOBS_DIR = 'user_data';

interface Annotation {
    name: string | undefined;
    sequnece: string | undefined;
    dotbracket: string | undefined;
}

async function handler(command: string) {
    const output = execSync(command, { encoding: 'utf-8' }).toString();
    const splt = output.split('/\r?\n/');
    const filtered = splt.filter((line) => line !== '');
    return JSON.stringify(filtered);
}

export async function runConverter(id: string, filename: string) {
    const filenameNoExt = filename.split('.')[0];
    try {
        console.log(`converting ${filename} to pdb`);
        const result = await handler(`maxit -input ${JOBS_DIR}/${id}/${filename} -output ${JOBS_DIR}/${id}/${filenameNoExt}.pdb -o 2`);
        return result;

    } catch (error) {
        console.error('Error converting file: ', error);
    }
}

export async function runAnnotator(id: string, filename: string) {
    try {
        const result = await handler(`annotator ${JOBS_DIR}/${id}/${filename}`);

        const resultSplit = result.trim().substring(2, result.length - 2).split("\\n");

        console.log(result);


        // parse output as list of annotations
        // every 3 lines is a new annotation
        const output: Annotation[] = [];
        for (let i = 0; i < resultSplit.length - 1; i += 3) {
            output.push({
                name: resultSplit[i],
                sequnece: resultSplit[i + 1],
                dotbracket: resultSplit[i + 2]
            });
        }
        console.log(output);

        // save output as json file
        // const outputFilename = filename.split('.')[0] + '.json';
        const outputFilename = 'annotation.json';
        const outputString = JSON.stringify(output);
        const outputFilePath = resolve(`${JOBS_DIR}/${id}`, outputFilename);
        await fs.writeFile(outputFilePath, outputString);

        return output;

    } catch (error) {
        console.error('Error running annotator: ', error);
    }

}