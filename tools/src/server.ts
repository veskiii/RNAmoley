import express from 'express';
import { runAnnotator, runConverter } from './wrappers.js';

const app = express();
const port = 3002;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/annotate', (req, res) => {
    const filename = req.query.filename as string;
    const id = req.query.id as string;
    if (!filename) {
        res.status(400).send('Annotator error: filename is required');
        return;
    }
    if (!id) {
        res.status(400).send('Annotator error: id is required');
        return;
    }
    runAnnotator(id, filename).then((output) => {
        res.status(200).send(output);
    }).catch((error) => {
        res.status(500).send(error);
    });
});

app.post('/convert', (req, res) => {
    const filename = req.query.filename as string;
    const id = req.query.id as string;
    if (!filename) {
        res.status(400).send('Converson error: filename is required');
        return;
    }
    if (!id) {
        res.status(400).send('Converson error: id is required');
        return;
    }
    runConverter(id, filename).then((output) => {
        res.status(200).send(output);
    }).catch((error) => {
        res.status(500).send(error);
    });
});

app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});