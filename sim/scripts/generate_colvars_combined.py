#!/usr/bin/env python3
"""Generate one combined colvars file for global, base_pairs and backbone restraints.

This script combines logic from:
- generate_colvars_from_pairs.py (base_pairs)
- generate_colvars_from_closest_ntc.py (backbone)
- a global RMSD block (like colvars_heavy.conf)

Outputs:
- one combined colvars config
- one helper PDB for base_pairs
- two helper PDBs for backbone (odd/even)
"""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


ALLOWED_PAIRS = {
    ("A", "U"): "AU_psf.pdb",
    ("U", "A"): "UA_psf.pdb",
    ("C", "G"): "CG_psf.pdb",
    ("G", "C"): "GC_psf.pdb",
    ("G", "U"): "GU_psf.pdb",
    ("U", "G"): "UG_psf.pdb",
}


BACKBONE_ATOMS = {
    "P",
    "OP1",
    "OP2",
    "OP3",
    "O1P",
    "O2P",
    "O3P",
    "O5'",
    "C5'",
    "C4'",
    "O4'",
    "C3'",
    "O3'",
    "C2'",
    "O2'",
    "C1'",
}


@dataclass
class NtCRecord:
    chain_id: str
    start_residue: int
    end_residue: int
    ntc_code: str
    template_file: Path
    col_value: float
    parity: str  # "odd" or "even"


ResidueKey = Tuple[str, int]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate one colvars file with global, base_pairs and backbone restraints"
    )

    parser.add_argument("--pdb", default="output.pdb", help="Input PDB used in atomsFile")

    parser.add_argument("--out-colvars", default="colvars_combined.conf", help="Output colvars config")
    parser.add_argument(
        "--out-pdb-pairs",
        default="output_colvars_pairs.pdb",
        help="Output atomsFile PDB for base_pairs",
    )
    parser.add_argument(
        "--out-pdb-odd",
        default="output_colvars_odd.pdb",
        help="Output atomsFile PDB for odd backbone records",
    )
    parser.add_argument(
        "--out-pdb-even",
        default="output_colvars_even.pdb",
        help="Output atomsFile PDB for even backbone records",
    )

    parser.add_argument(
        "--global-ref",
        default="target.pdb",
        help="Reference PDB for global RMSD",
    )
    parser.add_argument(
        "--global-atoms-file",
        default="",
        help="atomsFile for global RMSD block (default: value of --pdb)",
    )

    parser.add_argument(
        "--pairs",
        default="R1260TS267_4_pairs.resid",
        help="Residue pair list for base_pairs",
    )
    parser.add_argument(
        "--pairs-start-value",
        type=float,
        default=2.0,
        help="First atomsColValue for base_pairs",
    )
    parser.add_argument(
        "--base-pair-templates-dir",
        default=".",
        help="Directory containing base-pair template PDB files",
    )

    parser.add_argument(
        "--csv",
        default="R1260TS267_4.pdb_assigned_ntcs.csv",
        help="CSV with Step and Closest NtC columns for backbone",
    )
    parser.add_argument(
        "--csv-column",
        default="Closest NtC",
        help="CSV column with NtC template code",
    )
    parser.add_argument(
        "--templates-dir",
        default="generated",
        help="Directory containing NtC templates",
    )
    parser.add_argument(
        "--backbone-start-value",
        type=float,
        default=2.0,
        help="First atomsColValue for backbone",
    )

    parser.add_argument(
        "--global-force-constant",
        type=float,
        default=20000.0,
        help="forceConstant for global block",
    )
    parser.add_argument(
        "--pairs-force-constant",
        type=float,
        default=2000.0,
        help="forceConstant for base_pairs blocks",
    )
    parser.add_argument(
        "--backbone-force-constant",
        type=float,
        default=2000.0,
        help="forceConstant for backbone blocks",
    )

    parser.add_argument(
        "--disable-global",
        action="store_true",
        help="Do not include global block",
    )
    parser.add_argument(
        "--disable-pairs",
        action="store_true",
        help="Do not include base_pairs blocks",
    )
    parser.add_argument(
        "--disable-backbone",
        action="store_true",
        help="Do not include backbone blocks",
    )

    return parser.parse_args()


def parse_pdb_lines(path: Path) -> List[str]:
    return path.read_text().splitlines()


def get_line_chain_id(line: str) -> str:
    chain = (line[21] if len(line) > 21 else " ").strip()
    return chain or "_"


def get_line_residue_id(line: str) -> int:
    return int(line[22:26])


