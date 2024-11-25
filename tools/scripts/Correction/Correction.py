import numpy as np
from Bio.PDB import PDBParser
import sys
import os
from pathlib import Path

file_name = os.path.abspath(sys.argv[1]).split('\\')[-1]

path_to_folder = Path(sys.argv[2])
if not path_to_folder.exists():
    path_to_folder.mkdir()

def correction(file_name):
    count = 1
    tmp_count = 0
    f = open(os.path.abspath(sys.argv[1]), "r")
    f_write = open(sys.argv[2] + '/' + file_name, "w")
    for line in f:
        if line[0:4] == "ATOM":
            if line[16:20].strip() == "C" or line[16:20].strip() == "A" or line[16:20].strip() == "G" or line[16:20].strip() == "T" or line[16:20].strip() == "U":
                if tmp_count == 0:
                    tmp_count = int(line[22:26].strip())
                if tmp_count < int(line[22:26].strip()):
                    count += 1
                    tmp_count = int(line[22:26].strip())
                if count < 10:
                    number = "   "+str(count)
                elif count >= 10 and count < 100:
                    number = "  "+str(count)
                elif count >= 100 and count < 1000:
                    number = " "+str(count)
                else:
                    number = str(count)
                new_line = line[0:22] + number + line[26:]
                f_write.write(new_line)

correction(file_name)
        
