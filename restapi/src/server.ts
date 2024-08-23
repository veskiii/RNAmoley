import express from 'express';
import type { Express, Request, Response } from 'express';
import runDbMigrations from './db/migrations/index.js';
import { router as jobRoutes } from './jobs/routes.js';

const cors = require('cors')

const app = express();
app.use(express.json());

// expose public folder
app.use(express.static('public'));

const PORT = process.env.PORT;
const corsOptions = {
    origin: `http://localhost:${PORT}`,
    optionsSuccessStatus: 200
}

app.use(cors(corsOptions));


app.get('/', (req: Request, res: Response) => {
    res.send('Hello World');
});

app.use('/api/v1/jobs', jobRoutes);

app.post('/create', (req: Request, res: Response) => {
    const name = req.body.name;
    const pdbCode = req.body.pdbCode;
    const file = req.body.file;

    res.status(201).send('Job created');

});

await runDbMigrations();

app.listen(
    PORT,
    () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    });