def parse_pdb_residues(path: Path) -> Tuple[Dict[ResidueKey, str], Dict[int, ResidueKey], Dict[int, List[ResidueKey]]]:
    residues: Dict[ResidueKey, str] = {}
    residue_order: List[ResidueKey] = []

    for line in path.read_text().splitlines():
        if not (line.startswith("ATOM") or line.startswith("HETATM")):
            continue
        if len(line) < 66:
            continue

        res_name = line[17:20].strip()
        res_id = get_line_residue_id(line)
        chain_id = get_line_chain_id(line)
        key = (chain_id, res_id)

        if key not in residues:
            residues[key] = res_name
            residue_order.append(key)

    global_index_map: Dict[int, ResidueKey] = {
        index + 1: key for index, key in enumerate(residue_order)
    }

    resid_to_keys: Dict[int, List[ResidueKey]] = {}
    for key in residue_order:
        resid_to_keys.setdefault(key[1], []).append(key)

    return residues, global_index_map, resid_to_keys


def build_first_residue_by_chain(residue_order: List[ResidueKey]) -> Dict[str, ResidueKey]:
    first_residue_by_chain: Dict[str, ResidueKey] = {}

    for key in residue_order:
        if key[0] not in first_residue_by_chain:
            first_residue_by_chain[key[0]] = key

    return first_residue_by_chain


def is_hydrogen(atom_name: str) -> bool:
    return atom_name.upper().startswith("H")


def is_backbone_atom(atom_name: str) -> bool:
    return atom_name in BACKBONE_ATOMS


def rewrite_pdb_b_factors(lines: List[str], value_by_residue: Dict[ResidueKey, float]) -> List[str]:
    out_lines: List[str] = []
    for line in lines:
        if line.startswith("ATOM") or line.startswith("HETATM"):
            if len(line) < 66:
                out_lines.append(line)
                continue
            res_id = get_line_residue_id(line)
            chain_id = get_line_chain_id(line)
            residue_key = (chain_id, res_id)
            atom_name = line[12:16].strip()
            b_value = 0.0
            if residue_key in value_by_residue and not is_hydrogen(atom_name):
                b_value = value_by_residue[residue_key]
            out_lines.append(f"{line[:60]}{b_value:6.2f}{line[66:]}")
        else:
            out_lines.append(line)
    return out_lines


def rewrite_pdb_b_factors_backbone(
    lines: List[str],
    value_by_residue: Dict[ResidueKey, float],
    exclude_phosphate_for_first_residues: set[ResidueKey],
) -> List[str]:
    out_lines: List[str] = []
    for line in lines:
        if line.startswith("ATOM") or line.startswith("HETATM"):
            if len(line) < 66:
                out_lines.append(line)
                continue

            res_id = get_line_residue_id(line)
            chain_id = get_line_chain_id(line)
            residue_key = (chain_id, res_id)
            atom_name = line[12:16].strip()
            b_value = 0.0

            if residue_key in exclude_phosphate_for_first_residues and atom_name in {"P", "OP1", "OP2"}:
                out_lines.append(f"{line[:60]}{b_value:6.2f}{line[66:]}")
                continue

            if not is_backbone_atom(atom_name):
                out_lines.append(f"{line[:60]}{b_value:6.2f}{line[66:]}")
                continue

            if residue_key in value_by_residue and not is_hydrogen(atom_name):
                b_value = value_by_residue[residue_key]

            out_lines.append(f"{line[:60]}{b_value:6.2f}{line[66:]}")
        else:
            out_lines.append(line)
    return out_lines


