#!/usr/bin/env python3
"""Run a single NAMD simulation with a chosen set of restraint force constants.

The workflow matches the grid-search helper, but executes only one combination:
1. Generate `colvars_combined.conf` and helper PDB files.
2. Create a run-specific copy of `namd.script` with the desired `outputname`.
3. Optionally add a static obstacle field derived from a complex PDB.
4. Optionally zero the charge column in the PSF `!NATOM` section.
5. Start NAMD and write its log to a single file.
"""

from __future__ import annotations

import argparse
import math
import re
import shlex
import json
import shutil
import subprocess
from pathlib import Path
from dataclasses import dataclass


def to_token(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value).replace(".", "p")


def format_outputname(prefix: str, global_force: float, pairs_force: float, backbone_force: float) -> str:
    return (
        f"{prefix}_g{to_token(global_force)}"
        f"_p{to_token(pairs_force)}_b{to_token(backbone_force)}"
    )


def replace_outputname(text: str, new_outputname: str) -> str:
    lines = text.splitlines()
    replaced = False

    for index, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith("set outputname"):
            indent = line[: len(line) - len(stripped)]
            lines[index] = f"{indent}set outputname      {new_outputname}"
            replaced = True
            break

    if not replaced:
        raise ValueError("Could not find 'set outputname ...' in namd script")

    return "\n".join(lines) + ("\n" if text.endswith("\n") else "")


def add_namd_tcl_forces(text: str, tcl_script_name: str) -> str:
    lines = text.splitlines()

    filtered: list[str] = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("tclForces") or stripped.startswith("tclForcesScript"):
            continue
        filtered.append(line)

    insert_at = None
    for idx, line in enumerate(filtered):
        if line.strip().startswith("## COLVARS"):
            insert_at = idx
            break

    if insert_at is None:
        for idx, line in enumerate(filtered):
            if line.strip().startswith("## Output"):
                insert_at = idx
                break

    if insert_at is None:
        insert_at = len(filtered)

    filtered[insert_at:insert_at] = [
        "tclBC               on",
        f"tclBCScript         {{ source {tcl_script_name} }}",
    ]

    return "\n".join(filtered) + ("\n" if text.endswith("\n") else "")


def zero_psf_natom_charges(psf_path: Path) -> None:
    text = psf_path.read_text()
    lines = text.splitlines()

    natom_section_index = None
    natom_count = None

    for index, line in enumerate(lines):
        if "!NATOM" in line:
            natom_section_index = index
            natom_count = int(line.split()[0])
            break

    if natom_section_index is None or natom_count is None:
        raise ValueError(f"Could not find !NATOM section in {psf_path}")

    # PSF readers expect the NATOM records to keep their fixed-width layout.
    # Rebuilding the line with split/join collapses spacing and breaks VMD.
    for offset in range(1, natom_count + 1):
        line_index = natom_section_index + offset
        if line_index >= len(lines):
            raise ValueError(f"Unexpected end of file while reading !NATOM section in {psf_path}")

        line = lines[line_index]
        tokens = list(re.finditer(r"\S+", line))
        if len(tokens) < 9:
            raise ValueError(f"Malformed !NATOM line in {psf_path}: {line!r}")

        charge_token = tokens[6]
        charge_width = charge_token.end() - charge_token.start()
        if charge_width < len("0.000000"):
            raise ValueError(f"Charge field too narrow in {psf_path}: {line!r}")

        charge_value = f"{0.0:>{charge_width}.6f}"
        lines[line_index] = f"{line[:charge_token.start()]}{charge_value}{line[charge_token.end():]}"

    psf_path.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""), encoding="utf8")


