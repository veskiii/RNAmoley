import numpy as np
from Bio.PDB import PDBParser
import re
import sys
import shutil
import os
from pathlib import Path

file = open(os.path.abspath(sys.argv[1]), 'r')
count = 0

for line in file:
    if line[0:6] == 'ENDMDL':
        count+=1

file.seek(0)

y = sys.argv[1].split('/')
y = y[-1].split('.')

if count == 1:
    shutil.copy(os.path.abspath(sys.argv[1]), os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/Renumber/model1.pdb")
else:
    for x in range(count):
        f = open(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/Renumber/"+y[0]+"_model_"+str(x+1)+".pdb", "w")
        for line in file:
            if line[0:6] == 'ENDMDL':
                break
            elif line == "\n":
                continue
            else:
                f.write(line)
        f.write("END")
        f.close()


