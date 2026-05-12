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

interface NumerationItem {
  annotator_residue_number: number;
  annotator_nucleotide_name: string;
  annotator_dotbracket: string;
  label_chain_id: string | undefined;
  label_residue_number: number | undefined;
  auth_chain_id: string | undefined;
  auth_residue_number: number | undefined;
  auth_nucleotide_name: string | undefined;
  moley_residue_number?: number;
  moley_chain_id?: string;
  original_label_asym_id?: string;
  new_chain_id?: string;
}

interface NumerationMap {
  [annotator_residue_number: number]: NumerationItem;
}

const MOTIF_TYPE_NAME_MAP = {
  Stem: "S",
  SingleStrand: "SS",
  Hairpin: "H",
  Loop: "L",
  Junction: "J",
};

const PROTEIN_RESIDUES = new Set([
  "ALA",
  "ARG",
  "ASN",
  "ASP",
  "CYS",
  "GLN",
  "GLU",
  "GLY",
  "HIS",
  "ILE",
  "LEU",
  "LYS",
  "MET",
  "PHE",
  "PRO",
  "SER",
  "THR",
  "TRP",
  "TYR",
  "VAL",
  "SEC",
  "PYL",
]);

const DNA_RESIDUES = new Set([
  "DA",
  "DC",
  "DG",
  "DT",
  "DI",
  "ADE",
  "CYT",
  "GUA",
  "THY",
  "URA",
]);

const WATER_RESIDUES = new Set(["HOH", "WAT", "H2O", "DOD"]);

const ION_RESIDUES = new Set([
  "NA",
  "K",
  "MG",
  "MN",
  "CA",
  "ZN",
  "FE",
  "CL",
  "BR",
  "IOD",
  "SR",
  "CD",
  "CO",
  "CU",
  "NI",
]);

interface CompositionInspection {
  fileFormat: "pdb" | "cif" | "unknown";
  containsOnlyRNA: boolean;
  hasRNA: boolean;
  hasProtein: boolean;
  hasDNA: boolean;
  hasOtherNonWaterComponents: boolean;
  hasWater: boolean;
  observedResidues: string[];
  nonRNAContents: string[];
  notes: string[];
}

async function formatOutput(output: string) {
  const splt = output.split("/\r?\n/");
  const filtered = splt.filter((line) => line !== "");
  return JSON.stringify(filtered);
}

function classifyResidueName(residueName: string) {
  const normalized = residueName.trim().toUpperCase();

  if (WATER_RESIDUES.has(normalized)) {
    return "water";
  }

  if (PROTEIN_RESIDUES.has(normalized)) {
    return "protein";
  }

  if (DNA_RESIDUES.has(normalized)) {
    return "dna";
  }

  if (ION_RESIDUES.has(normalized)) {
    return "ion";
  }

  if (normalized === "A" || normalized === "C" || normalized === "G" || normalized === "U" || normalized === "I") {
    return "rna";
  }

  return "other";
}

function inspectPdbContent(content: string): CompositionInspection {
  const residues = new Set<string>();
  const nonRNAContents = new Set<string>();
  let hasRNA = false;
  let hasProtein = false;
  let hasDNA = false;
  let hasWater = false;
  let hasOtherNonWaterComponents = false;

  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) {
      continue;
    }

    const residueName = line.slice(17, 20).trim();
    if (!residueName) {
      continue;
    }

    residues.add(residueName);

    const category = classifyResidueName(residueName);
    if (category === "rna") {
      hasRNA = true;
    } else if (category === "protein") {
      hasProtein = true;
      nonRNAContents.add(residueName);
    } else if (category === "dna") {
      hasDNA = true;
      nonRNAContents.add(residueName);
    } else if (category === "water") {
      hasWater = true;
      nonRNAContents.add(residueName);
    } else if (category === "other") {
      hasOtherNonWaterComponents = true;
      nonRNAContents.add(residueName);
    }
  }

  return {
    fileFormat: "pdb",
    containsOnlyRNA: hasRNA && !hasProtein && !hasDNA && !hasOtherNonWaterComponents,
    hasRNA,
    hasProtein,
    hasDNA,
    hasOtherNonWaterComponents,
    hasWater,
    observedResidues: Array.from(residues).sort(),
    nonRNAContents: Array.from(nonRNAContents).sort(),
    notes: [
      "PDB inspection is heuristic and focuses on residue names in ATOM/HETATM records.",
    ],
  };
}

