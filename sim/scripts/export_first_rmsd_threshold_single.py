#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import csv
import os
import re
import subprocess
import sys
import tempfile


def find_matching_files(directory, prefix, extension):
    files = []
    for name in os.listdir(directory):
        if name.lower().endswith(extension.lower()) and name.startswith(prefix):
            files.append(name)
    return sorted(files)


def find_single_file_with_ext(directory, extension):
    matches = find_matching_files(directory, "", extension)
    if not matches:
        raise FileNotFoundError(f"Nie znaleziono pliku *{extension} w katalogu: {directory}")
    if len(matches) > 1:
        raise RuntimeError(
            f"Znaleziono wiele plikow *{extension} w katalogu: {directory}. Podaj jawnie --psf."
        )
    return os.path.join(directory, matches[0])


def normalize_tcl_path(path):
    return os.path.abspath(path).replace("\\", "/")


def render_tcl_template(template_path, substitutions):
    with open(template_path, "r", encoding="utf-8") as template_file:
        text = template_file.read()

    for placeholder, value in substitutions.items():
        text = text.replace(placeholder, value)

    return text


def run_vmd(tcl_script, log_path=None):
    cmd = ["vmd", "-dispdev", "text", "-e", tcl_script]
    print("Uruchamiam:", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    combined_output = (result.stdout or "") + (result.stderr or "")

    if log_path:
        with open(log_path, "w", encoding="utf-8") as log_file:
            log_file.write("CMD: " + " ".join(cmd) + "\n\n")
            log_file.write("=== STDOUT ===\n")
            log_file.write(result.stdout or "")
            log_file.write("\n\n=== STDERR ===\n")
            log_file.write(result.stderr or "")
        print(f"Log VMD zapisany do: {log_path}")

    # Ograniczamy spam z VMD: normalnie nic nie wypisujemy z outputu,
    # ale przy bledzie pokazujemy diagnostyke.
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)

    return result.returncode, combined_output


