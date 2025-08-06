#!/usr/bin/env python3

import numpy as np
from Bio.PDB import PDBParser, MMCIFParser
import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple, Optional

def log(msg: str) -> None:
    """Log message to stderr with timestamp"""
    print(f"[Universal_walking_sphere] {msg}", file=sys.stderr)

class StructureProcessor:
    """Class to handle structure processing for both PDB and mmCIF formats"""
    
    def __init__(self, structure_file: str, selected_residues_file: str, 
                 output_folder: str, radius: float, interval: int):
        self.structure_file = Path(structure_file)
        self.selected_residues_file = Path(selected_residues_file)
        self.output_folder = Path(output_folder)
        self.radius = radius
        self.interval = interval
        
        # Initialize parser based on file extension
        self.parser, self.structure = self._initialize_parser()
        self.selected_residues = self._load_selected_residues()
        
        # Create output folder if it doesn't exist
        self.output_folder.mkdir(parents=True, exist_ok=True)
        log(f"Output folder: {self.output_folder}")
        
    def _initialize_parser(self) -> Tuple[object, object]:
        """Initialize appropriate parser based on file extension"""
        file_extension = self.structure_file.suffix.lower()
        
        if file_extension in ['.pdb', '.ent']:
            parser = PDBParser(QUIET=True)
            log(f"Using PDB parser for {self.structure_file}")
        elif file_extension in ['.cif', '.mmcif']:
            parser = MMCIFParser(QUIET=True)
            log(f"Using mmCIF parser for {self.structure_file}")
        else:
            raise ValueError(f"Unsupported file format: {file_extension}. "
                           "Supported formats: .pdb, .ent, .cif, .mmcif")
        
        structure = parser.get_structure('structure', str(self.structure_file))
        log(f"Successfully parsed structure from {self.structure_file}")
        return parser, structure
    
    def _load_selected_residues(self) -> List[Dict]:
        """Load selected residues from JSON file"""
        try:
            with open(self.selected_residues_file, 'r') as f:
                selected_residues = json.load(f)
            log(f"Loaded {len(selected_residues)} selected residues")
            return selected_residues
        except (FileNotFoundError, json.JSONDecodeError) as e:
            log(f"Error loading selected residues: {e}")
            raise
    
    def _is_selected_residue(self, chain_id: str, residue_id: int) -> bool:
        """Check if residue is in selected residues list"""
        return any(
            res.get("chainID") == chain_id and res.get("residueID") == residue_id 
            for res in self.selected_residues
        )
    
    def _find_atoms_in_sphere(self, center_atom) -> List[str]:
        """Find all residue IDs that have atoms within the sphere radius"""
        residue_ids = set()
        center_coord = center_atom.coord
        
        for atom in self.structure.get_atoms():
            distance = np.linalg.norm(center_coord - atom.coord)
            if distance <= self.radius:
                residue_id = atom.get_full_id()[3][1]
                residue_ids.add(str(residue_id))
        
        return list(residue_ids)
    
    def _write_sphere_file(self, center_atom, sphere_residues: List[str]) -> str:
        """Write sphere file containing all atoms from residues in sphere"""
        residue_id = center_atom.get_full_id()[3][1]
        output_file = self.output_folder / f"{residue_id}.pdb"
        
        log(f"Writing sphere file: {output_file}")
        
        # Determine if input is mmCIF or PDB
        is_mmcif = self.structure_file.suffix.lower() in ['.cif', '.mmcif']
        
        if is_mmcif:
            written_atoms = self._write_sphere_from_mmcif(output_file, sphere_residues)
        else:
            written_atoms = self._write_sphere_from_pdb(output_file, sphere_residues)
        
        log(f"Wrote {written_atoms} atoms to {output_file}")
        return str(output_file)
    
    def _write_sphere_from_pdb(self, output_file: Path, sphere_residues: List[str]) -> int:
        """Write sphere file from PDB format"""
        with open(self.structure_file, 'r') as f:
            original_lines = f.readlines()
        
        written_atoms = 0
        with open(output_file, 'w') as sphere_file:
            # Write header lines (non-ATOM/HETATM lines at the beginning)
            for line in original_lines:
                if not (line.startswith('ATOM') or line.startswith('HETATM')):
                    sphere_file.write(line)
                else:
                    break
            
            # Write atoms from residues in sphere
            for line in original_lines:
                if line.startswith('ATOM') or line.startswith('HETATM'):
                    # Extract residue number from PDB line (columns 23-26, 1-indexed)
                    try:
                        line_residue_id = line[22:26].strip()
                        if line_residue_id in sphere_residues:
                            sphere_file.write(line)
                            written_atoms += 1
                    except (IndexError, ValueError):
                        continue
            
            # Write connection and end records
            for line in original_lines:
                if line.startswith(('CONECT', 'MASTER', 'END')):
                    sphere_file.write(line)
        
        return written_atoms
    
    def _write_sphere_from_mmcif(self, output_file: Path, sphere_residues: List[str]) -> int:
        """Write sphere file from mmCIF format - convert to PDB format"""
        written_atoms = 0
        
        with open(output_file, 'w') as sphere_file:
            # Write minimal PDB header
            sphere_file.write("HEADER    SPHERE EXTRACTION FROM MMCIF\n")
            sphere_file.write("REMARK   Generated by Universal_walking_sphere.py\n")
            
            atom_serial = 1
            
            # Extract atoms from BioPython structure and write in PDB format
            for model in self.structure:
                for chain in model:
                    for residue in chain:
                        residue_id_str = str(residue.get_id()[1])
                        
                        if residue_id_str in sphere_residues:
                            chain_id = chain.get_id()
                            res_name = residue.get_resname()
                            res_num = residue.get_id()[1]
                            
                            for atom in residue:
                                coord = atom.get_coord()
                                atom_name = atom.get_name()
                                element = atom.element if hasattr(atom, 'element') and atom.element else atom_name[0]
                                
                                # Write in PDB ATOM format
                                pdb_line = (
                                    f"ATOM  {atom_serial:5d}  {atom_name:<4s} {res_name:>3s} "
                                    f"{chain_id:1s}{res_num:4d}    "
                                    f"{coord[0]:8.3f}{coord[1]:8.3f}{coord[2]:8.3f}"
                                    f"  1.00  0.00           {element:>2s}\n"
                                )
                                sphere_file.write(pdb_line)
                                written_atoms += 1
                                atom_serial += 1
            
            # Write PDB end record
            sphere_file.write("END\n")
        
        return written_atoms
    
    def process_structure(self) -> List[str]:
        """Main processing function - create spheres around selected C1' atoms"""
        log("Starting structure processing")
        
        created_files = []
        processed_count = 0
        interval_count = 0
        
        # Find all C1' atoms in selected residues
        c1_atoms = []
        for atom in self.structure.get_atoms():
            if atom.id.strip("'") == "C1":  # C1' atom in RNA/DNA
                chain_id = atom.get_full_id()[2]
                residue_id = atom.get_full_id()[3][1]
                
                if self._is_selected_residue(chain_id, residue_id):
                    c1_atoms.append(atom)
        
        log(f"Found {len(c1_atoms)} C1' atoms in selected residues")
        
        # Process atoms according to interval
        for atom in c1_atoms:
            chain_id = atom.get_full_id()[2]
            residue_id = atom.get_full_id()[3][1]
            
            interval_count += 1
            
            if interval_count % self.interval == 0:
                log(f"Processing atom: chain {chain_id}, residue {residue_id}")
                
                # Find atoms in sphere
                sphere_residues = self._find_atoms_in_sphere(atom)
                log(f"Found {len(sphere_residues)} residues in sphere (radius: {self.radius}Å)")
                
                # Write sphere file
                output_file = self._write_sphere_file(atom, sphere_residues)
                created_files.append(output_file)
                processed_count += 1
            else:
                log(f"Skipping atom: chain {chain_id}, residue {residue_id} (interval)")
        
        log(f"Processing complete. Created {processed_count} sphere files.")
        return created_files