function tokenizeMmCifRow(line: string) {
  const tokens = line.match(/(?:'[^']*'|\"[^\"]*\"|\S+)/g) ?? [];
  return tokens.map((token) => token.replace(/^['\"]|['\"]$/g, ""));
}

function inspectMmCifContent(content: string): CompositionInspection {
  const residues = new Set<string>();
  const nonRNAContents = new Set<string>();
  let hasRNA = false;
  let hasProtein = false;
  let hasDNA = false;
  let hasWater = false;
  let hasOtherNonWaterComponents = false;

  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const trimmedLine = line.trim();

    if (!trimmedLine.startsWith("loop_")) {
      continue;
    }

    const headers: string[] = [];
    let headerIndex = index + 1;

    while (headerIndex < lines.length) {
      const headerLine = lines[headerIndex];
      if (!headerLine) {
        break;
      }

      const trimmedHeaderLine = headerLine.trim();
      if (!trimmedHeaderLine.startsWith("_")) {
        break;
      }

      headers.push(trimmedHeaderLine);
      headerIndex += 1;
    }

    const groupIndex = headers.indexOf("_atom_site.group_PDB");
    const compIdIndex = headers.indexOf("_atom_site.label_comp_id");
    const altCompIdIndex = headers.indexOf("_atom_site.auth_comp_id");

    if (groupIndex === -1 || (compIdIndex === -1 && altCompIdIndex === -1)) {
      continue;
    }

    let rowIndex = headerIndex;
    while (rowIndex < lines.length) {
      const rowLine = lines[rowIndex];
      if (!rowLine) {
        break;
      }

      const trimmedRowLine = rowLine.trim();

      if (!trimmedRowLine || trimmedRowLine.startsWith("#") || trimmedRowLine.startsWith("loop_") || trimmedRowLine.startsWith("data_")) {
        break;
      }

      if (trimmedRowLine.startsWith("_")) {
        break;
      }

      const row = tokenizeMmCifRow(trimmedRowLine);
      const residueName = (row[compIdIndex] || row[altCompIdIndex] || "").trim();
      const groupPdb = row[groupIndex]?.toUpperCase();

      if (residueName) {
        residues.add(residueName);
        const category = classifyResidueName(residueName);

        if (category === "rna") {
          hasRNA = true;
        } else if (category === "protein") {
          hasProtein = true;
          nonRNAContents.add(residueName);
        } else if (category === "dna") {
          hasDNA = true;
          nonRNAContents.add(residueName);
        } else if (category === "water") {
          hasWater = true;
          nonRNAContents.add(residueName);
        } else if (category === "other" && groupPdb === "HETATM") {
          hasOtherNonWaterComponents = true;
          nonRNAContents.add(residueName);
        }
      }

      rowIndex += 1;
    }
  }

  const entityPolyTypes = Array.from(content.matchAll(/_entity_poly\.type\s+([^\n#]+)/gi)).map((match) => (match[1] ?? "").trim().toLowerCase());
  for (const type of entityPolyTypes) {
    if (type.includes("polypeptide")) {
      hasProtein = true;
    }
    if (type.includes("deoxyribonucleotide")) {
      hasDNA = true;
    }
    if (type.includes("ribonucleotide")) {
      hasRNA = true;
    }
  }

  const chemCompTypes = Array.from(content.matchAll(/_chem_comp\.type\s+([^\n#]+)/gi)).map((match) => (match[1] ?? "").trim().toLowerCase());
  if (chemCompTypes.some((type) => type.includes("non-polymer") || type.includes("ligand"))) {
    hasOtherNonWaterComponents = true;
  }

  return {
    fileFormat: "cif",
    containsOnlyRNA: hasRNA && !hasProtein && !hasDNA && !hasOtherNonWaterComponents,
    hasRNA,
    hasProtein,
    hasDNA,
    hasOtherNonWaterComponents,
    hasWater,
    observedResidues: Array.from(residues).sort(),
    nonRNAContents: Array.from(nonRNAContents).sort(),
    notes: [
      "mmCIF inspection is heuristic and combines atom-site residue names with entity annotations.",
    ],
  };
}

export async function inspectOriginalFileComposition(id: string, filename: string) {
  const filePath = resolve(`${JOBS_DIR}/${id}/${filename}`);
  const content = await fs.readFile(filePath, "utf-8");
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdb") {
    return inspectPdbContent(content);
  }

  if (extension === "cif" || extension === "mmcif") {
    return inspectMmCifContent(content);
  }

  return {
    fileFormat: "unknown" as const,
    containsOnlyRNA: false,
    hasRNA: false,
    hasProtein: false,
    hasDNA: false,
    hasOtherNonWaterComponents: false,
    hasWater: false,
    observedResidues: [],
    nonRNAContents: [],
    notes: [`Unsupported file extension: ${extension || "unknown"}`],
  };
}

export async function runConverter(id: string, filename: string) {
  const filenameNoExt = filename.split(".")[0];
  console.log(`Converting ${filename} to pdb`);

  const gemmi = spawnSync("gemmi", [
    "convert",
    `${JOBS_DIR}/${id}/${filename}`,
    `${JOBS_DIR}/${id}/${filenameNoExt}.pdb`,
  ]);
  if (gemmi.error) {
    console.error("Error running gemmi: ", gemmi.error);
    return;
  }

  const result = await formatOutput(gemmi.stdout.toString());

  return result;
}

export async function splitModels(
  id: string,
  sourceFormat: string,
  modelsDir = "models"
) {
  console.log(`Splitting ${JOBS_DIR}/${id}/${id}.pdb into ${modelsDir}...`);

  const split = spawnSync(`${SCRIPTS_DIR}/Separate.py`, [
    `${JOBS_DIR}/${id}/${id}.${sourceFormat}`,
    `${JOBS_DIR}/${id}/${modelsDir}`,
  ]);
  if (split.error) {
    console.error("Error running split: ", split.error);
    return { error: split.error };
  }
  
  const rawResult = split.stdout.toString().trim();
  let result;
  
  try {
    result = JSON.parse(rawResult);
  } catch (e) {
    console.error("Failed to parse JSON output:", rawResult);
    throw new Error(`Invalid JSON output from Separate.py: ${rawResult}`);
  }

  if (!result.models || !Array.isArray(result.models)) {
    console.error("Invalid models structure returned:", result);
    throw new Error(`Invalid models structure: ${JSON.stringify(result)}`);
  }

  console.log("Split models - model numbers:", result.models);

  const response = {
    modelNumbers: result.models,
    numberOfModels: result.models.length,
  };

  return response;
}

export async function correctModels(
  id: string,
  numberOfModels: (string | number)[],
  sourceFormat: string,
  modelsDir = "models"
) {
  console.log(`Correcting ${id} models...`);

  const modelNumbers = Array.isArray(numberOfModels) 
    ? numberOfModels 
    : Array.from({ length: numberOfModels }, (_, i) => i + 1);

  for (const modelNum of modelNumbers) {
    console.log(`Correcting model ${modelNum}...`);
    const correct = spawnSync(`${SCRIPTS_DIR}/Correction.py`, [
      `${JOBS_DIR}/${id}/${modelsDir}/${modelNum}.${sourceFormat}`,
      `${JOBS_DIR}/${id}/${modelsDir}/${modelNum}.${sourceFormat}`,
    ]);
    if (correct.error) {
      console.error("Error running correct: ", correct.error);
      return { error: correct.error };
    }
  }

  return { success: true };
}

export async function runAnnotator(
  id: string,
  numberOfModels: (string | number)[],
  sourceFormat: string,
  modelsDir = "models"
) {
  console.log(`Running annotator on ${id}...`);
  const results = [];

  const modelNumbers = Array.isArray(numberOfModels) 
    ? numberOfModels 
    : Array.from({ length: numberOfModels }, (_, i) => i + 1);

  for (const i of modelNumbers) {
    const annotator = spawnSync(
      "annotator",
      [
        "-j",
        `${JOBS_DIR}/${id}/${modelsDir}/${i}.json`,
        `${JOBS_DIR}/${id}/${modelsDir}/${i}.${sourceFormat}`,
      ],
      { encoding: "utf-8" }
    );
    const result = await formatOutput(annotator.stdout.toString());
    const resultSplit = result
      .trim()
      .substring(2, result.length - 2)
      .split("\\n");

      

    const numeration = await retrieveNumerationFromJson(resolve(`${JOBS_DIR}/${id}/${modelsDir}/${i}.json`));
    const numerationFilename = `${i}_numeration.json`;
    const numerationString = JSON.stringify(numeration);
    const numerationFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}`, numerationFilename);
    await fs.writeFile(numerationFilePath, numerationString);

      
    const labelToAuthorMap: Record<string, string> = {};
    if (sourceFormat === "cif") {
      const numerationFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}/${i}_numeration.json`);
      let numerationData: Record<string, any> = {};
      try {
        const numerationRaw = await fs.readFile(numerationFilePath, "utf-8");
        numerationData = JSON.parse(numerationRaw) ?? {};
      }
      catch (error) {
        console.error(`Error reading numeration file ${numerationFilePath}:`, error);
      }
      for (const residueNumber in numerationData) {
        const item = numerationData[residueNumber];
        if (item.original_label_asym_id && item.new_chain_id) {
          labelToAuthorMap[item.original_label_asym_id] = item.new_chain_id;
        }
      }
    }

    const basePairs = await retrieveBasePairsFromJson(
      resolve(`${JOBS_DIR}/${id}/${modelsDir}/${i}.json`)
    );
    const basePairsFilename = `${i}_pairs.resid`;
    const basePairsString = basePairs.map(([left, right]) => `${left} ${right}`).join("\n");
    const basePairsFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}`, basePairsFilename);
    await fs.writeFile(basePairsFilePath, basePairsString);

    // parse output as list of annotations
    // every 3 lines is a new annotation
    const output: Annotation[] = [];
    for (let i = 0; i < resultSplit.length - 1; i += 3) {
      if (resultSplit[i] == undefined) {
        console.error(`Skipping undefined annotation at index ${i} in model ${i}`);
        continue; 
      }
      let name = resultSplit[i]?.slice(-1);

      if (name && labelToAuthorMap[name]) {
        console.log(`Replacing label ${name} with author label ${labelToAuthorMap[name]} in model ${i}`);
        name = labelToAuthorMap[name];
      }

      output.push({
        name: name,
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
    const mergedFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}`, mergedFilename);
    await fs.writeFile(mergedFilePath, mergedString);

    // save output as json file
    // const outputFilename = filename.split('.')[0] + '.json';
    const outputFilename = `${i}_annotation.json`;
    const outputString = JSON.stringify(output);
    const outputFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}`, outputFilename);
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

  return structuralElements;
};

const retrieveNumerationFromJson = async (
  filePath: string
): Promise<NumerationMap> => {
  const rawData = await fs.readFile(filePath, "utf-8");
  const jsonData = JSON.parse(rawData);

  const numerationMap: NumerationMap = {};

  if (jsonData.bpseq_index) {
    Object.entries(jsonData.bpseq_index).forEach(([annotator_residue_number, value]: [string, any]) => {
      // Skip only if value is completely missing or not object-like
      if (value === null || value === undefined) {
        return;
      }

      const label = value.label && typeof value.label === "object" ? value.label : undefined;
      const auth = value.auth && typeof value.auth === "object" ? value.auth : undefined;

      // Fallback: use label fields if auth fields are missing
      const chainId = auth?.chain ?? label?.chain ?? undefined;
      const residueNumber = auth?.number ?? label?.number ?? undefined;
      const nucleotideName = auth?.name ?? undefined;

      // get nucleotide name from jsonData.bpseq.sequence
      const annotator_nucleotide_name = jsonData.bpseq?.sequence?.[Number(annotator_residue_number) - 1] ?? "N";
      const annotator_dotbracket = jsonData.bpseq?.dot_bracket?.structure?.[Number(annotator_residue_number) - 1] ?? ".";
      numerationMap[Number(annotator_residue_number)] = {
        annotator_residue_number: Number(annotator_residue_number),
        annotator_nucleotide_name: annotator_nucleotide_name,
        annotator_dotbracket: annotator_dotbracket,
        label_chain_id: label?.chain ?? undefined,
        label_residue_number: label?.number ?? undefined,
        auth_chain_id: chainId,
        auth_residue_number: residueNumber,
        auth_nucleotide_name: nucleotideName,
      };
    });
  }

  return numerationMap;
};

const retrieveBasePairsFromJson = async (
  filePath: string
): Promise<Array<[number, number]>> => {
  const rawData = await fs.readFile(filePath, "utf-8");
  const jsonData = JSON.parse(rawData);

  const pairs = jsonData.bpseq?.pairs;
  if (!pairs || typeof pairs !== "object") {
    return [];
  }

  const uniquePairs = new Set<string>();
  for (const [leftRaw, rightRaw] of Object.entries(pairs)) {
    const left = Number(leftRaw);
    const right = Number(rightRaw);

    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      continue;
    }

    if (left < 1 || right < 1 || left === right) {
      continue;
    }

    const first = Math.min(left, right);
    const second = Math.max(left, right);
    uniquePairs.add(`${first} ${second}`);
  }

  return Array.from(uniquePairs)
    .map((pair) => pair.split(" ").map(Number) as [number, number])
    .sort((a, b) => {
      if (a[0] !== b[0]) {
        return a[0] - b[0];
      }

      return a[1] - b[1];
    });
};

export async function runMotifExtractor(
  id: string,
  numberOfModels: (string | number)[],
  modelsDir = "models"
) {
  console.log(`Running motif extractor on ${id}...`);
  const results = [];

  const modelNumbers = Array.isArray(numberOfModels) 
    ? numberOfModels 
    : Array.from({ length: numberOfModels }, (_, i) => i + 1);

  for (const i of modelNumbers) {
    const output = await retrieveMotifsFromJson(
      `${JOBS_DIR}/${id}/${modelsDir}/${i}.json`
    );

    results.push(output);

    const outputFilename = `${i}_motifs.json`;
    const outputString = JSON.stringify(output);
    const outputFilePath = resolve(`${JOBS_DIR}/${id}/${modelsDir}`, outputFilename);
    await fs.writeFile(outputFilePath, outputString);
  }

  console.log(`Ending running motif extractor on ${id}...`);

  return results;
}

export async function walkingSphere(
  id: string,
  modelNumber: number,
  radius: number,
  interval: number,
  modelsDir = "models"
) {
  console.log(`Using walking sphere on model ${modelNumber} of ${id}...`);

  // #sys.argv[1] = Nazwa analizowanego pliku
  // #sys.argv[2] = folder do którego trafią wyniki
  // #sys.argv[3] = wielkość promienia
  // #sys.argv[4] = Liczba określa co który C-alfa będzie brany pod uwagę

  // delete old sphere folder if exists
  try {
    await fs.rm(`${JOBS_DIR}/${id}/${modelNumber}_sphere`, { recursive: true });
  } catch (error) {
    console.log("Sphere folder does not exist, continuing...");
  }

  const sphere = spawnSync(`${SCRIPTS_DIR}/Walking_sphere.py`, [
    `${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}.pdb`,
    `${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}_residues.json`,
    `${JOBS_DIR}/${id}/${modelNumber}_sphere`,
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

export async function runFragmentExtraction(
  id: string,
  modelNumber: string,
  modelsDir = "models"
) {
  console.log(`Running fragment extraction on model ${modelNumber} of ${id}...`);

  const fragment = spawnSync(`${SCRIPTS_DIR}/Extract_fragment.py`, [
    `${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}.pdb`,
    `${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}_residues.json`,
    `${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}_fragment.pdb`,
  ], { encoding: "utf-8" });

  // console.log("stdout:", fragment.stdout);
  // console.error("stderr:", fragment.stderr);
  if (fragment.error) {
    console.error("Error running fragment extraction: ", fragment.error);
    throw fragment.error;
  }

  try {
    await fs.access(`${JOBS_DIR}/${id}/${modelsDir}/${modelNumber}_fragment.pdb`);
  } catch (e) {
    console.error("Fragment file was not created!");
    throw new Error("Fragment file was not created!");
  }

  return { success: true };
}

