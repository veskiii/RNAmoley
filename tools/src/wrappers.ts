import { spawnSync } from "child_process";
import { resolve } from "path";
import fs from "node:fs/promises";

const JOBS_DIR = process.env.JOBS_DIR ? process.env.JOBS_DIR : "user_data";
const SCRIPTS_DIR = process.env.SCRIPTS_DIR
  ? process.env.SCRIPTS_DIR
  : "scripts";

interface Annotation {
  name: string | undefined;
  sequnece: string | undefined;
  dotbracket: string | undefined;
}

interface RangeOfResidues {
  start: number | undefined;
  end: number | undefined;
  residues: string | undefined;
  dotbracket: string | undefined;
}

interface StructuralElement {
  name: string | undefined;
  type: string | undefined;
  residues: RangeOfResidues[] | undefined;
}

const MOTIF_TYPE_NAME_MAP = {
  Stem: "S",
  SingleStrand: "SS",
  Hairpin: "H",
  Loop: "L",
  Junction: "J",
};

async function formatOutput(output: string) {
  const splt = output.split("/\r?\n/");
  const filtered = splt.filter((line) => line !== "");
  return JSON.stringify(filtered);
}

export async function runConverter(id: string, filename: string) {
  const filenameNoExt = filename.split(".")[0];
  console.log(`Converting ${filename} to pdb`);
  const maxit = spawnSync("maxit", [
    `-input`,
    `${JOBS_DIR}/${id}/${filename}`,
    `-output`,
    `${JOBS_DIR}/${id}/${filenameNoExt}.pdb`,
    "-o",
    "2",
  ]);
  if (maxit.error) {
    console.error("Error running maxit: ", maxit.error);
    return;
  }

  const result = await formatOutput(maxit.stdout.toString());

  return result;
}

export async function splitModels(id: string) {
  console.log(`Splitting ${JOBS_DIR}/${id}/${id}.pdb into models...`);

  const split = spawnSync(`${SCRIPTS_DIR}/Separate.py`, [
    `${JOBS_DIR}/${id}/${id}.pdb`,
    `${JOBS_DIR}/${id}/models`,
  ]);
  if (split.error) {
    console.error("Error running split: ", split.error);
    return { error: split.error };
  }
  const rawResult = await formatOutput(split.stdout.toString());
  const result = rawResult.substring(2, rawResult.length - 4);
  console.log("Split models - number of models:", result);

  const response = {
    numberOfModels: parseInt(result),
  };

  return response;
}

export async function correctModels(id: string, numberOfModels: number) {
  console.log(`Correcting ${id} models...`);

  for (let i = 1; i <= numberOfModels; i++) {
    console.log(`Correcting model ${i}...`);
    const correct = spawnSync(`${SCRIPTS_DIR}/Correction.py`, [
      `${JOBS_DIR}/${id}/models/${i}.pdb`,
      `${JOBS_DIR}/${id}/models/${i}.pdb`,
    ]);
    if (correct.error) {
      console.error("Error running correct: ", correct.error);
      return { error: correct.error };
    }
  }

  return { success: true };
}

export async function runAnnotator(id: string, numberOfModels: number) {
  console.log(`Running annotator on ${id}...`);
  const results = [];

  for (let i = 1; i <= numberOfModels; i++) {
    const annotator = spawnSync(
      "annotator",
      [
        "-j",
        `${JOBS_DIR}/${id}/models/${i}.json`,
        `${JOBS_DIR}/${id}/models/${i}.pdb`,
      ],
      { encoding: "utf-8" }
    );
    const result = await formatOutput(annotator.stdout.toString());
    const resultSplit = result
      .trim()
      .substring(2, result.length - 2)
      .split("\\n");

    // parse output as list of annotations
    // every 3 lines is a new annotation
    const output: Annotation[] = [];
    for (let i = 0; i < resultSplit.length - 1; i += 3) {
      output.push({
        name: resultSplit[i],
        sequnece: resultSplit[i + 1],
        dotbracket: resultSplit[i + 2],
      });
    }
    // console.log(output);
    results.push(output);

    // save output as a merged dot-bracket file
    const merged: Annotation = {
      name: ">strands_merged",
      sequnece: output.map((item) => item.sequnece).join(""),
      dotbracket: output.map((item) => item.dotbracket).join(""),
    };
    const mergedFilename = `${i}.dot`;
    const mergedString = `${merged.name}\n${merged.sequnece}\n${merged.dotbracket}`;
    const mergedFilePath = resolve(`${JOBS_DIR}/${id}/models`, mergedFilename);
    await fs.writeFile(mergedFilePath, mergedString);

    // save output as json file
    // const outputFilename = filename.split('.')[0] + '.json';
    const outputFilename = `${i}_annotation.json`;
    const outputString = JSON.stringify(output);
    const outputFilePath = resolve(`${JOBS_DIR}/${id}/models`, outputFilename);
    await fs.writeFile(outputFilePath, outputString);
  }

  console.log(`Ending running annotator on ${id}...`);

  return results;
}

