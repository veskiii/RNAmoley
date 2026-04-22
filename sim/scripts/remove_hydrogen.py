#!/usr/bin/env python3

import sys
import shutil
import argparse
import os


def is_hydrogen_atom(line):
    """
    Poprawne i bezpieczne wykrywanie wodoru wg PDB:
    - tylko ATOM/HETATM
    - nazwa atomu (kol. 13–16) zaczyna się od H
    """
    atom_name = line[12:16].strip()
    return atom_name.startswith("H")


def process_pdb(lines):
    """
    Usuwa wodory i renumeruje atomy
    """
    new_lines = []
    atom_counter = 1

    for line in lines:
        if line.startswith(("ATOM", "HETATM")):
            if is_hydrogen_atom(line):
                continue  # pomiń wodory

            # renumeracja atomów (kolumny 7–11)
            newline = (
                line[:6]
                + f"{atom_counter:5d}"
                + line[11:]
            )
            atom_counter += 1
            new_lines.append(newline)
        else:
            # CRYST1, TER, END itd.
            new_lines.append(line)

    return new_lines


def main():
    parser = argparse.ArgumentParser(
        description="Usuwa atomy wodoru z pliku PDB i renumeruje atomy"
    )
    parser.add_argument("input", help="plik wejściowy PDB")
    parser.add_argument("output", nargs="?", help="plik wyjściowy PDB")
    parser.add_argument(
        "--inplace",
        action="store_true",
        help="modyfikuje plik wejściowy (tworzy backup .bak)"
    )

    args = parser.parse_args()

    if args.inplace:
        output = args.input
        backup = args.input + ".bak"
        shutil.copyfile(args.input, backup)
        print(f"Backup zapisany jako: {backup}")
    else:
        if not args.output:
            print("Błąd: podaj plik wyjściowy albo użyj --inplace")
            sys.exit(1)
        output = args.output

    with open(args.input) as f:
        lines = f.readlines()

    new_lines = process_pdb(lines)

    with open(output, "w") as f:
        f.writelines(new_lines)

    print("✔ Usunięto wodory")
    print("✔ Renumerowano atomy")
    print(f"✔ Zapisano: {output}")


if __name__ == "__main__":
    main()
