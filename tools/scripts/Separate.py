#!/usr/bin/env python3

import sys
import os
import json
from pathlib import Path

def read_pdb_content(file_handle):
    """Read PDB lines and drop a CASP-style header if present."""
    file_handle.seek(0)
    lines = [line for line in file_handle if line.strip()]

    if (
        len(lines) >= 4
        and lines[0].startswith('PFRMAT')
        and lines[1].startswith('TARGET')
        and lines[2].startswith('MODEL')
        and lines[3].startswith('PARENT')
    ):
        return lines[4:]

    return lines

def detect_file_format(filepath):
    """Detect if file is PDB or CIF format based on extension and content"""
    extension = Path(filepath).suffix.lower()
    
    if extension == '.pdb':
        return 'pdb'
    elif extension == '.cif':
        return 'cif'
    else:
        # Try to detect from content
        with open(filepath, 'r') as f:
            first_lines = [f.readline().strip() for _ in range(10)]
        
        # Look for CIF indicators
        for line in first_lines:
            if line.startswith('data_') or '_atom_site' in line:
                return 'cif'
            elif line.startswith(('HEADER', 'TITLE', 'ATOM', 'HETATM')):
                return 'pdb'
    
    # Default to PDB if can't determine
    return 'pdb'

def count_models_pdb(file_handle):
    """Count models in PDB file"""
    count = 0
    file_handle.seek(0)
    
    for line in file_handle:
        if line.startswith('ENDMDL'):
            count += 1
    
    file_handle.seek(0)

    if count == 0:
        count = 1
    return count

def count_models_cif(file_handle):
    """Count models in CIF file by counting unique model numbers"""
    models = set()
    file_handle.seek(0)
    in_atom_site_loop = False
    atom_site_columns = []
    model_num_column = -1
    
    for line in file_handle:
        line = line.strip()
        if line.startswith('loop_'):
            in_atom_site_loop = False
            atom_site_columns = []
            model_num_column = -1
        elif line.startswith('_atom_site'):
            if not in_atom_site_loop:
                in_atom_site_loop = True
            atom_site_columns.append(line)
            # Check if this is the model number column
            if 'pdbx_PDB_model_num' in line:
                model_num_column = len(atom_site_columns) - 1
        elif in_atom_site_loop and line and not line.startswith('_') and not line.startswith('#'):
            # This is atom site data
            parts = line.split()
            if model_num_column >= 0 and len(parts) > model_num_column:
                try:
                    model_num = int(parts[model_num_column])
                    models.add(model_num)
                except (ValueError, IndexError):
                    continue
            elif model_num_column == -1 and len(parts) > 0:
                # Fallback: try first column if pdbx_PDB_model_num not found
                try:
                    model_num = int(parts[0])
                    models.add(model_num)
                except (ValueError, IndexError):
                    continue
    
    file_handle.seek(0)
    return len(models)

def separate_pdb_models(file_handle, output_folder, model_count):
    """Separate PDB models into individual files"""
    lines = read_pdb_content(file_handle)
    model_numbers = []
    
    if model_count == 1:
        # Single model file
        output_path = os.path.join(output_folder, "1.pdb")
        with open(output_path, "w") as f:
            for line in lines:
                if line.startswith('MODEL'):
                    continue
                if line.startswith('ENDMDL'):
                    continue
                f.write(line)
            f.write("END\n")
        model_numbers.append(1)
    else:
        # Multiple models - extract model number from MODEL line
        current_model = None
        f = None
        
        for line in lines:
            if line.startswith('MODEL'):
                # Extract model number from MODEL line
                try:
                    model_num = int(line.split()[1])
                except (IndexError, ValueError):
                    model_num = 1
                
                # Close previous file if open
                if f is not None and not f.closed:
                    f.write("END\n")
                    f.close()
                
                # Open new file with the extracted model number
                current_model = model_num
                model_numbers.append(current_model)
                output_path = os.path.join(output_folder, f"{current_model}.pdb")
                f = open(output_path, "w")
                
            elif line.startswith('ENDMDL'):
                if f is not None and not f.closed:
                    f.write("END\n")
                    f.close()
                f = None
            elif line.strip():  # Skip empty lines
                if f is not None and not f.closed:
                    f.write(line)
        
        # Close the last file if it's still open
        if f is not None and not f.closed:
            f.write("END\n")
            f.close()
    
    return model_numbers