def read_pairs(path: Path) -> List[Tuple[int, int]]:
    pairs: List[Tuple[int, int]] = []
    for i, raw in enumerate(path.read_text().splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 2:
            raise ValueError(f"Invalid pair line {i}: {raw!r}")
        pairs.append((int(parts[0]), int(parts[1])))
    return pairs


def build_pairs_section(
    pairs_path: Path,
    residues: Dict[ResidueKey, str],
    global_index_map: Dict[int, ResidueKey],
    resid_to_keys: Dict[int, List[ResidueKey]],
    first_residue_by_chain: Dict[str, ResidueKey],
    start_value: float,
    force_constant: float,
    atoms_file_name: str,
    templates_dir: Path,
) -> Tuple[str, Dict[ResidueKey, float], int, List[str]]:
    pairs = read_pairs(pairs_path)
    value_by_residue: Dict[ResidueKey, float] = {}
    skipped: List[str] = []
    blocks: List[str] = []
    next_value = start_value

    def resolve_pair_index(index: int) -> Tuple[ResidueKey | None, str | None]:
        if index in global_index_map:
            return global_index_map[index], None

        candidates = resid_to_keys.get(index, [])
        if len(candidates) == 1:
            return candidates[0], None
        if len(candidates) == 0:
            return None, f"index {index}: missing residue in PDB"
        return None, f"index {index}: ambiguous residue number across chains"

    def select_template_file(left_key: ResidueKey, right_key: ResidueKey, template_stem: str) -> Path:
        left_is_first = first_residue_by_chain.get(left_key[0]) == left_key
        right_is_first = first_residue_by_chain.get(right_key[0]) == right_key

        suffix = ""
        if left_is_first and right_is_first:
            suffix = "_drop_r1_r2"
        elif left_is_first:
            suffix = "_drop_r1"
        elif right_is_first:
            suffix = "_drop_r2"

        return templates_dir / f"{template_stem}{suffix}.pdb"

    for left, right in pairs:
        left_key, left_error = resolve_pair_index(left)
        right_key, right_error = resolve_pair_index(right)

        if left_error or right_error:
            reason = "; ".join([x for x in [left_error, right_error] if x])
            skipped.append(f"{left}-{right}: {reason}")
            continue

        assert left_key is not None
        assert right_key is not None

        left_base = residues.get(left_key)
        right_base = residues.get(right_key)

        if not left_base or not right_base:
            skipped.append(f"{left}-{right}: missing residue in PDB")
            continue

        ref_file_name = ALLOWED_PAIRS.get((left_base, right_base))
        if ref_file_name is None:
            skipped.append(f"{left}-{right}: skipped pair {left_base}-{right_base}")
            continue

        ref_file = select_template_file(left_key, right_key, ref_file_name.removesuffix(".pdb"))
        if not ref_file.exists():
            skipped.append(f"{left}-{right}: missing template {ref_file.name}")
            continue

        if left_key in value_by_residue or right_key in value_by_residue:
            skipped.append(f"{left}-{right}: skipped due to residue reuse")
            continue

        value_by_residue[left_key] = next_value
        value_by_residue[right_key] = next_value

        colvar_name = f"rmsd_pair_{left}_{right}"
        harmonic_name = f"harm_pair_{left}_{right}"
        blocks.append(
            "\n".join(
                [
                    "colvar {",
                    f"  name {colvar_name}",
                    "  rmsd {",
                    "    atoms {",
                    f"      atomsFile {atoms_file_name}",
                    "      atomsCol B",
                    f"      atomsColValue {next_value:.1f}",
                    "    }",
                    f"    refPositionsFile {ref_file}",
                    "  }",
                    "}",
                    "",
                    "harmonic {",
                    f"  name {harmonic_name}",
                    f"  colvars {colvar_name}",
                    f"  forceConstant {force_constant:.1f}",
                    "  centers 0.0",
                    "}",
                ]
            )
        )
        next_value += 1.0

    section = "\n\n".join(blocks)
    return section, value_by_residue, len(pairs), skipped


def parse_step_residues(step_value: str) -> Tuple[int, int]:
    numbers = [int(x) for x in re.findall(r"\d+", step_value)]
    if len(numbers) < 2:
        raise ValueError(f"Could not parse residues from Step value: {step_value!r}")
    return numbers[-2], numbers[-1]


def parse_chain_id(chain_value: str, step_value: str) -> str:
    # First, try to extract from Step field (most reliable, format: custom_<chainID>_...)
    step_match = re.search(r"custom_([^_]+)_", step_value)
    if step_match:
        parsed = step_match.group(1).strip()
        if parsed:
            return parsed[0]

    # Fall back to Chain column if Step extraction fails
    chain = chain_value.strip()
    if chain:
        return chain[0]

    return "_"


def chain_token_for_name(chain_id: str) -> str:
    token = re.sub(r"[^A-Za-z0-9]", "_", chain_id.strip())
    return token or "X"


def read_ntc_records(
    csv_path: Path,
    templates_dir: Path,
    start_value: float,
    csv_column: str,
) -> Tuple[List[NtCRecord], List[str]]:
    kept: List[NtCRecord] = []
    skipped: List[str] = []
    used_pairs: set[Tuple[str, int, int]] = set()

    next_value = start_value

    with csv_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"CSV has no header: {csv_path}")
        if csv_column not in reader.fieldnames:
            raise ValueError(f"CSV column not found: {csv_column}")

        for i, row in enumerate(reader, start=2):
            step = (row.get("Step") or "").strip()
            chain_id = parse_chain_id((row.get("Chain") or ""), step)
            template_code = (row.get(csv_column) or "").strip()

            if not step:
                skipped.append(f"line {i}: missing Step")
                continue

            try:
                start_res, end_res = parse_step_residues(step)
            except ValueError as exc:
                skipped.append(f"line {i}: {exc}")
                continue

            if end_res != start_res + 1:
                skipped.append(
                    f"line {i}: non-consecutive residues parsed from Step ({start_res}, {end_res})"
                )
                continue

            if not template_code or template_code in {"NANT", "NAN"}:
                skipped.append(f"line {i}: residue {start_res} skipped due to {csv_column}={template_code!r}")
                continue

            template_file = templates_dir / f"{template_code}.pdb"
            if not template_file.exists():
                skipped.append(
                    f"line {i}: residue {start_res} skipped, missing template {template_file.name}"
                )
                continue

            pair_key = (chain_id, start_res, end_res)
            if pair_key in used_pairs:
                skipped.append(f"line {i}: duplicate pair {chain_id}:{start_res}-{end_res}")
                continue

            used_pairs.add(pair_key)
            parity = "odd" if (start_res % 2 == 1) else "even"
            kept.append(
                NtCRecord(
                    chain_id=chain_id,
                    start_residue=start_res,
                    end_residue=end_res,
                    ntc_code=template_code,
                    template_file=template_file,
                    col_value=next_value,
                    parity=parity,
                )
            )
            next_value += 1.0

    return kept, skipped