def write_pdb_with_residue_occupancy(pdb_path: Path, residues_json: Path, out_pdb_path: Path) -> None:
    text = pdb_path.read_text(encoding="utf8")
    data = json.loads(residues_json.read_text(encoding="utf8"))

    # Build set of (chain, resid) tuples
    residues = set()
    for item in data:
        chain = item.get("chainID")
        resid = item.get("residueID")
        try:
            resid = int(resid)
        except Exception:
            continue
        residues.add((str(chain), resid))

    lines = text.splitlines()
    out_lines: list[str] = []

    for line in lines:
        if line.startswith(("ATOM  ", "HETATM")):
            # Standard PDB columns: chain at 22 (index 21), resseq 23-26 (22:26), occupancy 55-60 (54:60)
            chain = line[21:22]
            resseq_s = line[22:26].strip()
            try:
                resseq = int(resseq_s)
            except Exception:
                out_lines.append(line)
                continue

            occ = 0.0 if (chain, resseq) in residues else 1.0

            # Ensure line is long enough to replace occupancy field
            if len(line) < 60:
                line = line.ljust(60)

            new_line = line[:54] + f"{occ:6.2f}" + line[60:]
            out_lines.append(new_line)
        else:
            out_lines.append(line)

    out_pdb_path.write_text("\n".join(out_lines) + ("\n" if text.endswith("\n") else ""), encoding="utf8")


RNA_RESNAMES = {"A", "C", "G", "U", "I"}


@dataclass(frozen=True)
class PdbAtom:
    serial: int
    atom_name: str
    element: str
    resname: str
    chain_id: str
    resseq: int
    icode: str
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class ObstacleSphere:
    label: str
    x: float
    y: float
    z: float
    radius: float
    atom_count: int


def is_atom_record(line: str) -> bool:
    return line.startswith(("ATOM", "HETATM"))


def parse_pdb_atom(line: str) -> PdbAtom | None:
    if not is_atom_record(line) or len(line) < 54:
        return None

    try:
        serial = int(line[6:11])
        atom_name = line[12:16].strip()
        element = (line[76:78].strip() if len(line) >= 78 else "")
        if not element:
            # Infer element from atom name when the dedicated PDB element field is empty.
            letters_only = "".join(ch for ch in atom_name if ch.isalpha())
            if letters_only:
                if len(letters_only) >= 2 and letters_only[:2].upper() in {
                    "CL", "BR", "NA", "MG", "ZN", "FE", "CA", "MN", "CU", "CO", "NI", "CD", "HG",
                }:
                    element = letters_only[:2]
                else:
                    element = letters_only[0]
        element = element.upper()
        resname = line[17:20].strip()
        chain_id = line[21:22].strip() or "_"
        resseq = int(line[22:26])
        icode = line[26:27].strip()
        x = float(line[30:38])
        y = float(line[38:46])
        z = float(line[46:54])
    except Exception:
        return None

    return PdbAtom(
        serial=serial,
        atom_name=atom_name,
        element=element,
        resname=resname,
        chain_id=chain_id,
        resseq=resseq,
        icode=icode,
        x=x,
        y=y,
        z=z,
    )


def is_rna_residue(resname: str) -> bool:
    return resname.upper() in RNA_RESNAMES


def residue_key(atom: PdbAtom) -> tuple[str, int, str, str]:
    return (atom.chain_id, atom.resseq, atom.icode, atom.resname)

# https://pse-info.de/en/scale/radius_vdw
def build_obstacle_spheres(pdb_path: Path, radius_margin: float, minimum_radius: float) -> list[ObstacleSphere]:
    element_radii: dict[str, float] = {
        "H": 1.20,
        "C": 1.70,
        "N": 1.55,
        "O": 1.52,
        "P": 1.80,
        "S": 1.80,
        "F": 1.35,
        "CL": 1.75,
        "BR": 1.85,
        "I": 1.98,
        "MG": 1.73,
        "NA": 2.27,
        "K": 2.75,
        "CA": 2.31,
        "ZN": 1.39,
        "FE": 1.94,
    }

    spheres: list[ObstacleSphere] = []
    for line in pdb_path.read_text(encoding="utf8").splitlines():
        atom = parse_pdb_atom(line)
        if atom is None:
            continue
        if is_rna_residue(atom.resname):
            continue

        base_radius = element_radii.get(atom.element, 1.70)
        radius = max(base_radius + radius_margin, minimum_radius)
        label = f"{atom.chain_id}:{atom.resname}{atom.resseq}{atom.icode or ''}:{atom.atom_name}:{atom.serial}"
        spheres.append(
            ObstacleSphere(
                label=label,
                x=atom.x,
                y=atom.y,
                z=atom.z,
                radius=radius,
                atom_count=1,
            )
        )

    spheres.sort(key=lambda item: item.label)
    return spheres