const retrieveMotifsFromJson = async (
  filePath: string
): Promise<StructuralElement[]> => {
  // Wczytaj dane z pliku JSON
  const rawData = await fs.readFile(filePath, "utf-8");
  const jsonData = JSON.parse(rawData);
  console.log(jsonData);

  const structuralElements: StructuralElement[] = [];

  // Przetwarzanie "loops"
  if (jsonData.loops) {
    jsonData.loops.forEach((loop: any, index: number) => {
      const type = loop.strands.length >= 3 ? "Junction" : "Loop";
      structuralElements.push({
        name: `${MOTIF_TYPE_NAME_MAP[type]}${index + 1}`,
        type: type,
        residues: loop.strands.map((strand: any) => ({
          start: strand.first,
          end: strand.last,
          residues: strand.sequence,
          dotbracket: strand.structure,
        })),
      });
    });
  }

  // Przetwarzanie "hairpins"
  if (jsonData.hairpins) {
    jsonData.hairpins.forEach((hairpin: any, index: number) => {
      structuralElements.push({
        name: `${MOTIF_TYPE_NAME_MAP["Hairpin"]}${index + 1}`,
        type: "Hairpin",
        residues: [
          {
            start: hairpin.strand.first,
            end: hairpin.strand.last,
            residues: hairpin.strand.sequence,
            dotbracket: hairpin.strand.structure,
          },
        ],
      });
    });
  }

  // Przetwarzanie "stems"
  if (jsonData.stems) {
    jsonData.stems.forEach((stem: any, index: number) => {
      structuralElements.push({
        name: `${MOTIF_TYPE_NAME_MAP["Stem"]}${index + 1}`,
        type: "Stem",
        residues: [
          {
            start: stem.strand5p.first,
            end: stem.strand5p.last,
            residues: stem.strand5p.sequence,
            dotbracket: stem.strand5p.structure,
          },
          {
            start: stem.strand3p.first,
            end: stem.strand3p.last,
            residues: stem.strand3p.sequence,
            dotbracket: stem.strand3p.structure,
          },
        ],
      });
    });
  }

  // Przetwarzanie "singleStrands"
  if (jsonData.singleStrands) {
    jsonData.singleStrands.forEach((strand: any, index: number) => {
      structuralElements.push({
        name: `${MOTIF_TYPE_NAME_MAP["SingleStrand"]}${index + 1}`,
        type: "SingleStrand",
        residues: [
          {
            start: strand.strand.first,
            end: strand.strand.last,
            residues: strand.strand.sequence,
            dotbracket: strand.strand.structure,
          },
        ],
      });
    });
  }

  console.log("Parsed motifs: ", structuralElements);
  return structuralElements;
};

export async function runMotifExtractor(id: string, numberOfModels: number) {
  console.log(`Running motif extractor on ${id}...`);
  const results = [];

  for (let i = 1; i <= numberOfModels; i++) {
    // const motifExtractor = spawnSync(
    //   "motif-extractor",
    //   [`--dbn`, `${JOBS_DIR}/${id}/models/${i}.dot`],
    //   { encoding: "utf-8" }
    // );
    // const stdout = motifExtractor.stdout.toString();
    // const result = await formatOutput(stdout);
    // parse output to list of structural elements
    // skip first three lines - dotbracket, sequence, and name
    const output = await retrieveMotifsFromJson(
      `${JOBS_DIR}/${id}/models/${i}.json`
    );
    console.log("Motif extractor output: ", output);

    results.push(output);

    const outputFilename = `${i}_motifs.json`;
    const outputString = JSON.stringify(output);
    console.log("Output string: ", outputString);
    const outputFilePath = resolve(`${JOBS_DIR}/${id}/models`, outputFilename);
    await fs.writeFile(outputFilePath, outputString);
  }

  console.log(`Ending running motif extractor on ${id}...`);

  return results;
}

export async function walkingSphere(
  id: string,
  modelNumber: number,
  radius: number,
  interval: number
) {
  console.log(`Using walking sphere on model ${modelNumber} of ${id}...`);

  // #sys.argv[1] = Nazwa analizowanego pliku
  // #sys.argv[2] = folder do którego trafią wyniki
  // #sys.argv[3] = wielkość promienia
  // #sys.argv[4] = Liczba określa co który C-alfa będzie brany pod uwagę

  // delete old sphere folder if exists
  try {
    await fs.rm(`${JOBS_DIR}/${id}/sphere`, { recursive: true });
  } catch (error) {
    console.log("Sphere folder does not exist, continuing...");
  }

  const sphere = spawnSync(`${SCRIPTS_DIR}/Walking_sphere.py`, [
    `${JOBS_DIR}/${id}/models/${modelNumber}.pdb`,
    `${JOBS_DIR}/${id}/models/${modelNumber}_residues.json`,
    `${JOBS_DIR}/${id}/sphere`,
    radius.toString(),
    interval.toString(),
  ]);

  if (sphere.error) {
    console.error("Error running sphere: ", sphere.error);
    return { error: sphere.error };
  }

  console.log(`Walking sphere on model ${modelNumber} of ${id} finished.`);
  return { success: true };
}
