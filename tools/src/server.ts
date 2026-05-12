import express from "express";
import {
  correctModels,
  inspectOriginalFileComposition,
  runAnnotator,
  runConverter,
  runFragmentExtraction,
  runMotifExtractor,
  splitModels,
  walkingSphere,
} from "./wrappers.js";

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/annotate", (req, res) => {
  const id = req.query.id as string;
  const sourceFormat = req.query.sourceFormat as string;
  const modelsDir = (req.query.modelsDir as string) || "models";
  const modelNumbers = req.body.modelNumbers as (number | string)[];

  if (!id) {
    res.status(400).send("Annotator error: id is required");
    return;
  }

  if (!modelNumbers || !Array.isArray(modelNumbers)) {
    res.status(400).send("Annotator error: modelNumbers array is required");
    return;
  }
  console.log("Annotating", id, modelNumbers);

  runAnnotator(id, modelNumbers, sourceFormat, modelsDir)
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
  const modelsDir = (req.query.modelsDir as string) || "models";
  const modelNumbers = req.body.modelNumbers as (number | string)[];

  if (!id) {
    res.status(400).send("Motif-extractor error: id is required");
    return;
  }

  if (!modelNumbers || !Array.isArray(modelNumbers)) {
    res.status(400).send("Motif-extractor error: modelNumbers array is required");
    return;
  }
  console.log("Extracting motifs ", id, modelNumbers);

  runMotifExtractor(id, modelNumbers, modelsDir)
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

app.post("/inspectOriginal", (req, res) => {
  const id = req.query.id as string;
  const filename = req.query.filename as string;

  if (!id) {
    res.status(400).send({ error: "Inspection error: id is required" });
    return;
  }

  if (!filename) {
    res.status(400).send({ error: "Inspection error: filename is required" });
    return;
  }

  inspectOriginalFileComposition(id, filename)
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send(error);
    });
});

app.post("/split", (req, res) => {
  const id = req.query.id as string;
  const sourceFormat = req.query.sourceFormat as string;
  const modelsDir = (req.query.modelsDir as string) || "models";

  if (!id) {
    res.status(400).send({ error: "Split error: id is required" });
    return;
  }

  if (!sourceFormat) {
    res.status(400).send({ error: "Split error: sourceFormat is required" });
    return;
  }
  console.log("Splitting models for job", id, "with source format", sourceFormat);

  splitModels(id, sourceFormat, modelsDir)
    .then((output) => {
      res.status(200).send(output);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.post("/correct", (req, res) => {
  const id = req.query.id as string;
  const sourceFormat = req.query.sourceFormat as string;
  const modelsDir = (req.query.modelsDir as string) || "models";
  const modelNumbers = req.body.modelNumbers as (number | string)[];

  if (!id) {
    res.status(400).send({ error: "Correct error: id is required" });
    return;
  }

  if (!modelNumbers || !Array.isArray(modelNumbers)) {
    res
      .status(400)
      .send({ error: "Correct error: modelNumbers array is required" });
    return;
  }

  correctModels(id, modelNumbers, sourceFormat, modelsDir)
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
  const modelsDir = (req.query.modelsDir as string) || "models";

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

  walkingSphere(id, parseInt(modelNumber), parseInt(radius), parseInt(interval), modelsDir)
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
  const modelsDir = (req.query.modelsDir as string) || "models";

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

  runFragmentExtraction(id, modelNumber, modelsDir)
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