def build_backbone_section(
    records: List[NtCRecord],
    odd_atoms_file_name: str,
    even_atoms_file_name: str,
    force_constant: float,
) -> str:
    blocks: List[str] = []
    for rec in records:
        chain_token = chain_token_for_name(rec.chain_id)
        colvar_name = f"rmsd_ntc_{chain_token}_{rec.start_residue}_{rec.end_residue}_{rec.ntc_code}"
        harmonic_name = f"harm_ntc_{chain_token}_{rec.start_residue}_{rec.end_residue}_{rec.ntc_code}"
        atoms_file_name = odd_atoms_file_name if rec.parity == "odd" else even_atoms_file_name

        blocks.append(
            "\n".join(
                [
                    "colvar {",
                    f"  name {colvar_name}",
                    "  rmsd {",
                    "    atoms {",
                    f"      atomsFile {atoms_file_name}",
                    "      atomsCol B",
                    f"      atomsColValue {rec.col_value:.1f}",
                    "    }",
                    f"    refPositionsFile {rec.template_file.as_posix()}",
                    "  }",
                    "}",
                    "",
                    "harmonic {",
                    f"  name {harmonic_name}",
                    f"  colvars {colvar_name}",
                    f"  forceConstant {force_constant:.1f}",
                    "  centers 0.0",
                    "}",
                ]
            )
        )
    return "\n\n".join(blocks)


def build_global_section(
    atoms_file_name: str,
    ref_positions_file: str,
    force_constant: float,
) -> str:
    return "\n".join(
        [
            "colvar {",
            "  name rmsd_global",
            "  rmsd {",
            "    atoms {",
            f"      atomsFile {atoms_file_name}",
            "      atomsCol B",
            "      atomsColValue 1.0",
            "    }",
            f"    refPositionsFile {ref_positions_file}",
            "  }",
            "}",
            "",
            "harmonic {",
            "  name harm_global",
            "  colvars rmsd_global",
            f"  forceConstant {force_constant:.1f}",
            "  centers 0.0",
            "}",
        ]
    )