def write_obstacle_force_script(
    script_path: Path,
    spheres: list[ObstacleSphere],
    force_constant: float,
) -> None:
    sphere_lines = []
    for sphere in spheres:
        sphere_lines.append(
            "    {"
            f"{sphere.x:.6f} {sphere.y:.6f} {sphere.z:.6f} {sphere.radius:.6f}"
            "}"
        )

    script = "\n".join(
        [
            "# Auto-generated static obstacle repulsion for NAMD tclBC",
            f"set obstacleForceConstant {force_constant:.6f}",
            "set obstacleSpheres {",
            *sphere_lines,
            "}",
            "",
            "proc calcforces {step unique} {",
            "    global obstacleForceConstant obstacleSpheres",
            "    while {[nextatom]} {",
            "        set pos [getcoord]",
            "        set x [lindex $pos 0]",
            "        set y [lindex $pos 1]",
            "        set z [lindex $pos 2]",
            "        set fx 0.0",
            "        set fy 0.0",
            "        set fz 0.0",
            "        foreach sphere $obstacleSpheres {",
            "            lassign $sphere centerX centerY centerZ radius",
            "            set dx [expr {$x - $centerX}]",
            "            set dy [expr {$y - $centerY}]",
            "            set dz [expr {$z - $centerZ}]",
            "            set dist2 [expr {$dx*$dx + $dy*$dy + $dz*$dz}]",
            "            if {$dist2 <= 1.0e-12} {",
            "                continue",
            "            }",
            "            set dist [expr {sqrt($dist2)}]",
            "            if {$dist < $radius} {",
            "                set penetration [expr {$radius - $dist}]",
            "                set scale [expr {$obstacleForceConstant * $penetration / $dist}]",
            "                set fx [expr {$fx + $scale * $dx}]",
            "                set fy [expr {$fy + $scale * $dy}]",
            "                set fz [expr {$fz + $scale * $dz}]",
            "            }",
            "        }",
            "        if {$fx != 0.0 || $fy != 0.0 || $fz != 0.0} {",
            "            addforce [list $fx $fy $fz]",
            "        }",
            "    }",
            "}",
            "",
        ]
    )

    script_path.write_text(script + "\n", encoding="utf8")


def write_obstacle_summary(summary_path: Path, spheres: list[ObstacleSphere]) -> None:
    payload = [
        {
            "label": sphere.label,
            "x": sphere.x,
            "y": sphere.y,
            "z": sphere.z,
            "radius": sphere.radius,
            "atomCount": sphere.atom_count,
        }
        for sphere in spheres
    ]
    summary_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")


def set_fixed_atoms(text: str, enable: bool, fixed_file: str) -> str:
    # Remove any existing fixedAtoms / fixedAtomsFile lines to avoid duplicates,
    # then insert a single pair in the FIXED ATOMS section.
    lines = text.splitlines()

    # Filter out existing declarations
    filtered: list[str] = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("fixedAtoms") or stripped.startswith("fixedAtomsFile"):
            continue
        filtered.append(line)

    # Find insertion point: after the FIXED ATOMS header block if present,
    # otherwise before SIMULATION PARAMETERS, otherwise at end.
    insert_at = None
    for idx, line in enumerate(filtered):
        if line.strip().startswith("## FIXED ATOMS"):
            # Usually header is three lines (hash, title, hash). Insert after that block.
            insert_at = idx + 2
            if insert_at > len(filtered):
                insert_at = len(filtered)
            break

    if insert_at is None:
        for idx, line in enumerate(filtered):
            if line.strip().startswith("## SIMULATION PARAMETERS"):
                insert_at = idx
                break

    if insert_at is None:
        insert_at = len(filtered)

    ins: list[str] = [f"fixedAtoms          {'on' if enable else 'off'}", f"fixedAtomsFile      {fixed_file}"]
    filtered[insert_at:insert_at] = ins

    return "\n".join(filtered) + ("\n" if text.endswith("\n") else "")


