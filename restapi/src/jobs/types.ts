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

export interface JobResponse {
    id: string;
    original_filename: string;
    name: string;
    status: string;
    model_number: number;
    created_at: string;
    updated_at: string;
    annotation: Annotation[];
    numeration: { [key: string]: [number, string] };
    pdb_file: PDBFile;
    pdb_file_blob: Blob;
}