#!/usr/bin/env python3

import sys
import json
from Bio.PDB import PDBParser, PDBIO, Select

class ResidueSelect(Select):
    def __init__(self, residue_set):
        self.residue_set = residue_set

    def accept_residue(self, residue):
        chain_id = residue.get_parent().id
        res_id = residue.id[1]
        return (str(chain_id), int(res_id)) in self.residue_set

def extract_residues(pdb_path, json_path, output_path):
    print(f"extract_residues: pdb_path={pdb_path}, json_path={json_path}, output_path={output_path}")
    try:
        with open(json_path, 'r') as f:
            residues = json.load(f)
        print(f"Loaded residues: {residues}")
        residue_set = set((str(r['chainID']), int(r['residueID'])) for r in residues)
        print(f"Residue set: {residue_set}")

        parser = PDBParser(QUIET=True)
        structure = parser.get_structure('structure', pdb_path)
        print("PDB structure loaded.")

        io = PDBIO()
        io.set_structure(structure)
        io.save(output_path, ResidueSelect(residue_set))
        print(f"Fragment saved to {output_path}")
    except Exception as e:
        print(f"Exception occurred: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Użycie: python Extract_fragment.py <plik.pdb> <plik.json> <plik_wyjsciowy.pdb>")
        sys.exit(1)
    pdb_path = sys.argv[1]
    json_path = sys.argv[2]
    output_path = sys.argv[3]
    extract_residues(pdb_path, json_path, output_path)