def main() -> None:
    args = parse_args()

    pdb_path = Path(args.pdb)
    out_colvars_path = Path(args.out_colvars)
    out_pdb_pairs_path = Path(args.out_pdb_pairs)
    out_pdb_odd_path = Path(args.out_pdb_odd)
    out_pdb_even_path = Path(args.out_pdb_even)

    pdb_lines = parse_pdb_lines(pdb_path)
    residues, global_index_map, resid_to_keys = parse_pdb_residues(pdb_path)
    residue_order = list(global_index_map.values())
    first_residue_by_chain = build_first_residue_by_chain(residue_order)

    sections: List[str] = ["# Auto-generated by generate_colvars_combined.py"]
    skipped_pairs: List[str] = []
    skipped_backbone: List[str] = []

    if not args.disable_global:
        global_atoms_file = args.global_atoms_file.strip() or pdb_path.name
        sections.append("# ---- global ----")
        sections.append(
            build_global_section(
                atoms_file_name=global_atoms_file,
                ref_positions_file=args.global_ref,
                force_constant=args.global_force_constant,
            )
        )

    total_pairs = 0
    kept_pairs = 0
    if not args.disable_pairs:
        pairs_section, value_by_residue_pairs, total_pairs, skipped_pairs = build_pairs_section(
            pairs_path=Path(args.pairs),
            residues=residues,
            global_index_map=global_index_map,
            resid_to_keys=resid_to_keys,
            first_residue_by_chain=first_residue_by_chain,
            start_value=args.pairs_start_value,
            force_constant=args.pairs_force_constant,
            atoms_file_name=out_pdb_pairs_path.name,
            templates_dir=Path(args.base_pair_templates_dir),
        )
        kept_pairs = len({v for v in value_by_residue_pairs.values()})

        new_pairs_lines = rewrite_pdb_b_factors(pdb_lines, value_by_residue_pairs)
        out_pdb_pairs_path.write_text("\n".join(new_pairs_lines) + "\n")

        sections.append("# ---- base_pairs ----")
        if pairs_section:
            sections.append(pairs_section)
        else:
            sections.append("# No base_pairs blocks generated")

    kept_backbone = 0
    odd_count = 0
    even_count = 0
    if not args.disable_backbone:
        records, skipped_backbone = read_ntc_records(
            csv_path=Path(args.csv),
            templates_dir=Path(args.templates_dir),
            start_value=args.backbone_start_value,
            csv_column=args.csv_column,
        )

        value_by_residue_odd: Dict[ResidueKey, float] = {}
        value_by_residue_even: Dict[ResidueKey, float] = {}
        first_residues_odd: set[ResidueKey] = set()
        first_residues_even: set[ResidueKey] = set()

        for rec in records:
            start_key = (rec.chain_id, rec.start_residue)
            end_key = (rec.chain_id, rec.end_residue)
            target = value_by_residue_odd if rec.parity == "odd" else value_by_residue_even
            target[start_key] = rec.col_value
            target[end_key] = rec.col_value
            if rec.parity == "odd":
                first_residues_odd.add(start_key)
            else:
                first_residues_even.add(start_key)

        odd_lines = rewrite_pdb_b_factors_backbone(
            pdb_lines,
            value_by_residue_odd,
            first_residues_odd,
        )
        even_lines = rewrite_pdb_b_factors_backbone(
            pdb_lines,
            value_by_residue_even,
            first_residues_even,
        )
        out_pdb_odd_path.write_text("\n".join(odd_lines) + "\n")
        out_pdb_even_path.write_text("\n".join(even_lines) + "\n")

        sections.append("# ---- backbone ----")
        backbone_section = build_backbone_section(
            records=records,
            odd_atoms_file_name=out_pdb_odd_path.name,
            even_atoms_file_name=out_pdb_even_path.name,
            force_constant=args.backbone_force_constant,
        )
        if backbone_section:
            sections.append(backbone_section)
        else:
            sections.append("# No backbone blocks generated")

        kept_backbone = len(records)
        odd_count = sum(1 for rec in records if rec.parity == "odd")
        even_count = sum(1 for rec in records if rec.parity == "even")

    out_colvars_path.write_text("\n\n".join(sections).rstrip() + "\n")

    print(f"Wrote colvars: {out_colvars_path}")
    print(f"Global enabled: {not args.disable_global}")

    if not args.disable_pairs:
        print(f"Base pairs kept: {kept_pairs}/{total_pairs}")
        print(f"Wrote pairs atoms PDB: {out_pdb_pairs_path}")
        print(f"Base pairs skipped: {len(skipped_pairs)}")

    if not args.disable_backbone:
        print(f"Backbone kept: {kept_backbone} (odd: {odd_count}, even: {even_count})")
        print(f"Wrote odd atoms PDB: {out_pdb_odd_path}")
        print(f"Wrote even atoms PDB: {out_pdb_even_path}")
        print(f"Backbone skipped: {len(skipped_backbone)}")

    if skipped_pairs:
        print("\nBase pairs skipped details:")
        for item in skipped_pairs:
            print(f"- {item}")

    if skipped_backbone:
        print("\nBackbone skipped details:")
        for item in skipped_backbone:
            print(f"- {item}")


if __name__ == "__main__":
    main()