def run_remove_hydrogen(remove_h_script, pdb_path):
    cmd = [sys.executable, remove_h_script, pdb_path, pdb_path]
    print("Uruchamiam:", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode


def parse_vmd_result(output_text):
    found_match = None
    for line in output_text.splitlines():
        line = line.strip()
        if line.startswith("FOUND ") or line.startswith("LAST "):
            found_match = line

    if found_match is None:
        if any(line.strip().startswith("NONE ") for line in output_text.splitlines()):
            return {
                "status": "no_match",
                "frame": "",
                "rmsd": "",
                "output_pdb": "",
                "message": "Brak klatki powyzej progu",
            }
        return {
            "status": "error",
            "frame": "",
            "rmsd": "",
            "output_pdb": "",
            "message": "Nie udalo sie odczytac wyniku VMD",
        }

    frame_match = re.search(r"frame=(\d+)", found_match)
    rmsd_match = re.search(r"rmsd=([0-9]+(?:\.[0-9]+)?)", found_match)
    output_match = re.search(r"output=(.+)$", found_match)
    status = "found" if found_match.startswith("FOUND ") else "last"

    return {
        "status": status,
        "frame": frame_match.group(1) if frame_match else "",
        "rmsd": rmsd_match.group(1) if rmsd_match else "",
        "output_pdb": output_match.group(1) if output_match else "",
        "message": "",
    }


def build_output_name(dcd_name, frame, rmsd):
    base = os.path.splitext(os.path.basename(dcd_name))[0]
    return f"{base}_frame{int(frame):06d}_rmsd{float(rmsd):.3f}.pdb"


def find_existing_export_for_dcd(output_dir, dcd_name):
    base = os.path.splitext(os.path.basename(dcd_name))[0]
    matches = []

    for name in os.listdir(output_dir):
        if not name.lower().endswith(".pdb"):
            continue
        # Obslugujemy zarowno finalny format *_frameXXXXXX_rmsdY.YYY.pdb,
        # jak i ewentualny format tymczasowy *_threshold_*.pdb.
        if name.startswith(f"{base}_frame") and "_rmsd" in name:
            matches.append(os.path.join(output_dir, name))
            continue
        if name.startswith(f"{base}_threshold_"):
            matches.append(os.path.join(output_dir, name))

    if not matches:
        return None
    return sorted(matches)[0]


def main():
    parser = argparse.ArgumentParser(
        description="Eksportuj pierwsza klatke z RMSD powyzej progu dla jednego pliku DCD"
    )
    parser.add_argument(
        "--dcd",
        required=True,
        help="Sciezka do konkretnego pliku DCD"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        required=True,
        help="Prog RMSD w Angstremach"
    )
    parser.add_argument(
        "--psf",
        default=None,
        help="Sciezka do pliku PSF. Jesli nie podano, skrypt sprobuje znalezc jedyny plik *.psf w katalogu DCD"
    )
    parser.add_argument(
        "--reference",
        default=None,
        help="Opcjonalny plik referencyjny PDB. Jesli nie podano, jako referencja uzyta zostanie klatka 0 DCD"
    )
    parser.add_argument(
        "--selection",
        default="noh",
        help="Selekcja atomow uzywana do liczenia RMSD (domyslnie: noh)"
    )
    parser.add_argument(
        "--export-selection",
        default="all",
        help="Selekcja atomow zapisywana do PDB po przekroczeniu progu (domyslnie: all)"
    )
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Katalog wyjsciowy dla PDB i CSV (domyslnie: ten sam co katalog DCD)"
    )
    parser.add_argument(
        "--out-pdb",
        default=None,
        help="Nazwa lub sciezka pliku wyjsciowego PDB. Dla sciezki wzglednej bazą jest --out-dir"
    )
    parser.add_argument(
        "--template",
        default=None,
        help="Sciezka do szablonu TCL (domyslnie: plik obok tego skryptu)"
    )
    parser.add_argument(
        "--summary",
        default=None,
        help="Nazwa pliku CSV z podsumowaniem (domyslnie: <dcd_name>_rmsd_threshold_summary.csv)"
    )
    parser.add_argument(
        "--vmd-log",
        default=None,
        help="Sciezka do pliku logu VMD (domyslnie: <dcd_name>_vmd.log w --out-dir)"
    )
    parser.add_argument(
        "--no-align",
        action="store_true",
        help="Wylacz dopasowanie przed obliczeniem RMSD"
    )

    args = parser.parse_args()

    dcd_path = os.path.abspath(args.dcd)
    if not os.path.isfile(dcd_path):
        print(f"Blad: plik DCD nie istnieje: {dcd_path}")
        sys.exit(1)
    if not dcd_path.lower().endswith(".dcd"):
        print(f"Blad: plik nie ma rozszerzenia .dcd: {dcd_path}")
        sys.exit(1)

    input_dir = os.path.dirname(dcd_path)
    dcd_name = os.path.basename(dcd_path)
    dcd_base = os.path.splitext(dcd_name)[0]

    output_dir = os.path.abspath(args.out_dir) if args.out_dir else input_dir
    os.makedirs(output_dir, exist_ok=True)

    forced_out_pdb = None
    if args.out_pdb:
        forced_out_pdb = args.out_pdb
        if not os.path.isabs(forced_out_pdb):
            forced_out_pdb = os.path.join(output_dir, forced_out_pdb)
        if not forced_out_pdb.lower().endswith(".pdb"):
            forced_out_pdb += ".pdb"
        forced_out_pdb = os.path.abspath(forced_out_pdb)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = args.template if args.template else os.path.join(script_dir, "export_first_rmsd_threshold.tcl")
    if not os.path.isfile(template_path):
        print(f"Blad: nie znaleziono szablonu TCL: {template_path}")
        sys.exit(1)

    remove_h_script = os.path.join(script_dir, "remove_hydrogen.py")
    if not os.path.isfile(remove_h_script):
        print(f"Blad: nie znaleziono skryptu: {remove_h_script}")
        sys.exit(1)

    if args.psf:
        psf_path = os.path.abspath(args.psf)
        if not os.path.isfile(psf_path):
            print(f"Blad: plik PSF nie istnieje: {psf_path}")
            sys.exit(1)
    else:
        psf_path = find_single_file_with_ext(input_dir, ".psf")

    reference_path = None
    if args.reference:
        reference_path = os.path.abspath(args.reference)
        if not os.path.isfile(reference_path):
            print(f"Blad: plik referencyjny nie istnieje: {reference_path}")
            sys.exit(1)

    print(f"Przetwarzanie DCD: {dcd_name}")
    print(f"PSF: {psf_path}")
    if reference_path:
        print(f"Referencja: {reference_path}")
    else:
        print("Referencja: klatka 0 DCD")

    summary_rows = []
    default_csv_name = f"{dcd_base}_rmsd_threshold_summary.csv"
    csv_path = args.summary if args.summary else os.path.join(output_dir, default_csv_name)
    vmd_log_path = args.vmd_log if args.vmd_log else os.path.join(output_dir, f"{dcd_base}_vmd.log")
    if not os.path.isabs(vmd_log_path):
        vmd_log_path = os.path.join(output_dir, vmd_log_path)
    vmd_log_path = os.path.abspath(vmd_log_path)

    existing_pdb = None
    if forced_out_pdb:
        if os.path.exists(forced_out_pdb):
            existing_pdb = forced_out_pdb
    else:
        existing_pdb = find_existing_export_for_dcd(output_dir, dcd_name)
    if existing_pdb:
        print("=" * 70)
        print(f"Pomijam: istnieje juz PDB dla tego DCD: {existing_pdb}")
        summary_rows.append(
            {
                "dcd_file": dcd_name,
                "status": "skipped_existing",
                "frame": "",
                "rmsd": "",
                "output_pdb": existing_pdb,
                "threshold": args.threshold,
                "return_code": 0,
                "message": "Pominieto, bo istnieje juz PDB dla tego DCD",
            }
        )
    else:
        out_pdb = forced_out_pdb if forced_out_pdb else os.path.join(output_dir, f"{dcd_base}_threshold_{args.threshold:.3f}.pdb")

        substitutions = {
            "<psf_file>": "{" + normalize_tcl_path(psf_path) + "}",
            "<dcd_file>": "{" + normalize_tcl_path(dcd_path) + "}",
            "<reference_file>": "{" + normalize_tcl_path(reference_path) + "}" if reference_path else "{}",
            "<threshold>": f"{args.threshold}",
            "<rmsd_selection>": "{" + args.selection + "}",
            "<export_selection>": "{" + args.export_selection + "}",
            "<out_pdb>": "{" + normalize_tcl_path(out_pdb) + "}",
            "<align>": "1" if not args.no_align else "0",
        }

        with tempfile.NamedTemporaryFile("w", suffix=".tcl", delete=False, encoding="utf-8") as temp_file:
            temp_file.write(render_tcl_template(template_path, substitutions))
            temp_tcl = temp_file.name

        print("=" * 70)

        try:
            return_code, output_text = run_vmd(temp_tcl, vmd_log_path)
        finally:
            if os.path.exists(temp_tcl):
                os.remove(temp_tcl)

        result = parse_vmd_result(output_text)
        row = {
            "dcd_file": dcd_name,
            "status": result["status"],
            "frame": result["frame"],
            "rmsd": result["rmsd"],
            "output_pdb": result["output_pdb"],
            "threshold": args.threshold,
            "return_code": return_code,
            "message": result["message"],
        }
        summary_rows.append(row)

        if return_code != 0:
            print(f"Blad: VMD zwrocil kod {return_code} dla {dcd_name}")
        elif result["status"] in {"found", "last"}:
            if not forced_out_pdb:
                expected_name = build_output_name(dcd_name, result["frame"], result["rmsd"])
                actual_path = os.path.join(output_dir, expected_name)
                if os.path.abspath(result["output_pdb"]) != os.path.abspath(actual_path):
                    if os.path.exists(result["output_pdb"]):
                        os.replace(result["output_pdb"], actual_path)
                    result["output_pdb"] = actual_path
            row["output_pdb"] = result["output_pdb"]

            remove_h_return_code = run_remove_hydrogen(remove_h_script, row["output_pdb"])
            if remove_h_return_code != 0:
                row["message"] = f"remove_hydrogen.py zwrocil kod {remove_h_return_code}"
                print(f"Uwaga: remove_hydrogen.py zwrocil kod {remove_h_return_code}")

            if result["status"] == "last":
                print(f"Brak klatki powyzej progu, zapisano ostatnia: {result['output_pdb']}")
            else:
                print(f"Zapisano: {result['output_pdb']}")
        else:
            print(f"Brak klatki powyzej progu dla {dcd_name}")

    with open(csv_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["dcd_file", "status", "frame", "rmsd", "output_pdb", "threshold", "return_code", "message"],
        )
        writer.writeheader()
        writer.writerows(summary_rows)

    print("=" * 70)
    print(f"Podsumowanie zapisane do: {csv_path}")


if __name__ == "__main__":
    main()
