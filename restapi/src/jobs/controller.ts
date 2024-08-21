import db from "../db/index.js";
import type { Request, Response } from 'express';
import { v4 as uuid4 } from 'uuid';
import { getJobsQuery, getJobByIdQuery, createJobQuery } from './queries.js';
import { ALLOWED_EXTENSIONS, deleteFile, fetchPdbFile, generateFilename, MAX_FILE_SIZE, uploadFile, validateFile } from "./utils.js";

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

    const uuidv4Regex = new RegExp('^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89a-b][a-f0-9]{3}-[a-f0-9]{12}$');
    const id = req.params.id;

    if (!id) {
        res.status(400).send('Job ID is required');
        return;
    }

    if (!uuidv4Regex.test(id)) {
        res.status(422).send('Invalid job ID');
        return;
    }

    db.query(getJobByIdQuery, [id], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
            return;
        }
        if (result.rows.length === 0) {
            res.status(404).send('Job not found');
            return;
        }
        res.status(200).json(result.rows[0]);
    });
}

export async function createJob(req: Request, res: Response) {
    const rnaFile = req.file as Express.Multer.File;
    const pdbCode = req.body.pdbCode;
    const jobname = req.body.jobName as string || "Untitled job";

    var id: string;
    var newFilename: string;
    var originalFilename: string;

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

        id = rnaFile.filename.split('.')[0] as string;
        newFilename = rnaFile.filename;
        originalFilename = rnaFile.originalname;

        db.query(createJobQuery, [id, originalFilename, jobname], (err, result) => {
            if (err) {
                console.error(err);
                deleteFile(newFilename);
                res.status(500).send('An error occurred');
                return;
            }
            res.status(201).json(result.rows[0]);
        });

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

        id = uuid4();
        originalFilename = `${pdbCode}.pdb`;
        newFilename = generateFilename(id, pdbCodeFile);
        await uploadFile(pdbCodeFile, newFilename);

        db.query(createJobQuery, [id, originalFilename, jobname], (err, result) => {
            if (err) {
                console.error(err);
                deleteFile(newFilename);
                res.status(500).send('An error occurred');
                return;
            }
            res.status(201).json(result.rows[0]);
        });
    }

    // TODO: if not mmcif or cif, convert to pdb
    // code here...

    // TODO: annotate file
    // code here...
}