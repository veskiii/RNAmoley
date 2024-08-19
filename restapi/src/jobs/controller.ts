import db from "../db/index.js";
import type { Request, Response } from 'express';
import { v4 as uuid4 } from 'uuid';

export function getJobs(req: Request, res: Response) {
    db.query('SELECT * FROM jobs', (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
            return;
        }
        res.status(200).json(result.rows);
    });
}

export function createJob(req: Request, res: Response) {
    const id = uuid4();
    const name = req.body.name;
    const pdbCode = req.body.pdbCode;
    const file = req.body.file;
    const originalFilename = file.name;

    db.query('INSERT INTO jobs (id, originalFilename, name) VALUES ($1, $2, $3)', [id, originalFilename, name], (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
            return;
        }
        res.status(201).send('Job created');
    });
}