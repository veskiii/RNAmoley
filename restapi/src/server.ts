import express from 'express';
import type { Express, Request, Response } from 'express';
import runDbMigrations from './db/migrations/index.js';
import { router as jobRoutes } from './jobs/routes.js';
import cors from 'cors';

const app = express();
app.use(express.json());

// expose public folder
app.use(express.static('public'));

const PORT = process.env.PORT;

app.use(cors());

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World');
});

app.use('/api/v1/jobs', jobRoutes);

await runDbMigrations();

app.listen(
    PORT,
    () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    });