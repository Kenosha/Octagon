"""Reproduce the exact experiment files; uses only Python's standard library.

python3 analysis/run_experiments.py [--jobs 3] [--force]
About 0.7 GB RAM per concurrent worker; existing complete result files are kept.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "analysis"
JOBS = [
    ("baseline", "proper", "original", 1),
    ("removals", "proper", "removals", 14),
    ("additions", "proper", "additions", 11),
    ("local-inner", "local-inner", "", 1),
    ("no-radial", "no-radial", "", 1),
    ("outer-ring", "outer-ring", "", 1),
    ("deploy", "deploy", "", 1),
    ("pass", "pass", "", 1),
    ("legacy", "legacy", "", 2),
    ("symmetric-subsets", "proper", "symmetric-subsets", 7),
    ("fine-removals", "proper", "fine-removals", 10),
]


def run(job, binary, force):
    name, mode, selection, expected = job
    path = OUT / f"{name}.jsonl"
    if path.exists() and not force:
        try:
            rows = [json.loads(line) for line in path.read_text().splitlines()]
            if len(rows) == expected and all(row["bellmanAudit"] for row in rows):
                print(f"Keeping complete {path.name}", flush=True)
                return
        except (ValueError, KeyError):
            pass
    command = [str(binary), mode] + ([selection] if selection else [])
    print(f"Running {name}", flush=True)
    partial = path.with_suffix(".partial")
    with partial.open("w") as output:
        subprocess.run(command, cwd=ROOT, stdout=output, check=True)
    rows = [json.loads(line) for line in partial.read_text().splitlines()]
    if len(rows) != expected:
        raise RuntimeError(f"{name}: expected {expected} experiments, got {len(rows)}")
    partial.replace(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error("--jobs must be positive")
    binary = Path("/tmp/octagon_sensitivity")
    subprocess.run(["g++", "-O3", "-std=c++17", "-Wall", "-Wextra", "-Wpedantic",
                    str(OUT / "sensitivity_solver.cpp"), "-o", str(binary)], check=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(run, job, binary, args.force) for job in JOBS]
        for future in concurrent.futures.as_completed(futures):
            future.result()
