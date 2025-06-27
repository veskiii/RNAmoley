#!/usr/bin/env python3

import numpy as np
from Bio.PDB import PDBParser
import json
import sys
import multiprocessing as mp
import os
from pathlib import Path

parser = PDBParser()

def log(msg):
    print(f"[Walking_sphere] {msg}", file=sys.stderr)

#sys.argv[1] = Nazwa analizowanego pliku
#sys.argv[2] = plik z wybranymi resztami (json)
#sys.argv[3] = folder do którego trafią wyniki
#sys.argv[4] = wielkość promienia
#sys.argv[5] = Liczba określa co który C-alfa będzie brany pod uwagę

log(f"Parsing structure from {os.path.abspath(sys.argv[1])}")
molecule = parser.get_structure('XNA',os.path.abspath(sys.argv[1]))

pdb_file = os.path.abspath(sys.argv[1])
selected_residues_file = os.path.abspath(sys.argv[2])
output_folder_path = Path(sys.argv[3])
radius = int(sys.argv[4])
Interval = int(sys.argv[5])
Interval_count = Interval
count = 1

log(f"Output folder: {output_folder_path}")
log(f"Radius: {radius}, Interval: {Interval}")

if not output_folder_path.exists():
    output_folder_path.mkdir()
    log(f"Created output folder: {output_folder_path}")

def walking_sphere(pdb_file, selected_residues_file, count, Interval_count, Interval):
    log("Starting walking_sphere function")
    with open(pdb_file, 'r') as file:
        pdb_lines = file.readlines()
        log(f"Read {len(pdb_lines)} lines from PDB file")
    with open(selected_residues_file, 'r') as f:
        selected_residues = json.load(f)
        log(f"Loaded {len(selected_residues)} selected residues")

    for main_atom in molecule.get_atoms():
        if main_atom.id.strip("'") != "C1":
            continue
        chain_id = main_atom.get_full_id()[2]
        residue_id = main_atom.get_full_id()[3][1]
        log(f"Checking atom: chain {chain_id}, residue {residue_id}")
        if not any(res.get("chainID") == chain_id and res.get("residueID") == residue_id for res in selected_residues):
            log(f"Skipping atom: chain {chain_id}, residue {residue_id} (not in selected)")
            continue
        if Interval_count == Interval:
            Interval_count = 1
            list = []
            path_to_sphere_file = os.path.abspath(output_folder_path)+'/'+str(main_atom.get_full_id()[3][1])+'.pdb'
            log(f"Writing sphere file: {path_to_sphere_file}")
            with open(path_to_sphere_file, 'w') as sphere_file:
                count+=1
                for line in pdb_lines:
                    if line[0:4] != 'ATOM' and line[0:6] != 'HETATM':
                        sphere_file.write(line)
                    else:
                        break
                for supp_atom in molecule.get_atoms():
                    distance = np.linalg.norm(main_atom.coord - supp_atom.coord)
                    if distance <= radius:
                        for line in pdb_lines:
                            if line[0:4].strip(" ") == 'ATOM' or line[0:6].strip(" ") == 'HETATM':
                                if line[7:11].strip(" ") == str(supp_atom.serial_number):
                                    if line[22:26].strip(" ") not in list:
                                        list.append(line[22:26].strip(" "))
                                else:
                                    continue
                log(f"Residues in sphere: {list}")
                written = 0
                for line in pdb_lines:
                    if line[22:26].strip(" ") in list:
                        sphere_file.write(line)
                        written += 1
                log(f"Wrote {written} atom lines to {path_to_sphere_file}")
                for line in pdb_lines:
                    if line[0:6] == 'CONECT' or line[0:6] == 'MASTER' or line[0:3] == 'END':
                        sphere_file.write(line)
            log(f"Finished writing {path_to_sphere_file}")
        else:
            Interval_count += 1
            continue

walking_sphere(pdb_file, selected_residues_file, count, Interval_count, Interval)

#pool = mp.Pool(mp.cpu_count())
#pool.map(Walking_sphere, file_count)

#elif option == "1":
    #f = open('User_choice_residues/Desired.txt', 'w')
    #main_file = open('example.pdb', 'r')
    #tmp_file = open('example.pdb', 'r')

    #for line in main_file:
        #if line[22:26].strip(" ") == str(desired) and re.sub("[']*", '', line[11:16]).replace(" ","") == "C1":
            #list = []
            #for lines in file:
                #if lines[0:4].replace(" ", "") == 'ATOM' or lines[0:6].replace(" ","") == 'HETATM':

                    #main_atom_coord = np.array([float(line[26:38].replace(" ","")), float(line[39:46].replace(" ","")), float(line[47:54].replace(" ",""))])
                    #supp_atom_coord = np.array([float(lines[26:38].replace(" ","")), float(lines[39:46].replace(" ","")), float(lines[47:54].replace(" ","")) ])
                    #distance = np.linalg.norm(main_atom_coord - supp_atom_coord)
                    #if distance <= radius:
                        #if lines[22:26].replace(" ", "") not in list:
                            #list.append(lines[22:26].replace(" ",""))
            #file.seek(0)
            #for lines in file:
                #if lines[22:26].replace(" ", "") in list:
                    #f.write(lines)
    #file.seek(0)
    #for line in file:
        #if line[0:6] == 'CONECT' or line[0:6] == 'MASTER' or line[0:3] == 'END' or line[0:6] == 'ENDMDL':
            #f.write(line)
    #f.close()
    #main_file.close()
    #tmp_file.close()
    #file.close()

