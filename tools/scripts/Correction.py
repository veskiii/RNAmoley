#!/usr/bin/env python3

import sys
import os
import json
from pathlib import Path
from Bio import PDB
from Bio.PDB import PDBIO, MMCIFIO
from Bio.PDB.MMCIF2Dict import MMCIF2Dict
import warnings

# Suppress BioPython warnings
warnings.filterwarnings("ignore")

path_to_folder = Path(os.path.dirname(sys.argv[2]))
if not path_to_folder.exists():
    path_to_folder.mkdir()

def detect_file_format(filename):
    """Detect whether the file is PDB or mmCIF format"""
    _, ext = os.path.splitext(filename.lower())
    if ext in ['.cif', '.mmcif']:
        return 'mmcif'
    else:
        return 'pdb'

def get_label_asym_mapping(filename, file_format):
    """Get mapping between auth_asym_id and label_asym_id for mmCIF files"""
    if file_format != 'mmcif':
        return {}
    
    try:
        mmcif_dict = MMCIF2Dict(filename)
        auth_asym_ids = mmcif_dict.get("_atom_site.auth_asym_id", [])
        label_asym_ids = mmcif_dict.get("_atom_site.label_asym_id", [])
        
        # Create mapping from auth_asym_id to label_asym_id
        mapping = {}
        for auth_id, label_id in zip(auth_asym_ids, label_asym_ids):
            if auth_id not in mapping:
                mapping[auth_id] = label_id
        
        return mapping
    except Exception as e:
        print(f"Warning: Could not extract label_asym_id mapping: {e}")
        return {}

def get_nucleotide_residues(structure):
    """Get all nucleotide residues from the structure"""
    nucleotide_names = {'A', 'G', 'C', 'T', 'U', 'DA', 'DG', 'DC', 'DT'}
    nucleotides = []
    
    for model in structure:
        for chain in model:
            for residue in chain:
                if residue.get_resname().strip() in nucleotide_names:
                    nucleotides.append((model.id, chain.id, residue))
    
    return nucleotides

def correction():
    input_file = os.path.abspath(sys.argv[1])
    output_file_path = os.path.abspath(sys.argv[2])
    
    # Detect file format
    file_format = detect_file_format(input_file)
    
    # Get label_asym_id mapping for mmCIF files
    label_asym_mapping = get_label_asym_mapping(input_file, file_format)
    
    # Parse structure using BioPython
    parser = PDB.PDBParser(QUIET=True) if file_format == 'pdb' else PDB.MMCIFParser(QUIET=True)
    
    try:
        structure = parser.get_structure('structure', input_file)
    except Exception as e:
        print(f"Error parsing file: {e}")
        return
    
    # Get all nucleotide residues
    nucleotides = get_nucleotide_residues(structure)
    
    if not nucleotides:
        print("No nucleotide residues found in the structure")
        return
    
    # Sort nucleotides by model, chain, and original residue number
    nucleotides.sort(key=lambda x: (x[0], x[1], x[2].id[1]))
    
    # Create chain mapping
    chain_map = {}
    chain_counter = 0
    alphabet = [chr(i) for i in range(ord('C'), ord('Z')+1)]
    
    # Store mapping information for JSON output
    residue_mapping = {}
    
    # Group nucleotides by chain and renumber
    current_chain = None
    residue_counter = 1
    
    for model_id, chain_id, residue in nucleotides:
        # Get label_asym_id from mapping
        label_asym_id = label_asym_mapping.get(chain_id, chain_id)
        
        # Create new chain ID if needed
        if chain_id not in chain_map:
            if chain_counter < len(alphabet):
                new_chain_id = alphabet[chain_counter]
                chain_map[chain_id] = new_chain_id
                chain_counter += 1
            else:
                print(f"Warning: Too many chains, using original chain ID for {chain_id}")
                chain_map[chain_id] = chain_id
        
        # Check if we moved to a new chain
        if current_chain != chain_id:
            current_chain = chain_id
            residue_counter = 1
        
        # Add mapping information
        residue_mapping[residue_counter] = {
            "original_residue_number": residue.id[1],
            "original_chain_id": chain_id,  # auth_asym_id
            "original_label_asym_id": label_asym_id,  # label_asym_id
            "new_residue_number": residue_counter,
            "new_chain_id": chain_map[chain_id]
        }

        # Update residue ID with new numbering
        old_id = residue.id
        new_id = (' ', residue_counter, ' ')  # (hetfield, seqid, icode)
        residue.id = new_id
        
        # Update the parent chain reference
        chain = residue.get_parent()
        if chain.id != chain_map[chain_id]:
            # Change chain ID
            chain.id = chain_map[chain_id]
        
        residue_counter += 1
    
    # Write output file
    try:
        if file_format == 'pdb':
            io = PDBIO()
            io.set_structure(structure)
            io.save(output_file_path)
        else:  # mmcif
            io = MMCIFIO()
            io.set_structure(structure)
            io.save(output_file_path)
        
        print(f"Corrected structure saved to: {output_file_path}")
        print(f"Processed {len(nucleotides)} nucleotide residues")
        print(f"Chain mapping: {chain_map}")
        
        # Save mapping information to JSON file
        json_output_path = os.path.splitext(output_file_path)[0] + "_numeration.json"
        with open(json_output_path, 'w') as json_file:
            json.dump(residue_mapping, json_file, indent=2)
        
        print(f"Residue mapping saved to: {json_output_path}")
        
    except Exception as e:
        print(f"Error saving file: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python Correction.py <input_file> <output_file>")
        sys.exit(1)
    
    correction()
