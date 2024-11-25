import db from "../db/index.js";
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getJobsQuery, getJobByIdQuery, createJobQuery } from './queries.js';
import { ALLOWED_EXTENSIONS, analyzeStructureFragment, deleteFile, deleteJobDirectory, fetchJSONFile, fetchPdbFile, fetchPdbFileAsJSON, generateFilename, MAX_FILE_SIZE, moveToJobDirectroy, saveOriginalNumeration, uploadFile, uploadFileFromPDBCode, uploadJSONFile, uploadResultFile, validateFile } from "./utils.js";
import fetch from 'node-fetch';
import type { UUID } from "crypto";
import type { Annotation, JobResponse, splitModelsResponse } from "./types.js";


export async function getJobs(req: Request, res: Response) {
    db.query(getJobsQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send({ error: 'Database error.' });
            return;
        }
        res.status(200).json(result.rows);
    });
}

export async function getJobById(req: Request, res: Response) {
    const id = req.params.id as UUID;
    const modelNumber = '1'

    if (!id) {
        res.status(400).send({ error: 'Job ID is required.' });
        return;
    }

    if (id.length !== 36) {
        res.status(422).send({ error: 'Invalid job ID.' });
        return;
    }

    db.query(getJobByIdQuery, [id], async (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send({ error: 'Database error.' });
            return;
        }
        if (result.rows.length === 0) {
            res.status(404).send({ error: 'Job not found.' });
            return;
        }
        // res.status(200).json(result.rows[0]);
        //load annotation json file
        const annotation = await fetchJSONFile(id, `${modelNumber}_annotation.json`, modelNumber);
        if (!annotation) {
            res.status(500).send({ error: 'Annotation file not found.' });
            return;
        }

        const numeration = await fetchJSONFile(id, `numeration.json`);
        if (!numeration) {
            res.status(500).send({ error: 'Numeration file not found.' });
            return;
        }

        const pdbFile = await fetchPdbFileAsJSON(id, modelNumber);
        if (!pdbFile) {
            res.status(500).send({ error: 'PDB file not found.' });
            return;
        }

        res.status(200).json({
            ...result.rows[0],
            annotation: annotation,
            numeration: numeration,
            data: pdbFile
        });
    });
}

