import express from "express";
import {
  correctModels,
  runAnnotator,
  runConverter,
  runFragmentExtraction,
  runMotifExtractor,
  splitModels,
  walkingSphere,
} from "./wrappers.js";

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/annotate", (req, res) => {
  const id = req.query.id as string;
  const numberOfModels = req.query.numberOfModels as string;

  if (!id) {
    res.status(400).send("Annotator error: id is required");
    return;
  }

  if (!numberOfModels) {
    res.status(400).send("Annotator error: filename is required");
    return;
  }
  console.log("Annotating", id, numberOfModels);

  runAnnotator(id, parseInt(numberOfModels))
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send(error);
    });
});

app.post("/extractMotifs", (req, res) => {
  const id = req.query.id as string;
  const numberOfModels = req.query.numberOfModels as string;

  if (!id) {
    res.status(400).send("Motif-extractor error: id is required");
    return;
  }

  if (!numberOfModels) {
    res.status(400).send("Motif-extractor error: filename is required");
    return;
  }
  console.log("Extracting motifs ", id, numberOfModels);

  runMotifExtractor(id, parseInt(numberOfModels))
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send(error);
    });
});

app.post("/convert", (req, res) => {
  const filename = req.query.filename as string;
  const id = req.query.id as string;
  if (!filename) {
    res.status(400).send("Converson error: filename is required");
    return;
  }
  if (!id) {
    res.status(400).send("Converson error: id is required");
    return;
  }
  runConverter(id, filename)
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.post("/split", (req, res) => {
  const id = req.query.id as string;

  if (!id) {
    res.status(400).send({ error: "Split error: id is required" });
    return;
  }

  splitModels(id)
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.post("/correct", (req, res) => {
  const id = req.query.id as string;
  const numberOfModels = req.query.numberOfModels as string;

  if (!id) {
    res.status(400).send({ error: "Correct error: id is required" });
    return;
  }

  if (!numberOfModels) {
    res
      .status(400)
      .send({ error: "Correct error: numberOfModels is required" });
    return;
  }

  correctModels(id, parseInt(numberOfModels))
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.post("/sphere", (req, res) => {
  req.setTimeout(1 * 60 * 60 * 1000); // 1h timeout

  const id = req.query.id as string;
  const modelNumber = req.query.modelNumber as string;
  const radius = req.query.radius as string;
  const interval = req.query.interval as string;

  if (!id) {
    res.status(400).send({ error: "Sphere error: id is required" });
    return;
  }

  if (!modelNumber) {
    res.status(400).send({ error: "Sphere error: modelNumber is required" });
    return;
  }

  if (!radius) {
    res.status(400).send({ error: "Sphere error: radius is required" });
    return;
  }

  if (!interval) {
    res.status(400).send({ error: "Sphere error: interval is required" });
    return;
  }

  walkingSphere(id, parseInt(modelNumber), parseInt(radius), parseInt(interval))
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.post("/fragment", (req, res) => {
  const id = req.query.id as string;
  const modelNumber = req.query.modelNumber as string;

  if (!id) {
    res.status(400).send({ error: "Fragment extraction error: id is required" });
    return;
  }

  if (!modelNumber) {
    res
      .status(400)
      .send({ error: "Fragment extraction error: modelNumber is required" });
    return;
  }

  runFragmentExtraction(id, modelNumber)
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
