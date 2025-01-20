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