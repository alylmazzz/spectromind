#!/usr/bin/env python3
"""Smoke test: import fid_process without running main; auto-phase recovers ~known rotation."""
import importlib.util
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("fid_process_mod", ROOT / "fid_process.py")
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MOD)


def main() -> int:
    n = 1024
    x = np.linspace(-0.5, 0.5, n)
    i0 = int(n * 0.58)
    peak_r = np.exp(-((np.arange(n) - i0) ** 2) / (2 * 7.0**2)).astype(np.float64)
    ph0_t, ph1_t = 133.0, 48.0
    ph = np.deg2rad(ph0_t) + np.deg2rad(ph1_t) * x
    spec = peak_r.astype(np.complex128) * np.exp(1j * ph)

    r0 = np.real(spec)
    neg0 = float(np.dot(np.minimum(r0, 0.0), np.minimum(r0, 0.0)))

    ph0_e, ph1_e, q, method = MOD.auto_phase_min_neg(spec, None, None)
    r1 = np.real(MOD.apply_linear_phase(spec, ph0_e, ph1_e))
    neg1 = float(np.dot(np.minimum(r1, 0.0), np.minimum(r1, 0.0)))

    # Negatif alan belirgin azalmalı; q (enerji oranı) düşük olmalı
    improved = neg1 < max(1e-9, 0.05 * (neg0 + 1e-9))
    ok = improved and q < 0.25 and method == "auto_l2_neg" and float(np.max(r1)) > 0.2
    print(
        f"true ph0,ph1 = {ph0_t}, {ph1_t}  est = {ph0_e:.2f}, {ph1_e:.2f}  "
        f"q={q:.4f} negL2_before={neg0:.2e} after={neg1:.2e} ok={ok}"
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
