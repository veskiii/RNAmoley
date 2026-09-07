import requests
import time
import json
import argparse


BASE_URL = "https://rnamoley.cs.put.poznan.pl/api/v1"

parser = argparse.ArgumentParser(description="Run RNAmoley analysis for a PDB file.")
parser.add_argument("pdb_path", help="Path to input PDB file")
parser.add_argument(
    "--save-full-data",
    action="store_true",
    help="Save full final response from server in a separate JSON file",
)
parser.add_argument(
    "--nucleotide-ranges",
    help=(
        "Override nucleotide selection using comma-separated ranges in format "
        "<chain>:<residue>-<residue>, e.g. A:1-10,B:50-60"
    ),
)
args = parser.parse_args()

PDB_PATH = args.pdb_path

session = requests.Session()


def parse_nucleotide_ranges(value):
    models = []
    if value is None:
        return models

    chunks = [chunk.strip() for chunk in value.split(",") if chunk.strip()]
    if not chunks:
        raise ValueError("No nucleotide ranges provided.")

    for chunk in chunks:
        if ":" not in chunk:
            raise ValueError(
                f"Invalid range '{chunk}'. Expected format <chain>:<residue>-<residue>."
            )

        chain_id, residue_span = chunk.split(":", 1)
        chain_id = chain_id.strip()
        residue_span = residue_span.strip()
        if not chain_id:
            raise ValueError(
                f"Invalid range '{chunk}'. Chain identifier cannot be empty."
            )

        if "-" not in residue_span:
            raise ValueError(
                f"Invalid range '{chunk}'. Expected residue interval <start>-<end>."
            )

        start_raw, end_raw = residue_span.split("-", 1)
        try:
            start = int(start_raw.strip())
            end = int(end_raw.strip())
        except ValueError as exc:
            raise ValueError(
                f"Invalid range '{chunk}'. Residue values must be integers."
            ) from exc

        if start > end:
            raise ValueError(
                f"Invalid range '{chunk}'. Start residue cannot be greater than end residue."
            )

        for residue_id in range(start, end + 1):
            models.append({"chainID": chain_id, "residueID": residue_id})

    return models

#  Upload RNA
with open(PDB_PATH, "rb") as f:
    response = session.post(
        f"{BASE_URL}/jobs",
        data={
            "jobName": "",
            "pdbCode": "",
            "radioButton": "None"
        },
        files={"rnaFile": (
            "file.pdb", f, "application/octet-stream"
        )}
    )

print(response.status_code)
print(response.text)

job_id = response.json()["id"]

status = "creating"
while status != "created":
    response = session.get(f"{BASE_URL}/jobs/{job_id}")
    data = response.json()
    status = data["metadata"]["status"]
    print("Status:", status)
    time.sleep(2)

# get lowest and highest key in numeration
response = session.get(f"{BASE_URL}/jobs/{job_id}/1")
data = response.json()
numeration = data["numeration"]
residues = numeration.keys()
lowest = min(numeration.keys(), key=int)
highest = max(numeration.keys(), key=int)
print("Lowest:", lowest)
print("Highest:", highest)
chainId = data["numeration"][lowest]["auth_chain_id"]

# Analyze RNA
if args.nucleotide_ranges:
    try:
        model_entries = parse_nucleotide_ranges(args.nucleotide_ranges)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"Using manually selected nucleotides: {args.nucleotide_ranges}")
else:
    model_entries = [{"chainID": chainId, "residueID": int(i)} for i in residues]

request_data = {
    "id": job_id, 
    "interval": -1,
    "radius": -1,
    "models": {
        "1": model_entries
    }
}

with open("request_data.json", "w") as f:
    json.dump(request_data, f, indent=2)

response = session.post(
    f"{BASE_URL}/jobs/analyzeStructure",
    json=request_data
)

results = {}
# # Status polling
status = "starting"
while status != "completed":
    response = session.get(f"{BASE_URL}/jobs/{job_id}/1")
    data = response.json()
    status = data["metadata"]["status"]
    print("Status:", status)
    time.sleep(2)
    if status == "completed":
        sequence = data["annotation"][0]["sequnece"]
        dotbracket = data["annotation"][0]["dotbracket"]
        # save sequence and dotbracket to dot file
        with open(PDB_PATH.rsplit(".", 1)[0] + ".dot", "w") as f:
            f.write(f">{PDB_PATH}\n")
            f.write(sequence + "\n")
            f.write(dotbracket + "\n")
        results = data["results"]
        results_filename = PDB_PATH.rsplit(".", 1)[0] + ".json"
        with open(results_filename, "w") as f:
            json.dump(results, f, indent=4)
        print(f"Job completed. Results saved to {results_filename}.")

        if args.save_full_data:
            full_data_filename = PDB_PATH.rsplit(".", 1)[0] + "_full.json"
            with open(full_data_filename, "w") as f:
                json.dump(data, f, indent=4)
            print(f"Full response saved to {full_data_filename}.")
    elif status == "failed":
        print("Job failed.")
        error_filename = PDB_PATH.rsplit(".", 1)[0] + "_error.json"
        with open(error_filename, "w") as f:
            json.dump(data, f, indent=4)
        break


