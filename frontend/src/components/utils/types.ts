export interface Atom {
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

export interface Annotation {
    name: string;
    sequnece: string;
    dotbracket: string;
}

export interface Numeration {
    [key: string]: [number, string];
}

export interface Metadata {
    status: string;
    model_count: number;
}

export interface Job {
    id: number;
    originalfilename: string;
    name: string;
    createdat: string;
    updatedat: string;
    annotation: Annotation[];
    numeration: Numeration;
    data: {
        atoms: Atom[];
    };
    pdb_file_string: string;
    metadata: Metadata;
    model_number: number;
}

export interface Nucleotide {
    index: number;
    original_index: number;
    base: string;
    structure: string;
    selected: boolean;
}

export interface Chain {
    name: string;
    nucleotides: Nucleotide[];
    sequence: string;
    dotBracket: string;
}

export interface JobToPost {
    id: string;
    residues: number[];
    modelNumber: number;
    radius: number;
    interval: number;
}

export interface Metrics {
    clashscore: string;
    numbadbonds: string;
    pct_badbonds: string;
    numbadangles: string;
    pct_badangles: string;
}

export type Residue = {
    residue_number: number;
    metrics: Metrics;
};

export interface SummaryJob {
    id: number;
    originalfilename: string;
    name: string;
    createdat: string;
    updatedat: string;
    annotation: Annotation[];
    metadata: Metadata;
    numeration: Numeration;
    results: {
        mode: string;
        data: Residue[];
    }
    pdb_file_string: string;
}

export interface Metadata {
    status: string;
}

export enum QualityScore {
    CLASH_SCORE = "Clash Score",
    BAD_ANGLES = "Bad Angles",
    BAD_BONDS = "Bad Bonds",
}

export const clashScoreColorMap = new Map<number, string>()
export const badAnglesColorMap = new Map<number, string>()
export const badBondsColorMap = new Map<number, string>()