def run_command(cmd: list[str], cwd: Path, log_path: Path | None = None) -> None:
    if log_path is None:
        subprocess.run(cmd, cwd=cwd, check=True)
        return

    with log_path.open("a") as log_handle:
        subprocess.run(
            cmd,
            cwd=cwd,
            check=True,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one NAMD simulation with selected restraint force constants")
    parser.add_argument("--workdir", default=".", help="Working directory for commands")
    parser.add_argument("--namd-script", default="namd.script", help="Path to the NAMD template script")
    parser.add_argument(
        "--generator-script",
        default="generate_colvars_combined.py",
        help="Path to generate_colvars_combined.py",
    )

    parser.add_argument("--pdb", default="output.pdb", help="Input PDB for colvars generator")
    parser.add_argument("--psf", default="output.psf", help="PSF file to normalize before NAMD")
    parser.add_argument("--pairs", default="R1260TS267_4_pairs.resid", help="Pairs file")
    parser.add_argument("--csv", default="R1260TS267_4.pdb_assigned_ntcs.csv", help="NtC CSV file")
    parser.add_argument(
        "--base-pair-templates-dir",
        default=".",
        help="Directory containing base-pair template PDB files",
    )
    parser.add_argument("--templates-dir", default="generated", help="NtC templates directory")
    parser.add_argument("--out-colvars", default="colvars_combined.conf", help="Combined colvars output file")
    parser.add_argument(
        "--out-pdb-pairs",
        default="output_colvars_pairs.pdb",
        help="Base-pairs helper PDB output",
    )
    parser.add_argument(
        "--out-pdb-odd",
        default="output_colvars_odd.pdb",
        help="Backbone odd helper PDB output",
    )
    parser.add_argument(
        "--out-pdb-even",
        default="output_colvars_even.pdb",
        help="Backbone even helper PDB output",
    )
    parser.add_argument("--global-ref", default="target.pdb", help="Global reference PDB")

    parser.add_argument(
        "--global-force-constant",
        type=float,
        default=20000.0,
        help="forceConstant for the global restraint block",
    )
    parser.add_argument(
        "--pairs-force-constant",
        type=float,
        default=2000.0,
        help="forceConstant for the base-pairs restraint blocks",
    )
    parser.add_argument(
        "--backbone-force-constant",
        type=float,
        default=2000.0,
        help="forceConstant for the backbone restraint blocks",
    )

    parser.add_argument(
        "--disable-global",
        action="store_true",
        help="Do not include the global block",
    )
    parser.add_argument(
        "--disable-pairs",
        action="store_true",
        help="Do not include the base-pairs blocks",
    )
    parser.add_argument(
        "--disable-backbone",
        action="store_true",
        help="Do not include the backbone blocks",
    )

    parser.add_argument("--python", default="python", help="Python executable")
    parser.add_argument("--namd-bin", default="namd2", help="NAMD executable")
    parser.add_argument(
        "--outputname-prefix",
        default="restrained",
        help="Prefix used for the NAMD outputName",
    )
    parser.add_argument(
        "--outputname",
        default=None,
        help="Explicit outputName override. If omitted, one is derived from the force constants.",
    )
    parser.add_argument(
        "--run-namd-script",
        default=None,
        help="Path for the generated run-specific NAMD script",
    )
    parser.add_argument(
        "--log-file",
        default=None,
        help="Log file for NAMD output. If omitted, defaults to single_{outputname}.log",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned commands without running them",
    )
    parser.add_argument(
        "--zero-psf-charges",
        action="store_true",
        help="Zero the charge column in the PSF !NATOM section before NAMD",
    )
    parser.add_argument(
        "--namd-processes",
        type=int,
        default=None,
        help="Number of CPU processes for NAMD (default: single process)",
    )
    parser.add_argument(
        "--residues-json",
        default=None,
        help="Path to JSON file with residues to set occupancy 0 (list of {chainID,residueID})",
    )
    parser.add_argument(
        "--out-pdb-residues",
        default=None,
        help="Output PDB path for occupancy-modified PDB (defaults to <outputname>_residues.pdb)",
    )
    parser.add_argument(
        "--complex-pdb",
        default=None,
        help="Optional full complex PDB used only to derive static obstacle spheres for non-RNA atoms",
    )
    parser.add_argument(
        "--obstacle-force-constant",
        type=float,
        default=25.0,
        help="Repulsive force constant for obstacle spheres in kcal/mol/A^2",
    )
    parser.add_argument(
        "--obstacle-radius-margin",
        type=float,
        default=1.5,
        help="Extra radius added on top of each non-RNA atom vdW radius when building obstacles",
    )
    parser.add_argument(
        "--obstacle-min-radius",
        type=float,
        default=1.8,
        help="Minimum obstacle sphere radius in Angstrom",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    workdir = Path(args.workdir).resolve()
    namd_script = (workdir / args.namd_script).resolve()
    generator_script = (workdir / args.generator_script).resolve()

    if not namd_script.exists():
        raise FileNotFoundError(f"Missing namd script: {namd_script}")
    if not generator_script.exists():
        raise FileNotFoundError(f"Missing generator script: {generator_script}")

    outputname = args.outputname or format_outputname(
        args.outputname_prefix,
        args.global_force_constant,
        args.pairs_force_constant,
        args.backbone_force_constant,
    )
    run_namd_script = (
        (workdir / args.run_namd_script).resolve()
        if args.run_namd_script
        else workdir / f"namd_{outputname}.script"
    )
    log_path = (
        (workdir / args.log_file).resolve()
        if args.log_file
        else workdir / f"single_{outputname}.log"
    )
    generator_log_path = workdir / f"generate_{outputname}.log"
    obstacle_script_path = workdir / f"obstacle_forces_{outputname}.tcl"
    obstacle_summary_path = workdir / f"obstacle_spheres_{outputname}.json"

    namd_bin_path = args.namd_bin
    if not Path(namd_bin_path).is_absolute():
        found = shutil.which(namd_bin_path)
        if found:
            namd_bin_path = found
        else:
            for candidate in [
                workdir / args.namd_bin,
                workdir.parent / "NAMD" / "NAMD_2.9_Linux-x86_64" / args.namd_bin,
                Path.home() / "NAMD" / "NAMD_2.9_Linux-x86_64" / args.namd_bin,
            ]:
                if candidate.exists():
                    namd_bin_path = str(candidate.resolve())
                    break

    num_processes = args.namd_processes or 1

    print(f"Working directory: {workdir}")
    print(f"Output name: {outputname}")
    print(f"Run script: {run_namd_script.name}")
    print(f"Log file: {log_path.name}")
    print(f"Generator log: {generator_log_path.name}")
    print(f"Base-pair templates dir: {args.base_pair_templates_dir}")
    print(f"NAMD processes: {num_processes}")
    if args.complex_pdb:
        print(f"Complex PDB: {Path(args.complex_pdb).name}")

    generator_cmd = [
        args.python,
        str(generator_script),
        "--pdb",
        args.pdb,
        "--pairs",
        args.pairs,
        "--base-pair-templates-dir",
        args.base_pair_templates_dir,
        "--csv",
        args.csv,
        "--templates-dir",
        args.templates_dir,
        "--out-colvars",
        args.out_colvars,
        "--out-pdb-pairs",
        args.out_pdb_pairs,
        "--out-pdb-odd",
        args.out_pdb_odd,
        "--out-pdb-even",
        args.out_pdb_even,
        "--global-ref",
        args.global_ref,
        "--global-force-constant",
        str(args.global_force_constant),
        "--pairs-force-constant",
        str(args.pairs_force_constant),
        "--backbone-force-constant",
        str(args.backbone_force_constant),
    ]

    if args.disable_global:
        generator_cmd.append("--disable-global")
    if args.disable_pairs:
        generator_cmd.append("--disable-pairs")
    if args.disable_backbone:
        generator_cmd.append("--disable-backbone")

    if num_processes > 1:
        namd_cmd = ["charmrun", "++local", f"+p{num_processes}", namd_bin_path, run_namd_script.name]
    else:
        namd_cmd = [namd_bin_path, run_namd_script.name]

    if args.dry_run:
        print("DRY-RUN generate: " + " ".join(shlex.quote(x) for x in generator_cmd))
        print("DRY-RUN write: " + shlex.quote(str(run_namd_script)))
        if args.complex_pdb:
            print("DRY-RUN obstacle script: " + shlex.quote(str(obstacle_script_path)))
            print("DRY-RUN obstacle summary: " + shlex.quote(str(obstacle_summary_path)))
        if args.zero_psf_charges:
            print("DRY-RUN normalize PSF: " + shlex.quote(str((workdir / args.psf).resolve())))
        print("DRY-RUN run: " + " ".join(shlex.quote(x) for x in namd_cmd))
        print("DRY-RUN generator log: " + shlex.quote(str(generator_log_path)))
        print("DRY-RUN log: " + shlex.quote(str(log_path)))
        return

    if log_path.exists():
        log_path.unlink()
    if generator_log_path.exists():
        generator_log_path.unlink()

    namd_template_text = namd_script.read_text()
    run_command(generator_cmd, cwd=workdir, log_path=generator_log_path)

    obstacle_spheres: list[ObstacleSphere] = []
    if args.complex_pdb:
        complex_pdb_path = (workdir / args.complex_pdb).resolve()
        if not complex_pdb_path.exists():
            raise FileNotFoundError(f"Missing complex PDB: {complex_pdb_path}")

        obstacle_spheres = build_obstacle_spheres(
            complex_pdb_path,
            radius_margin=args.obstacle_radius_margin,
            minimum_radius=args.obstacle_min_radius,
        )
        print(f"Built obstacle spheres: {len(obstacle_spheres)} from {complex_pdb_path.name}")
        write_obstacle_force_script(
            obstacle_script_path,
            obstacle_spheres,
            force_constant=args.obstacle_force_constant,
        )
        write_obstacle_summary(obstacle_summary_path, obstacle_spheres)

    # If residues JSON is provided, write a PDB with occupancy flags
    if args.residues_json:
        residues_json_path = (workdir / args.residues_json).resolve()
        if not residues_json_path.exists():
            raise FileNotFoundError(f"Missing residues JSON: {residues_json_path}")

        out_pdb_residues = (
            (workdir / args.out_pdb_residues).resolve() if args.out_pdb_residues
            else workdir / f"{outputname}_residues.pdb"
        )

        print(f"Writing occupancy-modified PDB: {out_pdb_residues.name} from {residues_json_path.name}")
        write_pdb_with_residue_occupancy((workdir / args.pdb).resolve(), residues_json_path, out_pdb_residues)

        # Update run-specific NAMD script to enable fixedAtoms and point to generated PDB
        final_script_text = replace_outputname(namd_template_text, outputname)
        final_script_text = set_fixed_atoms(final_script_text, True, out_pdb_residues.name)
        if obstacle_spheres:
            final_script_text = add_namd_tcl_forces(final_script_text, obstacle_script_path.name)
        run_namd_script.write_text(final_script_text)
    else:
        # No residues JSON: just write script with updated outputname
        final_script_text = replace_outputname(namd_template_text, outputname)
        if obstacle_spheres:
            final_script_text = add_namd_tcl_forces(final_script_text, obstacle_script_path.name)
        run_namd_script.write_text(final_script_text)

    psf_path = (workdir / args.psf).resolve()
    if not psf_path.exists():
        raise FileNotFoundError(f"Missing PSF file: {psf_path}")

    if args.zero_psf_charges:
        print(f"Zeroing charges in PSF !NATOM section: {psf_path.name}")
        zero_psf_natom_charges(psf_path)

    run_command(namd_cmd, cwd=workdir, log_path=log_path)

    print("Finished single NAMD run")


if __name__ == "__main__":
    main()