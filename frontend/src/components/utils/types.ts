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

interface NumerationItem {
  annotator_residue_number: number;
  annotator_nucleotide_name: string;
  annotator_dotbracket: string;
  label_chain_id: string | undefined;
  label_residue_number: number | undefined;
  auth_chain_id: string;
  auth_residue_number: number;
  auth_nucleotide_name: string;
  moley_residue_number?: number;
  moley_chain_id?: string;
}

interface Numeration {
  [annotator_residue_number: number]: NumerationItem;
}

export interface Metadata {
  status: string;
  model_count: number;
}

export interface SelectedFragment {
  name: string;
  chainName: string;
  residues: number[];
  deselectedResidues: number[];
}

export interface RangeOfResidues {
  start: number | undefined;
  end: number | undefined;
  residues: string | undefined;
  dotbracket: string | undefined;
}

export interface StructuralElement {
  name: string | undefined;
  type: string | undefined;
  residues: RangeOfResidues[] | undefined;
}

export interface Job {
  id: number;
  originalfilename: string;
  name: string;
  createdat: string;
  updatedat: string;
  annotation: Annotation[];
  numeration: Numeration;
  motifs: StructuralElement[];
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
  structuralElements: StructuralElement[];
}

export interface Chain {
  name: string;
  original_name: string;
  nucleotides: Nucleotide[];
  sequence: string;
  dotBracket: string;
}

export interface ChainElement {
  chainID: string;
  residueID: number;
}

export interface JobToPost {
  id: string;
  models: Record<number, ChainElement[]>;
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

export interface ResidueMetrics {
  residue: string;
  worst_clash: string;
  src_atom: string;
  dst_atom: string;
  dst_residue: string;
  pucker_outlier_type: string;
  implied_pucker: string;
  suitename: string;
  suiteness: string;
}

export type Residue = {
  residue_number: number;
  original_index: number;
  base: string;
  structure: string;
  chainID: string;
  selected: boolean;
  structuralElements: StructuralElement[];
  metrics: Metrics;
  residueMetrics: ResidueMetrics;
}

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
    modelMetrics: Metrics;
    fragmentMetrics: Metrics;
    data: Residue[];
  };
  pdb_file_string: string;
}

export interface ModelStatus {
  modelNumber: string;
  status: `created` | `starting` | `running` | `completed` | `failed`;
  error_message?: string;
}

export interface Metadata {
  status: string;
  resultsStatus?: Record<string, ModelStatus>;
  model_count: number;
  error_message?: string;
  analyzeNeighborhoods?: boolean;
}

export enum QualityScore {
  CLASH_SCORE = "Clash Score",
  BAD_ANGLES = "Bad Angles",
  BAD_BONDS = "Bad Bonds",
  SUITENESS = "Suiteness",
  SUGAR_PUCKER_OUT = "Sugar Pucker Outlier",
}

export const clashScoreColorMap = new Map<number, string>();
export const badAnglesColorMap = new Map<number, string>();
export const badBondsColorMap = new Map<number, string>();
