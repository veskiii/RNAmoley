#!/usr/bin/env python3

import sys
import json
import os
from Bio.PDB import PDBParser, MMCIFParser, PDBIO, MMCIFIO, Select

class ResidueSelect(Select):
    def __init__(self, residue_set):
        self.residue_set = residue_set

    def accept_residue(self, residue):
        chain_id = residue.get_parent().id
        res_id = residue.id[1]
        return (str(chain_id), int(res_id)) in self.residue_set

def extract_residues(input_path, json_path, output_path):
    print(f"extract_residues: input_path={input_path}, json_path={json_path}, output_path={output_path}")
    try:
        with open(json_path, 'r') as f:
            residues = json.load(f)
        print(f"Loaded residues: {residues}")
        residue_set = set((str(r['chainID']), int(r['residueID'])) for r in residues)
        print(f"Residue set: {residue_set}")

        input_ext = os.path.splitext(input_path)[1].lower()
        
        if input_ext == '.cif':
            parser = MMCIFParser(QUIET=True)
            print("Using MMCIF parser for input.")
        else:
            parser = PDBParser(QUIET=True)
            print("Using PDB parser for input.")
        
        structure = parser.get_structure('structure', input_path)
        print(f"Structure loaded from {input_path}")

        output_ext = os.path.splitext(output_path)[1].lower()
        
        if output_ext == '.cif':
            io = MMCIFIO()
            print("Using MMCIF format for output.")
        else:
            io = PDBIO()
            print("Using PDB format for output.")
        
        io.set_structure(structure)
        io.save(output_path, ResidueSelect(residue_set))
        print(f"Fragment saved to {output_path}")
    except Exception as e:
        print(f"Exception occurred: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python Extract_fragment.py <input_file.(pdb|cif)> <json_file> <output_file.(pdb|cif)>")
        sys.exit(1)
    input_path = sys.argv[1]
    json_path = sys.argv[2]
    output_path = sys.argv[3]
    extract_residues(input_path, json_path, output_path)