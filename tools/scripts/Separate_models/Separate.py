#!/usr/bin/env python3

import sys
import shutil
import os
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 Separate.py <input_file> <output_folder>")
    sys.exit(1)

file = open(os.path.abspath(sys.argv[1]), 'r')
count = 0

for line in file:
    if line[0:6] == 'ENDMDL':
        count+=1

file.seek(0)

path_to_folder = Path(sys.argv[2])
if not path_to_folder.exists():
    path_to_folder.mkdir()

if count == 1:
    shutil.copy(os.path.abspath(sys.argv[1]), path_to_folder+"/1.pdb")
else:
    for x in range(count):
        f = open(os.path.abspath(path_to_folder)+"/"+str(x+1)+".pdb", "w")
        for line in file:
            if line[0:6] == 'ENDMDL':
                break
            elif line == "\n":
                continue
            else:
                f.write(line)
        f.write("END")
        f.close()


