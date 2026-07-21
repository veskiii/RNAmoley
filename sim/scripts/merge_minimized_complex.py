#!/usr/bin/env python3
"""Merge minimized RNA coordinates back into an original complex PDB.

The script keeps all non-RNA atoms exactly as they appear in the original
complex PDB and replaces only matching RNA atom coordinates with the atoms
from the minimized RNA PDB.

This is a post-processing helper for refinement workflows where the simulation
is run on RNA only and non-RNA is kept static as an obstacle field.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


RNA_RESNAMES = {"A", "C", "G", "U", "I"}


@dataclass(frozen=True)
class PdbAtomKey:
    chain_id: str
    resseq: int
    icode: str
    atom_name: str
    resname: str


def is_atom_record(line: str) -> bool:
    return line.startswith(("ATOM", "HETATM"))


def parse_atom_key(line: str) -> PdbAtomKey | None:
    if not is_atom_record(line) or len(line) < 54:
        return None

    try:
        chain_id = line[21:22].strip() or "_"
        resseq = int(line[22:26])
        icode = line[26:27].strip()
        atom_name = line[12:16].strip()
        resname = line[17:20].strip()
    except Exception:
        return None

    return PdbAtomKey(
        chain_id=chain_id,
        resseq=resseq,
        icode=icode,
        atom_name=atom_name,
        resname=resname,
    )


def is_rna_residue(resname: str) -> bool:
    return resname.upper() in RNA_RESNAMES


def build_coordinate_map(minimized_rna_pdb: Path) -> dict[PdbAtomKey, tuple[float, float, float]]:
    coord_map: dict[PdbAtomKey, tuple[float, float, float]] = {}

    for line in minimized_rna_pdb.read_text(encoding="utf8").splitlines():
        key = parse_atom_key(line)
        if key is None:
            continue
        if not is_rna_residue(key.resname):
            continue

        try:
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
        except Exception:
            continue

        coord_map[key] = (x, y, z)

    return coord_map


def merge_complex_pdb(original_complex_pdb: Path, minimized_rna_pdb: Path, output_pdb: Path) -> None:
    coord_map = build_coordinate_map(minimized_rna_pdb)

    out_lines: list[str] = []
    for line in original_complex_pdb.read_text(encoding="utf8").splitlines():
        key = parse_atom_key(line)
        if key is not None and is_rna_residue(key.resname):
            coords = coord_map.get(key)
            if coords is not None:
                x, y, z = coords
                if len(line) < 54:
                    line = line.ljust(54)
                line = f"{line[:30]}{x:8.3f}{y:8.3f}{z:8.3f}{line[54:]}"
        out_lines.append(line)

    output_pdb.write_text("\n".join(out_lines) + "\n", encoding="utf8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge minimized RNA coordinates into a complex PDB")
    parser.add_argument("--complex-pdb", required=True, help="Original complex PDB")
    parser.add_argument("--rna-pdb", required=True, help="Minimized RNA-only PDB")
    parser.add_argument("--out-pdb", required=True, help="Merged output PDB")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    complex_pdb = Path(args.complex_pdb).resolve()
    rna_pdb = Path(args.rna_pdb).resolve()
    out_pdb = Path(args.out_pdb).resolve()

    if not complex_pdb.exists():
        raise FileNotFoundError(f"Missing complex PDB: {complex_pdb}")
    if not rna_pdb.exists():
        raise FileNotFoundError(f"Missing RNA PDB: {rna_pdb}")

    merge_complex_pdb(complex_pdb, rna_pdb, out_pdb)
    print(f"Wrote merged complex PDB: {out_pdb}")


if __name__ == "__main__":
    main()