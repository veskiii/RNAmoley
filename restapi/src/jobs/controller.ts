import db from "../db/index.js";
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getJobsQuery, getJobByIdQuery, createJobQuery } from './queries.js';
import { ALLOWED_EXTENSIONS, analyzeStructureFragment, deleteFile, deleteJobFiles, fetchAnnotationFile, fetchPdbFile, fetchPdbFileAsJSON, generateFilename, MAX_FILE_SIZE, uploadFile, validateFile } from "./utils.js";
import fetch from 'node-fetch';
import type { UUID } from "crypto";

interface AnnotateResult {
    sequence: string;
    dotbracket: string;
}

export async function getJobs(req: Request, res: Response) {
    db.query(getJobsQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
            return;
        }
        res.status(200).json(result.rows);
    });
}

export async function getJobById(req: Request, res: Response) {
    const id = req.params.id as UUID;

    if (!id) {
        res.status(400).send('Job ID is required');
        return;
    }

    if (id.length !== 36) {
        res.status(422).send('Invalid job ID');
        return;
    }

    db.query(getJobByIdQuery, [id], async (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
            return;
        }
        if (result.rows.length === 0) {
            res.status(404).send('Job not found');
            return;
        }
        // res.status(200).json(result.rows[0]);
        //load annotation json file
        const annotation = await fetchAnnotationFile(id);
        if (!annotation) {
            res.status(500).send('An error occurred: annotation file not found');
            return;
        }

        const pdbFile = await fetchPdbFileAsJSON(id);
        if (!pdbFile) {
            res.status(500).send('An error occurred: pdb file not found');
            return;
        }

        res.status(200).json({
            ...result.rows[0],
            ...annotation,
            data: pdbFile
        });
    });
}

export async function createJob(req: Request, res: Response) {
    const rnaFile = req.file as Express.Multer.File;
    const pdbCode = req.body.pdbCode;
    const jobname = req.body.jobName as string || "Untitled job";

    var id: UUID;
    var newFilename: string;
    var originalFilename: string;
    var finalFilename: string;
    var originalExtension: string;

    if (!rnaFile && pdbCode === '') {
        res.status(400).send('Either RNA file or PDB code is required');
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
            res.status(422).send('Invalid PDB code');
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
        await uploadFile(pdbCodeFile, newFilename);
    }

    // TODO: if not pdb, convert to pdb
    if (originalExtension != "pdb") {
        try {
            const convertResponse = await fetch(`http://tools:3002/convert?filename=${newFilename}`, {
                method: 'POST'
            })
            finalFilename = newFilename.split('.')[0] + '.pdb';
        } catch (error) {
            console.error(error);
            deleteJobFiles(id);
            res.status(500).send('An error occurred: conversion error');
            return;
        }
    } else {
        finalFilename = newFilename;
    }

    // annotate file
    var annotateResponse;
    try {
        annotateResponse = await fetch(`http://tools:3002/annotate?filename=${finalFilename}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error(error);
        deleteJobFiles(id);
        res.status(500).send('An error occurred: annotation error');
        return;
    }

    // @ts-ignore
    const annotateResult: object = await annotateResponse.json();
    db.query(createJobQuery, [id, originalFilename, jobname], (err, result) => {
        if (err) {
            console.error(err);
            deleteJobFiles(id);
            res.status(500).send('An error occurred: db error');
            return;
        }

        // send fields form result with annotate results
        res.status(201).json({
            ...result.rows[0],
            ...annotateResult
        });
    });
}

export async function analyzeFragment(req: Request, res: Response) {
    const id: UUID = req.body.id;
    const residues: number[] = req.body.residues;

    console.log(id, residues);

    if (!id || !residues) {
        res.status(400).send('ID and residue list are required');
        return;
    }

    const result = await analyzeStructureFragment(id, residues);
    if (!result) {
        res.status(500).send('An error occurred');
        return;
    }

    res.status(200).json(result);
}