def separate_cif_models(file_handle, output_folder, model_count):
    """Separate CIF models into individual files"""
    if model_count == 0:
        model_count = 1
    
    file_handle.seek(0)
    content = file_handle.read()
    lines = content.split('\n')
    model_numbers = []
    
    if model_count == 1:
        # Single model file
        output_path = os.path.join(output_folder, "1.cif")
        with open(output_path, "w") as f:
            f.write(content)
        model_numbers.append(1)
    else:
        # Multiple models - need to parse and separate
        models = {}
        header_lines = []
        in_atom_site_loop = False
        atom_site_columns = []
        model_num_column = -1
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if line.startswith('loop_'):
                in_atom_site_loop = False
                atom_site_columns = []
                model_num_column = -1
                header_lines.append(line)
            elif line.startswith('_atom_site'):
                if not in_atom_site_loop:
                    in_atom_site_loop = True
                atom_site_columns.append(line)
                # Check if this is the model number column
                if 'pdbx_PDB_model_num' in line:
                    model_num_column = len(atom_site_columns) - 1
            elif in_atom_site_loop and line and not line.startswith('_') and not line.startswith('#'):
                # This is atom site data
                parts = line.split()
                model_num = None
                
                if model_num_column >= 0 and len(parts) > model_num_column:
                    try:
                        model_num = int(parts[model_num_column])
                    except (ValueError, IndexError):
                        pass
                elif model_num_column == -1 and len(parts) > 0:
                    # Fallback: try first column if pdbx_PDB_model_num not found
                    try:
                        model_num = int(parts[0])
                    except (ValueError, IndexError):
                        pass
                
                if model_num is not None:
                    if model_num not in models:
                        models[model_num] = {
                            'header': header_lines.copy(),
                            'atom_header': atom_site_columns.copy(),
                            'atoms': []
                        }
                    models[model_num]['atoms'].append(line)
            elif not in_atom_site_loop:
                header_lines.append(line)
            
            i += 1
        
        # Write separate files for each model
        for model_num in sorted(models.keys()):
            output_path = os.path.join(output_folder, f"{model_num}.cif")
            with open(output_path, "w") as f:
                # Write header
                for header_line in models[model_num]['header']:
                    if header_line.strip():
                        f.write(header_line + '\n')
                
                # Write atom site header
                for atom_header_line in models[model_num]['atom_header']:
                    f.write(atom_header_line + '\n')
                
                # Write atoms for this model
                for atom_line in models[model_num]['atoms']:
                    f.write(atom_line + '\n')
                
                f.write('#\n')  # End of data block
            
            model_numbers.append(model_num)
    
    return model_numbers

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 Separate.py <input_file> <output_folder>")
        print("Supports both PDB and CIF formats")
        sys.exit(1)
    
    input_file = os.path.abspath(sys.argv[1])
    output_folder = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' does not exist")
        sys.exit(1)
    
    # Detect file format
    file_format = detect_file_format(input_file)
    
    # Create output folder
    path_to_folder = Path(output_folder)
    if not path_to_folder.exists():
        path_to_folder.mkdir(parents=True)
    
    # Open file and process
    model_numbers = []
    with open(input_file, 'r') as file:
        if file_format == 'pdb':
            model_count = count_models_pdb(file)
            model_numbers = separate_pdb_models(file, output_folder, model_count)
        else:  # CIF format
            model_count = count_models_cif(file)
            model_numbers = separate_cif_models(file, output_folder, model_count)
    
    # Output JSON with model numbers
    output = json.dumps({"models": model_numbers})
    print(output)
    sys.stdout.flush()

if __name__ == "__main__":
    main()
