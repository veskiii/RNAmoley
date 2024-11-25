import { execSync, spawnSync } from 'child_process';
import { resolve } from 'path';
import fs from "node:fs/promises";
import { raw } from 'express';

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
    const maxit = spawnSync('maxit', [`-input`, `${JOBS_DIR}/${id}/${filename}`, `-output`, `${JOBS_DIR}/${id}/${filenameNoExt}.pdb`, '-o', '2']);
    if (maxit.error) {
        console.error('Error running maxit: ', maxit.error);
        return;
    }

    const result = await formatOutput(maxit.stdout.toString());

    return result;
}

export async function splitModels(id: string) {
    console.log(`Splitting ${id}.pdb into models...`);

    const split = spawnSync('Separate.py', [`${JOBS_DIR}/${id}/${id}.pdb`, `${JOBS_DIR}/${id}/models`]);
    if (split.error) {
        console.error('Error running split: ', split.error);
        return { error: split.error };
    }
    const rawResult = await formatOutput(split.stdout.toString());
    const result = rawResult.substring(2, rawResult.length - 4);
    console.log("Split models - number of models:", result);

    const response = {
        numberOfModels: parseInt(result)
    }

    return response;
}

export async function correctModels(id: string, numberOfModels: number) {
    console.log(`Correcting ${id} models...`);

    for (let i = 1; i <= numberOfModels; i++) {
        console.log(`Correcting model ${i}...`);
        const correct = spawnSync('Correction.py', [`${JOBS_DIR}/${id}/models/${i}.pdb`, `${JOBS_DIR}/${id}/models/${i}_corrected.pdb`]);
        if (correct.error) {
            console.error('Error running correct: ', correct.error);
            return { error: correct.error };
        }
    }

    return { success: true };
}

export async function runAnnotator(id: string, numberOfModels: number) {
    console.log(`Running annotator on ${id}...`);
    const results = [];

    for (let i = 1; i <= numberOfModels; i++) {
        const annotator = spawnSync('annotator', [`${JOBS_DIR}/${id}/models/${i}.pdb`], { encoding: 'utf-8' });
        const result = await formatOutput(annotator.stdout.toString());
        const resultSplit = result.trim().substring(2, result.length - 2).split("\\n");

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
        results.push(output);

        // save output as json file
        // const outputFilename = filename.split('.')[0] + '.json';
        const outputFilename = `${i}_annotation.json`;
        const outputString = JSON.stringify(output);
        const outputFilePath = resolve(`${JOBS_DIR}/${id}/models`, outputFilename);
        await fs.writeFile(outputFilePath, outputString);
    }

    return results;
}