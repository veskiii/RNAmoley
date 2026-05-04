#!/usr/bin/env python3
"""Run a single NAMD simulation with a chosen set of restraint force constants.

The workflow matches the grid-search helper, but executes only one combination:
1. Generate `colvars_combined.conf` and helper PDB files.
2. Create a run-specific copy of `namd.script` with the desired `outputname`.
3. Optionally zero the charge column in the PSF `!NATOM` section.
4. Start NAMD and write its log to a single file.
"""

from __future__ import annotations

import argparse
import re
import shlex
import shutil
import subprocess
from pathlib import Path


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

    run_namd_script.write_text(replace_outputname(namd_script.read_text(), outputname))
    run_command(generator_cmd, cwd=workdir, log_path=generator_log_path)

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