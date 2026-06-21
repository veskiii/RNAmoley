import type { UUID } from "crypto";
import type { Mode } from "fs";

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
  modelNumbers: number[];
}

export interface Annotation {
  name: string | undefined;
  sequnece: string | undefined;
  dotbracket: string | undefined;
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

export interface ModelStatus {
  modelNumber: string;
  status: `created` | `starting` | `running` | `completed` | `failed` | `sim_starting` | `sim_running` | `sim_finished` | `sim_analyzing` | `sim_completed` | `sim_failed`;
  error_message?: string;
  chains?: string[];
  selectedFragments?: Record<string, string>;
}

export interface Metadata {
  status: `creating` | `created` | `starting` | `running` | `completed` | `failed` | `simulation_starting` | `simulation_running` | `simulation_completed` | `simulation_failed`;
  jobName?: string;
  resultsStatus?: Record<string, ModelStatus>;
  simulations?: Record<string, SimulationInfo>;
  models: number[];
  radius?: number;
  interval?: number;
  error_message?: string;
  analyzeNeighborhoods?: boolean;
  containsNonRNA?: boolean;
  nonRNAContents?: string[];
}

export interface SimulationParameters {
  restraintBackboneForce: number;
  restraintGlobalForce: number;
  restraintBasePairsForce: number;
  rmsdCutoff: number;
  simOnlyFragment: boolean;
};

export interface SimulationInfo {
  simJobId: string;
  status: string;
  parameters: SimulationParameters;
  startedAt?: string;
  completedAt?: string;
}

export interface metrics {
  pdbFileName: string;
  // x_H_type: string;
  chains: string;
  residues: string;
  // nucacids: string;
  // resolution: string;
  // rvalue: string;
  // rfree: string;
  clashscore: string;
  // clashscoreB_40: string;
  // minresol: string;
  // maxresol: string;
  // n_samples: string;
  // pct_rank: string;
  // pct_rank40: string;
  numbadbonds: string;
  numbonds: string;
  pct_badbonds: string;
  pct_resbadbonds: string;
  numbadangles: string;
  numangles: string;
  pct_badangles: string;
  pct_resbadangles: string;
  // chiralSwaps: string;
  // tetraOutliers: string;
  // pseudochiralErrors: string;
  // waterClashes: string;
  // totalWaters: string;
  // numPperpOutliers: string;
  // numPperp: string;
  numSuiteOutliers: string;
  numSuites: string;
  medianSuiteness?: string;
}

export interface ClashAtomRef {
  chain: string;
  residueNumber: string;
  residueName: string;
  atomName: string;
};

export interface ClashEntry {
  source: ClashAtomRef;
  target: ClashAtomRef;
  overlapAngstrom: number;
};

export interface ClashscoreParsedResult {
  messages: string[];
  thresholdAngstrom: number | null;
  clashes: ClashEntry[];
  clashscore: number | null;
  clashscoreB40: number | null;
  unparsed: string[];
};

export interface BadBondEntry {
  atoms: [string, string];
  value: number;
  sigma: number;
};

export interface BadAngleEntry {
  atoms: [string, string, string];
  value: number;
  sigma: number;
};

export interface GeoResidueSummary {
  resId: string;
  chainId: string;
  base: string;
  badBondCount: number;
  bondCount: number;
  badAngleCount: number;
  angleCount: number;
  badBonds: BadBondEntry[];
  badAngles: BadAngleEntry[];
};

export interface nucleotideResult {
  residue_number: number;
  original_index: number;
  base: string;
  structure: string;
  chainID: string;
  original_chain_id: string;
  selected: boolean;
  structuralElements: StructuralElement[];
  metrics?: metrics;
  residueMetrics: residueMetrics;
}

export interface Analysis_results {
  // mode: `fragment` | `full`;
  data: nucleotideResult[];
  modelMetrics: metrics;
  fragmentMetrics: metrics;
}

export interface NumerationItem {
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

export interface Numeration {
  [annotator_residue_number: number]: NumerationItem;
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
  numeration: Numeration;
  motifs: StructuralElement[];
  // pdb_file: PDBFile;
  pdb_file_string: string;
  results?: Analysis_results | null;
}

export interface NewJob {
  id: UUID;
  original_filename: string;
  original_extension: string;
  new_filename: string;
  name: string;
  metadata: Metadata;
}

export interface residueMetrics {
  file_name: string;
  // "x-H_type": string;
  residue: string;
  // res_high_B: string;
  // mc_high_B: string;
  worst_clash: string;
  src_atom: string;
  dst_atom: string;
  dst_residue: string;
  pucker_outlier_type: string;
  implied_pucker: string;
  suitename: string;
  // "d-1dg_bin": string;
  // triage: string;
  suiteness: string;
  // num_length_out: string;
  // worst_length: string;
  // worst_length_value: string;
  worst_length_sigma: string;
  // num_angle_out: string;
  // worst_angle: string;
  // worst_angle_value: string;
  worst_angle_sigma: string;
  // outlier_count: string;
  // outlier_count_sep_geom: string;
}

export interface ChainElement {
  chainID: string;
  residueID: number;
}
