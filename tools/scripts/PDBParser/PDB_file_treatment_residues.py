import numpy as np
from Bio.PDB import PDBParser
import re
import sys
import multiprocessing as mp
import os
from pathlib import Path

parser = PDBParser()

#pdb_file = Tutaj nazwa pliku_pdb
#molecule = parser.get_structure('XNA',pdb_file)
#radius = promień
#desired = zaznaczony nukleotyd

molecule = parser.get_structure('XNA',os.path.abspath(sys.argv[1]))

radius = 16
count = 1

#file_count = []
#for residue in molecule.get_residues():
    #file_count.append(residue.id[1])

path_to_folder = Path(sys.argv[2])
if not path_to_folder.exists():
    path_to_folder.mkdir()

print(os.path.abspath(path_to_folder))

def Walking_sphere(count):
    for main_atom in molecule.get_atoms():
        file = open(os.path.abspath(sys.argv[1]), 'r')
        if main_atom.id.strip("'") != "C1":
            continue
        list = []
        f = open(os.path.abspath(path_to_folder)+'/'+str(count)+'.pdb', 'w')
        count+=1
        for line in file:
            if line[0:4] != 'ATOM' and line[0:6] != 'HETATM':
                f.write(line)
            else:
                break
        for supp_atom in molecule.get_atoms():
            file.seek(0)
            distance = np.linalg.norm(main_atom.coord - supp_atom.coord)
            if distance <= radius:
                for line in file:
                    if line[0:4].strip(" ") == 'ATOM' or line[0:6].strip(" ") == 'HETATM':
                        if line[7:11].strip(" ") == str(supp_atom.serial_number):
                            if line[22:26].strip(" ") not in list:
                                list.append(line[22:26].strip(" "))
                        else:
                            continue
        file.seek(0)
        for line in file:
            if line[22:26].strip(" ") in list:
                f.write(line)
        file.seek(0)
        for line in file:
            if line[0:6] == 'CONECT' or line[0:6] == 'MASTER' or line[0:3] == 'END':
                f.write(line)
        f.close()
        file.seek(0)
    file.close()

Walking_sphere(count)

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