def main():
    """Main function to handle command line arguments and run processing"""
    if len(sys.argv) != 6:
        print("Usage: python Universal_walking_sphere.py <structure_file> <selected_residues.json> <output_folder> <radius> <interval>", file=sys.stderr)
        print("", file=sys.stderr)
        print("Arguments:", file=sys.stderr)
        print("  structure_file     - Path to PDB or mmCIF structure file", file=sys.stderr)
        print("  selected_residues  - JSON file with selected residues", file=sys.stderr)
        print("  output_folder      - Directory for output sphere files", file=sys.stderr)
        print("  radius            - Sphere radius in Angstroms", file=sys.stderr)
        print("  interval          - Process every Nth C1' atom (1 = all, 2 = every second, etc.)", file=sys.stderr)
        print("", file=sys.stderr)
        print("Supported formats: .pdb, .ent, .cif, .mmcif", file=sys.stderr)
        sys.exit(1)
    
    try:
        structure_file = sys.argv[1]
        selected_residues_file = sys.argv[2]
        output_folder = sys.argv[3]
        radius = float(sys.argv[4])
        interval = int(sys.argv[5])
        
        log(f"Input structure: {os.path.abspath(structure_file)}")
        log(f"Selected residues: {os.path.abspath(selected_residues_file)}")
        log(f"Output folder: {os.path.abspath(output_folder)}")
        log(f"Radius: {radius}Å, Interval: {interval}")
        
        # Validate inputs
        if radius <= 0:
            raise ValueError("Radius must be positive")
        if interval <= 0:
            raise ValueError("Interval must be positive")
        
        # Process structure
        processor = StructureProcessor(
            structure_file, selected_residues_file, 
            output_folder, radius, interval
        )
        
        created_files = processor.process_structure()
        
        # Print summary
        print(f"Successfully created {len(created_files)} sphere files:", file=sys.stderr)
        for file_path in created_files:
            print(f"  {file_path}", file=sys.stderr)
            
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
