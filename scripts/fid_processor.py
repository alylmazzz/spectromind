#!/usr/bin/env python3
"""
Legacy compatibility adapter for FID processing.

This script intentionally delegates all scientific processing to fid_process.py
so there is a single authoritative FID worker in production.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Legacy FID adapter -> fid_process.py")
    parser.add_argument("fid_path", help="legacy single-file or dataset path")
    parser.add_argument("format", nargs="?", default="auto")
    parser.add_argument("spec_json", nargs="?", default=None)
    args = parser.parse_args()

    lb = 0.3
    zf = 2.0
    baseline_method = "xi_rocke_ps"
    phase_method = "auto_entropy"
    reference_method = "solvent"
    reference_target_ppm = 0.0
    reference_solvent = ""
    ph0 = None
    ph1 = None
    if args.spec_json:
        try:
            spec = json.loads(args.spec_json)
            apo = spec.get("apodization", {}) if isinstance(spec, dict) else {}
            zf_spec = spec.get("zeroFill", {}) if isinstance(spec, dict) else {}
            phase = spec.get("phase", {}) if isinstance(spec, dict) else {}
            baseline = spec.get("baseline", {}) if isinstance(spec, dict) else {}
            reference = spec.get("reference", {}) if isinstance(spec, dict) else {}
            if isinstance(apo, dict) and isinstance(apo.get("lb_hz"), (int, float)):
                lb = float(apo["lb_hz"])
            if isinstance(zf_spec, dict) and isinstance(zf_spec.get("factor"), (int, float)):
                zf = float(zf_spec["factor"])
            if isinstance(phase, dict) and isinstance(phase.get("mode"), str):
                mode = str(phase.get("mode")).lower()
                if mode in {"auto_entropy", "regions_analysis", "manual_ph0_ph1"}:
                    phase_method = mode
            if isinstance(phase, dict) and phase.get("manual") is True:
                if isinstance(phase.get("ph0_deg"), (int, float)) and isinstance(phase.get("ph1_deg"), (int, float)):
                    ph0 = float(phase["ph0_deg"])
                    ph1 = float(phase["ph1_deg"])
            if isinstance(baseline, dict) and isinstance(baseline.get("algorithm"), str):
                cand = str(baseline.get("algorithm")).lower()
                if cand in {"xi_rocke_ps", "asls", "min_envelope"}:
                    baseline_method = cand
            if isinstance(reference, dict):
                if isinstance(reference.get("method"), str):
                    cand_ref = str(reference.get("method")).lower()
                    if cand_ref in {"solvent", "manual", "tms"}:
                        reference_method = cand_ref
                if isinstance(reference.get("target_ppm"), (int, float)):
                    reference_target_ppm = float(reference.get("target_ppm"))
                if isinstance(reference.get("solvent"), str):
                    reference_solvent = str(reference.get("solvent"))
        except Exception:
            pass

    script = Path(__file__).with_name("fid_process.py")
    cmd = [
        sys.executable,
        str(script),
        "--baseDir",
        args.fid_path,
        "--datasetType",
        args.format,
        "--lb",
        str(lb),
        "--zf",
        str(zf),
        "--phase_method",
        phase_method,
        "--baseline_method",
        baseline_method,
        "--reference_method",
        reference_method,
        "--reference_target_ppm",
        str(reference_target_ppm),
        "--reference_solvent",
        reference_solvent,
    ]
    if ph0 is not None and ph1 is not None:
        cmd.extend(["--ph0", str(ph0), "--ph1", str(ph1)])

    run = subprocess.run(cmd, capture_output=True, text=True)
    if run.stdout:
        print(run.stdout.strip())
    if run.stderr:
        sys.stderr.write(run.stderr)
    return run.returncode


if __name__ == "__main__":
    raise SystemExit(main())
