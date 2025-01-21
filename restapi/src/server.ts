import express from 'express';
import type { Express, Request, Response } from 'express';
import runDbMigrations from './db/migrations/index.js';
import { router as jobRoutes } from './jobs/routes.js';
import { cleanUpJobs } from './jobs/controller.js';
import cors from 'cors';

const app = express();
app.use(express.json());

// expose public folder
app.use(express.static('public'));

const PORT = process.env.PORT;

app.use(cors(
    {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT'],
        allowedHeaders: '*',
    }
));

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World! Rest API is running');
});

app.use('/api/v1/jobs', jobRoutes);

await runDbMigrations();

// Clean up jobs
console.log('Cleaning up jobs...');
cleanUpJobs();
setInterval(() => {
    console.log('Cleaning up jobs...');
    cleanUpJobs();
}, 1000 * 60 * 60 * 24);

app.listen(
    PORT,
    () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    });