import db from "../db/index.js";
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getJobsQuery, getJobByIdQuery, createJobQuery } from './queries.js';
import { ALLOWED_EXTENSIONS, analyzeStructureFragment, deleteFile, deleteJobDirectory, fetchJSONFile, fetchPdbFile, fetchPdbFileAsJSON, generateFilename, MAX_FILE_SIZE, moveToJobDirectroy, saveOriginalNumeration, uploadFile, uploadFileFromPDBCode, saveJSONFileModels, saveJSONFileRoot, validateFile, saveMetadata, fetchModelFileAsString, readMetadata, readResults, saveResults } from "./utils.js";
import fetch from 'node-fetch';
import type { UUID } from "crypto";
import type { Analysis_results, Annotation, Job, Metadata, splitModelsResponse } from "./types.js";


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
    const modelNumber = req.params.modelNumber as string || '1';

    if (!id) {
        res.status(400).send({ error: 'Job ID is required.' });
        return;
    }

    if (id.length !== 36) {
        res.status(422).send({ error: 'Invalid job ID.' });
        return;
    }

    if (!Number.isInteger(parseInt(modelNumber))) {
        res.status(422).send({ error: 'Invalid model number.' });
        return;
    }

    const metadata = await readMetadata(id);
    if (!metadata) {
        res.status(500).send({ error: 'Metadata file not found.' });
        return;
    }

    if (parseInt(modelNumber) > metadata.model_count || parseInt(modelNumber) < 1) {
        res.status(404).send({ error: 'Model not found.' });
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

        const numeration = await fetchJSONFile(id, `${modelNumber}_numeration.json`, modelNumber);
        if (!numeration) {
            res.status(500).send({ error: 'Numeration file not found.' });
            return;
        }

        const pdbFile = await fetchPdbFileAsJSON(id, modelNumber);
        if (!pdbFile) {
            res.status(500).send({ error: 'PDB file not found.' });
            return;
        }

        const file_string = await fetchModelFileAsString(id, modelNumber);
        if (!file_string) {
            res.status(500).send({ error: 'Blob file not found.' });
            return;
        }

        const results = await readResults(id);

        const jobResponse: Job = {
            id: result.rows[0].id,
            original_filename: result.rows[0].original_filename,
            name: result.rows[0].name,
            metadata: metadata,
            model_number: parseInt(modelNumber),
            created_at: result.rows[0].created_at,
            updated_at: result.rows[0].updated_at,
            annotation: annotation,
            numeration: numeration,
            pdb_file: pdbFile,
            pdb_file_string: file_string,
            results: results
        };

        res.status(200).json(jobResponse);
    });
}

export async function createJob(req: Request, res: Response) {
    const rnaFile = req.file as Express.Multer.File;
    var pdbCode = req.body.pdbCode;
    const jobname = req.body.jobName as string || "Untitled job";
    const radioButton = req.body.radioButton as string || "None";

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

    const metadata: Metadata = {
        status: "running",
        model_count: 0,
    };

    saveMetadata(id, metadata);

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
    const correctResponse = await fetch(`http://tools:3002/correct?id=${id}&numberOfModels=${numberOfModels}`, {
        method: 'POST'
    });

    if (!correctResponse.ok) {
        console.error('Correction error');
        deleteJobDirectory(id);
        res.status(500).send({ error: 'An error occurred while cleaning up the files.' });
        return;
    }

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

    // create a metadata file for the job
    metadata.model_count = numberOfModels;
    metadata.status = 'completed';

    db.query(createJobQuery, [id, originalFilename, jobname], async (err, result) => {
        if (err) {
            console.error(err);
            deleteJobDirectory(id);
            res.status(500).send({ error: 'Database error.' });
            return;
        }

        // get the first model as blob
        const blob = await fetchModelFileAsString(id, '1');

        // get the first model as json
        const pdbFile = await fetchPdbFileAsJSON(id, '1');

        // send fields from result with annotatnion and numeration for the first model
        const jobResponse: Job = {
            id: result.rows[0].id,
            original_filename: result.rows[0].original_filename,
            name: result.rows[0].name,
            metadata: metadata,
            model_number: 1,
            created_at: result.rows[0].created_at,
            updated_at: result.rows[0].updated_at,
            annotation: annotateResult[0] ? annotateResult[0] : [],
            numeration: newNumeration[0] ? Object.fromEntries(newNumeration[0]) : {},
            pdb_file: pdbFile ? pdbFile : { atoms: [], seqRes: { serNum: 0, chainID: '', numRes: 0, resNames: [] }, residues: [], chains: new Map() },
            pdb_file_string: blob
        }
        saveMetadata(id, metadata);
        res.status(201).json(jobResponse);
    });
}

export async function analyzeFragment(req: Request, res: Response) {
    const id: UUID = req.body.id;
    const residues: number[] = req.body.residues;
    const modelNumber = req.body.modelNumber || '1';

    const metadata = await readMetadata(id);

    if (!id || !residues) {
        saveMetadata(id, { ...metadata, status: 'failed' });
        res.status(400).send({ error: 'ID and residue list are required.' });
        return;
    }

    if (id.length !== 36) {
        res.status(422).send({ error: 'Invalid job ID.' });
        return;
    }

    metadata.status = 'running';
    metadata.last_used_model = parseInt(modelNumber);
    saveMetadata(id, metadata);

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

        const output = await analyzeStructureFragment(id, modelNumber, residues);
        if (!output) {
            metadata.status = 'failed';
            saveMetadata(id, metadata);
            res.status(500).send({ error: 'Structure analysis error.' });
            return;
        }

        const outputData: Analysis_results["data"] = residues.map((residue_number) => {
            return [residue_number, output];
        });

        const analysisResult: Analysis_results = {
            mode: 'fragment',
            data: outputData
        };

        // save the result as json file
        await saveResults(id, analysisResult);
        metadata.status = 'completed';
        metadata.last_used_model = parseInt(modelNumber);
        saveMetadata(id, metadata);

        //load annotation json file
        const annotation = await fetchJSONFile(id, `${modelNumber}_annotation.json`, modelNumber);
        if (!annotation) {
            res.status(500).send({ error: 'Annotation file not found.' });
            return;
        }

        const numeration = await fetchJSONFile(id, `${modelNumber}_numeration.json`, modelNumber);
        if (!numeration) {
            res.status(500).send({ error: 'Numeration file not found.' });
            return;
        }

        const pdbFile = await fetchPdbFileAsJSON(id, modelNumber);
        if (!pdbFile) {
            res.status(500).send({ error: 'PDB file not found.' });
            return;
        }

        const file_string = await fetchModelFileAsString(id, modelNumber);
        if (!file_string) {
            res.status(500).send({ error: 'Could not load model file.' });
            return;
        }

        const jobResponse: Job = {
            id: result.rows[0].id,
            original_filename: result.rows[0].original_filename,
            name: result.rows[0].name,
            metadata: metadata,
            model_number: parseInt(modelNumber),
            created_at: result.rows[0].created_at,
            updated_at: result.rows[0].updated_at,
            annotation: annotation,
            numeration: numeration,
            pdb_file: pdbFile,
            pdb_file_string: file_string,
            results: analysisResult
        };

        res.status(200).json(jobResponse);
    });
}