export async function createJob(req: Request, res: Response) {
    const rnaFile = req.file as Express.Multer.File;
    var pdbCode = req.body.pdbCode;
    const jobname = req.body.jobName as string || "Untitled job";
    const radioButton = req.body.radioButton as string || "None";
    const status = 'Created';

    var id: UUID;
    var newFilename: string;
    var originalFilename: string;
    var finalFilename: string;
    var originalExtension: string;

    if (radioButton.length == 4 && radioButton != "None") {
        pdbCode = radioButton;
    }

    if (!rnaFile && pdbCode === '' && radioButton === 'None') {
        res.status(400).send({ error: 'Either RNA file or PDB code is required' });
        return;
    }

    if (rnaFile && rnaFile.size > 0) {
        const error = validateFile(rnaFile, MAX_FILE_SIZE, ALLOWED_EXTENSIONS);
        if (error) {
            deleteFile(rnaFile.filename);
            res.status(422).send(error);
            return;
        }

        id = rnaFile.filename.split('.')[0] as UUID;
        newFilename = rnaFile.filename;
        originalFilename = rnaFile.originalname;
        originalExtension = rnaFile.originalname.split('.').pop() as string;

    } else {
        // use pdbCode
        if (pdbCode && pdbCode.length !== 4) {
            res.status(422).send({ error: 'Invalid PDB code.' });
            return;
        }

        // fetch pdb file
        const pdbCodeFile = await fetchPdbFile(pdbCode);
        if (typeof pdbCodeFile === 'string') {
            res.status(500).send(pdbCodeFile);
            return;
        }

        id = randomUUID();
        originalFilename = `${pdbCode}.pdb`;
        originalExtension = 'pdb';
        newFilename = generateFilename(id, pdbCodeFile);
        await uploadFileFromPDBCode(pdbCodeFile, newFilename);
    }

    // move file to job directory
    await moveToJobDirectroy(newFilename, id);

    // if not pdb, convert to pdb
    if (originalExtension != "pdb") {
        const convertResponse = await fetch(`http://tools:3002/convert?id=${id}&filename=${newFilename}`, {
            method: 'POST'
        });

        if (!convertResponse.ok) {
            console.error('Conversion error');
            deleteJobDirectory(id);
            res.status(500).send({ error: 'CIF to PDB conversion error.' });
            return;
        }

        finalFilename = newFilename.split('.')[0] + '.pdb';
    } else {
        finalFilename = newFilename;
    }

    // check if pdb file exists after conversion
    const pdbFile = await fetchPdbFileAsJSON(id);
    if (!pdbFile) {
        console.error('PDB file not found after conversion.');
        deleteJobDirectory(id);
        res.status(500).send({ error: 'Conversion error.' });
        return;
    }

    // split file into models
    var numberOfModels = 1;
    const splitResponse = await fetch(`http://tools:3002/split?id=${id}`, {
        method: 'POST'
    });
    numberOfModels = (await splitResponse.json() as splitModelsResponse).numberOfModels;

    // save the original numeration of all the models
    const newNumeration = await saveOriginalNumeration(id, numberOfModels);

    if (!newNumeration) {
        console.error('Numeration error');
        deleteJobDirectory(id);
        res.status(500).send({ error: 'Numeration error' });
        return;
    }

    // TODO: run clean up script on  all the models


    // annotate all the models
    const annotateResponse = await fetch(`http://tools:3002/annotate?id=${id}&numberOfModels=${numberOfModels}`, {
        method: 'POST'
    });

    if (!annotateResponse.ok) {
        console.error('Annotation error');
        deleteJobDirectory(id);
        res.status(500).send({ error: 'Annotation error' });
        return;
    }

    const annotateResult: Annotation[][] = await annotateResponse.json() as Annotation[][];
    db.query(createJobQuery, [id, originalFilename, jobname], (err, result) => {
        if (err) {
            console.error(err);
            deleteJobDirectory(id);
            res.status(500).send({ error: 'Database error.' });
            return;
        }

        // send fields from result with annotatnion and numeration for the first model
        res.status(201).json({
            ...result.rows[0],
            annotation: annotateResult[0],
            numeration: newNumeration[0] ? Object.fromEntries(newNumeration[0]) : {}
        });
    });
}

export async function analyzeFragment(req: Request, res: Response) {
    const id: UUID = req.body.id;
    const residues: number[] = req.body.residues;
    const modelNumber = '1';

    console.log(id, residues);

    if (!id || !residues) {
        res.status(400).send({ error: 'ID and residue list are required.' });
        return;
    }

    const result = await analyzeStructureFragment(id, modelNumber, residues);
    if (!result) {
        res.status(500).send({ error: 'Structure analysis error.' });
        return;
    }

    // save the result as json file
    const filename = `result.json`;
    await uploadResultFile(result, id, filename);

    res.status(200).json(result);
}

export async function getJobResult(req: Request, res: Response) {
    // check if id is provided
    const id = req.params.id as UUID;
    if (!id) {
        res.status(400).send({ error: 'Job ID is required.' });
        return;
    }

    // check if id is valid
    if (id.length !== 36) {
        res.status(422).send({ error: 'Invalid job ID.' });
        return;
    }

    // check if job exists
    db.query(getJobByIdQuery, [id], async (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send({ error: 'An error occurred.' });
            return;
        }
        if (result.rows.length === 0) {
            res.status(404).send({ error: 'Job not foun.' });
            return;
        }

        // check if result file exists
        const resultFile = await fetchJSONFile(id, `result.json`);
        if (!resultFile) {
            res.status(500).send({ error: 'Result file not found' });
            return;
        }

        res.status(200).json(resultFile);
    });
}