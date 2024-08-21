import express from 'express';
import { runAnnotator } from './wrappers.js';

const app = express();
const port = 3002;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/annotate', (req, res) => {
    const filename = req.query.filename as string;
    if (!filename) {
        res.status(400).send('filename is required');
        return;
    }
    runAnnotator(filename).then((output) => {
        res.send(output);
    }).catch((error) => {
        res.status(500).send(error);
    });
});

app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});