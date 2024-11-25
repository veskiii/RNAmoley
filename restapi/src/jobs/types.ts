interface Atom {
    serial: number;
    name: string;
    altLoc: string;
    resName: string;
    chainID: string;
    resSeq: number;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: number;
    tempFactor: number;
    element: string;
    charge: string;
}

interface seqRes {
    serNum: number;
    chainID: string;
    numRes: number;
    resNames: string[];
}

interface Residue {
    id: number;
    serNum: number;
    chainID: string;
    resName: string;
    atoms: Atom[];
}

interface Chain {
    id: number;
    chainID: string;
    residues: Residue[];
}

export interface PDBFile {
    atoms: Atom[];
    seqRes: seqRes;
    residues: Residue[];
    chains: Map<string, Chain>;
}

export interface splitModelsResponse {
    numberOfModels: number;
}

export interface Annotation {
    name: string | undefined;
    sequnece: string | undefined;
    dotbracket: string | undefined;
}

export interface Metadata {
    status: `created` | `running` | `completed` | `failed`;
    model_count: number;
    last_used_model?: number;
}

export interface metrics {
    pdbFileName: string;
    x_H_type: string;
    chains: string;
    residues: string;
    nucacids: string;
    resolution: string;
    rvalue: string;
    rfree: string;
    clashscore: string;
    clashscoreB_40: string;
    minresol: string;
    maxresol: string;
    n_samples: string;
    pct_rank: string;
    pct_rank40: string;
    numbadbonds: string;
    numbonds: string;
    pct_badbonds: string;
    pct_resbadbonds: string;
    numbadangles: string;
    numangles: string;
    pct_badangles: string;
    pct_resbadangles: string;
    chiralSwaps: string;
    tetraOutliers: string;
    pseudochiralErrors: string;
    waterClashes: string;
    totalWaters: string;
    numPperpOutliers: string;
    numPperp: string;
    numSuiteOutliers: string;
    numSuites: string;
}

export interface Analysis_results {
    mode: `fragment` | `full`;
    data: [
        residue_number: number,
        metrics: metrics
    ][];
}

export interface Job {
    id: string;
    original_filename: string;
    name: string;
    metadata: Metadata;
    model_number: number;
    created_at: string;
    updated_at: string;
    annotation: Annotation[];
    numeration: { [key: string]: [number, string] };
    pdb_file: PDBFile;
    pdb_file_blob: Blob;
    results?: Analysis_results | null;
}