#!/usr/bin/env python3

import sys
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

# The file probably only contains one model
if count == 0:
    count += 1

if count == 1:
    with open(os.path.join(path_to_folder, "1.pdb"), "w") as f:
        for line in file:
            if line == "\n":
                continue
            f.write(line)
        f.write("END")
    
else:
    for x in range(count):
        f = open(os.path.abspath(path_to_folder) + "/" + str(x + 1) + ".pdb", "w")
        for line in file:
            if line[0:6] == 'ENDMDL':
                break
            elif line == "\n":
                continue
            else:
                f.write(line)
        f.write("END")
        f.close()

print(count)
sys.stdout.flush()
