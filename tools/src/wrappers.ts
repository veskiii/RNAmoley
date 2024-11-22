import { execSync, spawnSync } from 'child_process';
import { resolve } from 'path';
import fs from "node:fs/promises";

const JOBS_DIR = 'user_data';

interface Annotation {
    name: string | undefined;
    sequnece: string | undefined;
    dotbracket: string | undefined;
}

async function formatOutput(output: string) {
    const splt = output.split('/\r?\n/');
    const filtered = splt.filter((line) => line !== '');
    return JSON.stringify(filtered);
}

export async function runConverter(id: string, filename: string) {
    const filenameNoExt = filename.split('.')[0];
    console.log(`converting ${filename} to pdb`);
    const maxit = spawnSync('maxit', [`-input ${JOBS_DIR}/${id}/${filename}`, `-output ${JOBS_DIR}/${id}/${filenameNoExt}.pdb`, '-o 2']);
    if (maxit.error) {
        console.error('Error running maxit: ', maxit.error);
        return;
    }

    const result = await formatOutput(maxit.stdout.toString());

    return result;
}

export async function splitModels(id: string, filename: string) {
    console.log(`splitting ${filename} into models`);

    const split = spawnSync('Spearate.py', [`${JOBS_DIR}/${id}/${filename}`, `${JOBS_DIR}/${id}/models`]);
    if (split.error) {
        console.error('Error running split: ', split.error);
        return;
    }
    const result = await formatOutput(split.stdout.toString());

    return result;
}

export async function runAnnotator(id: string, modelNumber: string = '1') {
    try {
        const annotator = spawnSync('annotator', [`${JOBS_DIR}/${id}/models/${modelNumber}.pdb`], { encoding: 'utf-8' });
        const result = await formatOutput(annotator.stdout.toString());

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
        const outputFilename = `${modelNumber}_annotation.json`;
        const outputString = JSON.stringify(output);
        const outputFilePath = resolve(`${JOBS_DIR}/${id}/models`, outputFilename);
        await fs.writeFile(outputFilePath, outputString);

        return output;

    } catch (error) {
        console.error('Error running annotator: ', error);
    }

}