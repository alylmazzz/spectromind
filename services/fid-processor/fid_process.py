#!/usr/bin/env python3
"""
SpectroMind FID processor -- production-oriented 1D NMR pipeline.

Scope
-----
This script is designed for 1D observed NMR processing from raw vendor datasets.
It intentionally separates:
- raw acquisition parsing
- signal processing
- ppm/reference construction
- QC and provenance
- peak picking

Supported now
-------------
- Bruker 1D fid / 1D-shaped ser
- Varian/Agilent 1D fid via procpar

Explicitly out of scope in this file
------------------------------------
- JEOL/JDF raw parsing (raise unsupported)
- 2D contour rendering / 2D processing
- manual UI interaction (ph0/ph1 sliders belong in app layer)

Processing order
----------------
load -> 1D guard -> vendor corrections -> DC removal -> apodization -> zero-fill
-> FFT -> auto/manual phase -> baseline -> ppm axis -> reference calibration
-> display scaling -> QC -> peak picking
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import traceback
from dataclasses import dataclass, asdict
from typing import Any, Iterable

import numpy as np

try:
    from scipy.optimize import minimize
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    from scipy.signal import find_peaks, peak_widths
    from scipy.sparse import diags
    from scipy.sparse.linalg import spsolve
except Exception:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "SCIPY_NOT_INSTALLED",
                "message": "scipy is required for phase/baseline/QC. Install: pip install scipy",
            }
        )
    )
    sys.exit(1)

try:
    import nmrglue as ng
    from nmrglue.process import proc_base as proc
except Exception:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "NMRGLUE_NOT_INSTALLED",
                "message": "nmrglue is required. Install: pip install nmrglue",
            }
        )
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------

VENDOR_BRUKER = "bruker"
VENDOR_VARIAN = "varian"
VENDOR_JEOL = "jeol"

DEFAULT_H1_VIEW_RANGE = [14.0, -1.0]
DEFAULT_H1_WIDE_RANGE = [14.0, -2.0]
DEFAULT_C13_VIEW_RANGE = [230.0, -10.0]

H1_PPM_PLAUSIBLE_MIN = -5.0
H1_PPM_PLAUSIBLE_MAX = 25.0
H1_PPM_MAX_SPAN = 60.0
C13_PPM_PLAUSIBLE_MIN = -20.0
C13_PPM_PLAUSIBLE_MAX = 300.0

SOLVENT_REF_PPM: dict[str, float] = {
    "CDCl3": 7.26,
    "DMSO-d6": 2.50,
    "DMSO": 2.50,
    "D2O": 4.79,
    "CD3OD": 3.31,
    "MeOD": 3.31,
    "Acetone-d6": 2.05,
    "CD2Cl2": 5.32,
    "C6D6": 7.16,
    "THF-d8": 1.73,
    "Toluene-d8": 2.09,
    "Pyridine-d5": 7.22,
    "DMF-d7": 2.75,
    "CD3CN": 1.94,
    "TMS": 0.00,
}

SOLVENT_ALIASES: dict[str, str] = {
    "CHLOROFORM": "CDCl3",
    "CHLOROFORM-D": "CDCl3",
    "CDCL3": "CDCl3",
    "DMSOD6": "DMSO-d6",
    "DIMETHYLSULFOXIDE": "DMSO-d6",
    "HEAVYWATER": "D2O",
    "METHANOLD4": "CD3OD",
    "METHANOL": "CD3OD",
    "MEOD": "CD3OD",
    "DICHLOROMETHANE": "CD2Cl2",
    "DCM": "CD2Cl2",
    "BENZENE": "C6D6",
    "ACETONE": "Acetone-d6",
    "PYRIDINE": "Pyridine-d5",
    "THF": "THF-d8",
    "DMF": "DMF-d7",
    "TOLUENE": "Toluene-d8",
    "ACETONITRILE": "CD3CN",
    "ACN": "CD3CN",
    "TETRAMETHYLSILANE": "TMS",
}

AUTO_REF_CANDIDATES: list[tuple[str, float]] = [
    ("CDCl3", 7.26),
    ("DMSO-d6", 2.50),
    ("D2O", 4.79),
    ("CD3OD", 3.31),
    ("Acetone-d6", 2.05),
    ("CD2Cl2", 5.32),
    ("C6D6", 7.16),
    ("CD3CN", 1.94),
]


# ---------------------------------------------------------------------------
# dataclasses
# ---------------------------------------------------------------------------

@dataclass
class StepLog:
    step: str
    ok: bool
    detail: str | None = None


@dataclass
class ProcessingMeta:
    vendor: str
    source_format: str
    dataset_dir: str
    nucleus: str
    dimension: int
    spectrometer_freq_mhz: float
    spectral_width_hz: float
    spectral_width_ppm: float
    carrier_hz: float
    carrier_ppm: float
    raw_fid_points: int
    processed_points: int
    axis_type: str
    ppm_source: str
    display_direction: str
    default_display_range_ppm: list[float]
    default_wide_range_ppm: list[float] | None
    solvent_hint: str | None
    solvent_normalized: str | None
    reference_mode: str
    reference_offset_ppm_applied: float
    metadata_confidence: str
    actual_ppm_range: list[float]


# ---------------------------------------------------------------------------
# utilities
# ---------------------------------------------------------------------------

def _json_default(o: Any):
    if isinstance(o, np.generic):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    if hasattr(o, "__dict__"):
        return o.__dict__
    return str(o)


def sanitize_floats(values: Iterable[float]) -> list[float]:
    out: list[float] = []
    for v in values:
        fv = float(v)
        if not math.isfinite(fv):
            out.append(0.0)
        else:
            out.append(fv)
    return out


def _trapz_uniform(y: np.ndarray) -> float:
    y = np.asarray(y, dtype=np.float64, copy=False)
    try:
        return float(np.trapezoid(y))
    except AttributeError:
        return float(np.trapz(y))


def find_file_recursive(root: str, filename: str) -> str | None:
    target = filename.lower()
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.lower() == target:
                return os.path.join(dirpath, fn)
    return None


def resolve_dataset_dir(base: str) -> tuple[str | None, str | None]:
    """Return (dataset_dir, source_format)."""
    if os.path.isfile(base):
        name = os.path.basename(base).lower()
        if name == "fid":
            return os.path.dirname(base), "fid"
        if name == "ser":
            return os.path.dirname(base), "ser"
        if name.endswith(".jdf"):
            return base, "jdf"

    if os.path.isfile(os.path.join(base, "fid")):
        return base, "fid"
    if os.path.isfile(os.path.join(base, "ser")):
        return base, "ser"
    fid_path = find_file_recursive(base, "fid")
    if fid_path:
        return os.path.dirname(fid_path), "fid"
    ser_path = find_file_recursive(base, "ser")
    if ser_path:
        return os.path.dirname(ser_path), "ser"
    jdf_path = None
    for dirpath, _dirnames, filenames in os.walk(base):
        for fn in filenames:
            if fn.lower().endswith(".jdf"):
                jdf_path = os.path.join(dirpath, fn)
                break
        if jdf_path:
            break
    if jdf_path:
        return jdf_path, "jdf"
    return None, None


def detect_vendor(base: str, source_format: str | None) -> str:
    if source_format == "jdf":
        return VENDOR_JEOL
    if os.path.exists(os.path.join(base, "acqus")) or os.path.exists(os.path.join(base, "acqus")):
        return VENDOR_BRUKER
    if os.path.exists(os.path.join(base, "procpar")):
        return VENDOR_VARIAN
    if source_format in {"fid", "ser"}:
        # fall back to Bruker first, Varian second only if procpar appears later
        return VENDOR_BRUKER
    return "unknown"


def ensure_1d_complex(data: Any) -> tuple[np.ndarray, bool]:
    arr = np.asarray(data)
    if arr.ndim == 0:
        raise ValueError("empty_or_scalar_data")
    if arr.ndim > 1:
        # allow effectively 1D shaped arrays only
        if arr.ndim == 2 and 1 in arr.shape:
            sq = np.squeeze(arr)
            if sq.ndim == 1:
                return sq.astype(np.complex128, copy=False), True
        raise ValueError("unsupported_2d_or_nd")
    return arr.astype(np.complex128, copy=False), False


def exp_apodize(fid: np.ndarray, lb_hz: float, dwell: float) -> np.ndarray:
    if lb_hz <= 0:
        return fid
    n = fid.shape[-1]
    t = np.arange(n, dtype=np.float64) * dwell
    w = np.exp(-np.pi * lb_hz * t)
    return fid * w


def zerofill(fid: np.ndarray, zf_factor: float) -> np.ndarray:
    if zf_factor <= 1.0:
        return fid
    n = fid.shape[-1]
    target = max(int(math.ceil(n * zf_factor)), n)
    new_n = 2 ** int(np.ceil(np.log2(target)))
    out = np.zeros(new_n, dtype=np.complex128)
    out[:n] = fid
    return out


def apply_linear_phase(spec: np.ndarray, ph0_deg: float, ph1_deg: float) -> np.ndarray:
    n = spec.shape[-1]
    x = np.linspace(-0.5, 0.5, n, dtype=np.float64)
    ph = np.deg2rad(ph0_deg) + np.deg2rad(ph1_deg) * x
    return spec * np.exp(1j * ph)


def phase_quality_ratio(spec: np.ndarray, ph0_deg: float, ph1_deg: float) -> float:
    r = np.real(apply_linear_phase(spec, ph0_deg, ph1_deg))
    pos = np.maximum(r, 0.0)
    neg = np.minimum(r, 0.0)
    pos_e = float(np.dot(pos, pos))
    neg_e = float(np.dot(neg, neg))
    return neg_e / (pos_e + 1e-12)


def auto_phase(
    spec: np.ndarray,
    manual_ph0: float | None,
    manual_ph1: float | None,
    mode: str = "auto_entropy",
) -> tuple[float, float, float, str]:
    if manual_ph0 is not None and manual_ph1 is not None:
        q = phase_quality_ratio(spec, manual_ph0, manual_ph1)
        return manual_ph0, manual_ph1, q, "manual"

    def obj_entropy(v: np.ndarray) -> float:
        r = np.real(apply_linear_phase(spec, float(v[0]), float(v[1])))
        a = np.abs(r) + 1e-18
        p = a / np.sum(a)
        entropy = -float(np.sum(p * np.log(p)))
        penalty = float(np.sum(np.minimum(r, 0.0) ** 2)) * 1e-6
        return entropy + penalty

    def obj_neg(v: np.ndarray) -> float:
        r = np.real(apply_linear_phase(spec, float(v[0]), float(v[1])))
        neg = np.minimum(r, 0.0)
        return float(np.dot(neg, neg))

    starts = [
        (0.0, 0.0),
        (45.0, 0.0),
        (-45.0, 0.0),
        (90.0, 0.0),
        (-90.0, 0.0),
        (180.0, 0.0),
        (0.0, 90.0),
        (0.0, -90.0),
        (90.0, 90.0),
        (-90.0, -90.0),
    ]

    objectives = (obj_entropy, obj_neg) if mode != "regions_analysis" else (obj_neg,)
    method_name = "auto_entropy"
    if mode == "regions_analysis":
        method_name = "regions_analysis"
    best = (0.0, 0.0, float("inf"))
    for obj in objectives:
        for p0, p1 in starts:
            try:
                res = minimize(
                    obj,
                    x0=np.array([p0, p1], dtype=np.float64),
                    method="L-BFGS-B",
                    bounds=[(-360.0, 360.0), (-1080.0, 1080.0)],
                    options={"maxiter": 80},
                )
                q = phase_quality_ratio(spec, float(res.x[0]), float(res.x[1]))
                if q < best[2]:
                    best = (float(res.x[0]), float(res.x[1]), q)
            except Exception:
                continue
    return best[0], best[1], best[2], method_name


def baseline_min_envelope(y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = len(y)
    w = max(17, n // 128)
    if w % 2 == 0:
        w += 1
    env = minimum_filter1d(y.astype(np.float64), size=w, mode="nearest")
    w2 = min(max(w * 4, 5), max(5, n // 4))
    if w2 % 2 == 0:
        w2 += 1
    baseline = uniform_filter1d(env, size=w2, mode="nearest")
    return baseline, y.astype(np.float64) - baseline


def baseline_asls(y: np.ndarray, lam: float = 1e7, p: float = 0.001, n_iter: int = 10) -> tuple[np.ndarray, np.ndarray]:
    yf = y.astype(np.float64)
    n = len(yf)
    if n < 8:
        base = np.zeros_like(yf)
        return base, yf
    d = diags([1, -2, 1], [0, 1, 2], shape=(n - 2, n))
    h = lam * d.T.dot(d)
    w = np.ones(n, dtype=np.float64)
    z = np.zeros(n, dtype=np.float64)
    for _ in range(n_iter):
        W = diags(w, 0, shape=(n, n))
        z = spsolve(W + h, w * yf)
        w = np.where(yf > z, p, 1.0 - p)
    return z, yf - z


def estimate_noise_sigma_lowess(y: np.ndarray, bin_size: int = 32, frac: float = 0.2) -> float:
    """
    Xi & Rocke (BMC Bioinformatics 2008, 9:324) noise sigma estimation:
    estimate Var(y|mu≈0) from LOWESS-like local quadratic fit of binned (mean, var).
    """
    yf = np.asarray(y, dtype=np.float64)
    n = len(yf)
    if n < max(16, bin_size):
        s = float(np.std(yf))
        return s if math.isfinite(s) and s > 1e-12 else 1.0

    m = n // bin_size
    if m < 8:
        s = float(np.std(yf))
        return s if math.isfinite(s) and s > 1e-12 else 1.0

    trimmed = yf[: m * bin_size].reshape(m, bin_size)
    mu = np.mean(trimmed, axis=1)
    va = np.var(trimmed, axis=1, ddof=1)
    mask = np.isfinite(mu) & np.isfinite(va) & (va >= 0)
    mu = mu[mask]
    va = va[mask]
    if len(mu) < 6:
        s = float(np.std(yf))
        return s if math.isfinite(s) and s > 1e-12 else 1.0

    x0 = 0.0
    d = np.abs(mu - x0)
    k = max(4, int(math.ceil(frac * len(mu))))
    h = float(np.partition(d, min(k - 1, len(d) - 1))[min(k - 1, len(d) - 1)])
    if h <= 1e-12:
        h = float(np.max(d)) + 1e-12

    u = d / h
    w = np.where(u < 1.0, (1.0 - u**3) ** 3, 0.0)
    if np.sum(w > 0) < 4:
        s = float(np.std(yf))
        return s if math.isfinite(s) and s > 1e-12 else 1.0

    X = np.column_stack([np.ones_like(mu), mu, mu**2])
    W = np.sqrt(w)
    Xw = X * W[:, None]
    yw = va * W
    try:
        beta, *_ = np.linalg.lstsq(Xw, yw, rcond=None)
        sigma2 = float(beta[0])  # predicted Var(y) at mu=0
    except Exception:
        sigma2 = float(np.median(va))

    if not math.isfinite(sigma2) or sigma2 <= 0:
        sigma2 = float(np.median(va[va > 0])) if np.any(va > 0) else float(np.var(yf))
    sigma2 = max(sigma2, 1e-12)
    return float(math.sqrt(sigma2))


def baseline_xi_rocke(
    y: np.ndarray,
    a_star: float = 5e-9,
    b_star: float = 2.0 / math.sqrt(2.0 * math.pi),
    max_iter: int = 30,
    tol: float = 1e-4,
) -> tuple[np.ndarray, np.ndarray, float, float, float]:
    """
    Penalized smoothing baseline (Xi & Rocke, 2008):
      maximize F(b)=sum(b)-A* n^4/sigma * sum((Δ²b)^2)-B*/sigma * sum((b-y)^2 I[b>y]).
    Implemented as iterative reweighted linear solves.
    Returns baseline, corrected, sigma, A, B.
    """
    yf = np.asarray(y, dtype=np.float64)
    n = len(yf)
    if n < 8:
        base = np.zeros_like(yf)
        return base, yf, 1.0, 0.0, 0.0

    sigma = estimate_noise_sigma_lowess(yf)
    A = float((a_star * (n**4)) / max(sigma, 1e-12))
    B = float(b_star / max(sigma, 1e-12))

    d2 = diags([1, -2, 1], [0, 1, 2], shape=(n - 2, n), format="csr")
    L = d2.T.dot(d2).tocsr()
    I = diags(np.ones(n, dtype=np.float64), 0, shape=(n, n), format="csr")

    b = np.zeros(n, dtype=np.float64)
    prev_rel = float("inf")

    for _ in range(max_iter):
        w = (b > yf).astype(np.float64)
        W = diags(w, 0, shape=(n, n), format="csr")

        # (2A L + 2B W) b = 1 + 2B W y
        M = (2.0 * A) * L + (2.0 * B) * W + 1e-10 * I
        rhs = np.ones(n, dtype=np.float64) + (2.0 * B) * (w * yf)
        b_new = np.asarray(spsolve(M, rhs), dtype=np.float64)

        denom = float(np.linalg.norm(b) + 1e-12)
        rel = float(np.linalg.norm(b_new - b) / denom)
        b = b_new
        if rel < tol or abs(prev_rel - rel) < tol * 0.1:
            break
        prev_rel = rel

    return b, yf - b, sigma, A, B


def estimate_snr(y: np.ndarray) -> float:
    ya = np.abs(y.astype(np.float64))
    if len(ya) == 0:
        return 0.0
    thr = np.percentile(ya, 15)
    noise_mask = ya <= thr
    if np.sum(noise_mask) < max(8, len(ya) // 100):
        noise_mask = ya <= np.percentile(ya, 25)
    sig = float(np.percentile(ya, 99.5))
    noise_std = float(np.std(y[noise_mask])) if np.any(noise_mask) else float(np.std(y))
    if noise_std < 1e-12:
        return float("inf") if sig > 0 else 0.0
    return sig / noise_std


def robust_scale(y: np.ndarray, percentile: float) -> float:
    ya = np.abs(y.astype(np.float64))
    s = float(np.percentile(ya, percentile))
    if s < 1e-15:
        mx = float(np.max(ya)) if len(ya) else 1.0
        return mx if mx > 0 else 1.0
    return s


def _resolve_solvent_key(solvent: str | None) -> str | None:
    if not solvent:
        return None
    cleaned = solvent.upper().replace(" ", "").replace("-", "").replace("_", "")
    for k in SOLVENT_REF_PPM:
        kk = k.upper().replace(" ", "").replace("-", "").replace("_", "")
        if cleaned == kk or cleaned.startswith(kk):
            return k
    for alias, canonical in SOLVENT_ALIASES.items():
        aa = alias.upper().replace(" ", "").replace("-", "").replace("_", "")
        if cleaned == aa or cleaned.startswith(aa):
            return canonical
    return None


def _reference_to_expected_peak(ppm: np.ndarray, y: np.ndarray, expected_ppm: float) -> tuple[np.ndarray, float, str]:
    window = 1.2
    mask = (ppm >= expected_ppm - window) & (ppm <= expected_ppm + window)
    if np.sum(mask) < 3:
        return ppm, 0.0, "no_peak_in_window"
    y_search = np.abs(y).copy()
    y_search[~mask] = 0.0
    idx = int(np.argmax(y_search))
    found = float(ppm[idx])
    shift = expected_ppm - found
    if abs(shift) > 2.0:
        return ppm, 0.0, f"shift_too_large:{shift:.4f}"
    return ppm + shift, shift, f"applied:{shift:.4f}"


def solvent_auto_ref(ppm: np.ndarray, y: np.ndarray, solvent_hint: str | None) -> tuple[np.ndarray, float, str, str | None]:
    resolved = _resolve_solvent_key(solvent_hint)
    if resolved is not None:
        ppm2, shift, status = _reference_to_expected_peak(ppm, y, SOLVENT_REF_PPM[resolved])
        if status.startswith("applied"):
            return ppm2, shift, f"solvent:{resolved}:{status}", resolved
        # If explicit solvent lock fails, continue with auto candidates instead of silently keeping wrong axis.
        explicit_fail_status = f"solvent:{resolved}:{status}"
    else:
        explicit_fail_status = None

    best = None
    best_abs = 1e9
    for name, target in AUTO_REF_CANDIDATES:
        ppm2, shift, status = _reference_to_expected_peak(ppm, y, target)
        if status.startswith("applied") and abs(shift) < best_abs:
            best_abs = abs(shift)
            best = (ppm2, shift, f"auto:{name}:{status}", name)
    if best is not None:
        return best
    if explicit_fail_status is not None:
        return ppm, 0.0, f"{explicit_fail_status}:auto:none", resolved
    return ppm, 0.0, "none", None


def ppm_axis_plausible(ppm: np.ndarray, nucleus: str) -> tuple[bool, str]:
    if len(ppm) == 0:
        return False, "empty_ppm"
    pmin = float(np.nanmin(ppm))
    pmax = float(np.nanmax(ppm))
    if not math.isfinite(pmin) or not math.isfinite(pmax):
        return False, "nonfinite_ppm"
    span = pmax - pmin
    nuc = nucleus.upper()
    if nuc in {"1H", "H1", "PROTON"}:
        if span < 0.01:
            return False, f"span_too_narrow:{span:.6f}"
        if span > H1_PPM_MAX_SPAN:
            return False, f"span_too_wide:{span:.3f}"
        if pmin > H1_PPM_PLAUSIBLE_MAX or pmax < H1_PPM_PLAUSIBLE_MIN:
            return False, f"outside_h1_range:[{pmin:.3f},{pmax:.3f}]"
    elif nuc in {"13C", "C13", "CARBON"}:
        if pmin < C13_PPM_PLAUSIBLE_MIN or pmax > C13_PPM_PLAUSIBLE_MAX:
            return False, f"outside_c13_range:[{pmin:.3f},{pmax:.3f}]"
    return True, "ok"


def fallback_ppm_axis(n: int, sw_hz: float, obs_mhz: float, car_ppm: float) -> np.ndarray:
    sw_ppm = sw_hz / obs_mhz if obs_mhz > 0 else 25.0
    return np.linspace(car_ppm + sw_ppm / 2, car_ppm - sw_ppm / 2, n, endpoint=False)


def nucleus_from_udic(udic: dict) -> str:
    try:
        lab = str(udic[0].get("label", "1H"))
        if lab:
            return lab
    except Exception:
        pass
    return "1H"


def _procpar_first_value(dic: dict, key: str) -> Any | None:
    try:
        procpar = dic.get("procpar", {})
        if not isinstance(procpar, dict):
            return None
        entry = procpar.get(key, {})
        if not isinstance(entry, dict):
            return None
        values = entry.get("values", [])
        if isinstance(values, list) and values:
            return values[0]
    except Exception:
        return None
    return None


def _to_float_or_none(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def overall_qc_status(phase_q: float, snr: float, ppm_ok: bool, has_signal: bool, meta_low: bool) -> str:
    if not has_signal:
        return "PROCESSING_FAILED"
    if not ppm_ok:
        return "AXIS_UNCERTAIN"
    if phase_q > 0.55:
        return "PHASE_FAILED"
    if phase_q > 0.30 or snr < 3:
        return "PARTIAL_LOW_CONFIDENCE"
    if meta_low:
        return "SUCCESS_MEDIUM_CONFIDENCE"
    return "SUCCESS_HIGH_CONFIDENCE"


def pick_peaks(
    ppm_display_desc: list[float],
    y_display_desc: np.ndarray,
    rel_floor: float = 0.006,
    min_dist_points: int = 4,
    max_peaks: int = 256,
) -> list[dict[str, float]]:
    """
    Observed-authoritative peak picking with anti-overfragmentation safeguards.
    Avoids exploding broad aliphatic envelopes into many fake "m,1H" entries.
    """
    arr = np.asarray(y_display_desc, dtype=np.float64)
    n = len(arr)
    if n < 8:
        return []

    pos = np.maximum(arr, 0.0)
    mx = float(np.max(pos))
    if mx <= 0:
        return []

    # Adaptive noise estimate from lower-intensity band
    noise_band = pos[pos <= np.percentile(pos, 40)]
    noise_std = float(np.std(noise_band)) if noise_band.size > 0 else float(np.std(pos))
    height_floor = max(mx * rel_floor, noise_std * 3.5, 1e-6)
    prominence_floor = max(mx * 0.004, noise_std * 3.0, 1e-6)

    # Convert 0.01 ppm min separation into points (fallback to legacy min_dist_points)
    if n > 1:
        ppm_step = abs(float(ppm_display_desc[1]) - float(ppm_display_desc[0]))
    else:
        ppm_step = 0.005
    min_sep_points = max(min_dist_points, int(max(1, round(0.01 / max(ppm_step, 1e-6)))))

    peak_idx, props = find_peaks(
        pos,
        height=height_floor,
        prominence=prominence_floor,
        distance=min_sep_points,
    )
    if peak_idx.size == 0:
        return []

    # Width estimate for confidence/diagnostics
    widths, _wh, _l, _r = peak_widths(pos, peak_idx, rel_height=0.5)

    # Region-aware de-duplication: merge nearby maxima in same envelope
    # to prevent many repeated peaks around 0.8–1.3 ppm.
    merged_indices: list[int] = []
    cluster_half_width_ppm = 0.035
    for idx in peak_idx:
        if not merged_indices:
            merged_indices.append(int(idx))
            continue
        last = merged_indices[-1]
        ppm_delta = abs(float(ppm_display_desc[last]) - float(ppm_display_desc[int(idx)]))
        if ppm_delta <= cluster_half_width_ppm:
            if pos[int(idx)] > pos[last]:
                merged_indices[-1] = int(idx)
        else:
            merged_indices.append(int(idx))

    # Guard for chemically important windows: keep strongest visible candidate
    # if present above noise, even when broad aliphatic region dominates.
    important_windows = [(8.6, 9.2), (6.8, 7.8), (5.2, 5.8), (3.2, 3.8)]
    low_floor = max(noise_std * 2.5, mx * 0.0015, 1e-6)
    for lo, hi in important_windows:
        mask = (np.asarray(ppm_display_desc) >= lo) & (np.asarray(ppm_display_desc) <= hi)
        if np.sum(mask) < 3:
            continue
        local = pos.copy()
        local[~mask] = 0.0
        i = int(np.argmax(local))
        if local[i] >= low_floor and i not in merged_indices:
            merged_indices.append(i)

    merged_indices = sorted(set(merged_indices), key=lambda i: pos[i], reverse=True)[:max_peaks]

    peaks: list[dict[str, float | str | bool]] = []
    # Region segmentation by ppm gaps between kept maxima.
    ppm_sorted = sorted(
        [float(ppm_display_desc[i]) for i in merged_indices], reverse=True
    )
    region_boundaries: list[float] = []
    for j in range(len(ppm_sorted) - 1):
        if abs(ppm_sorted[j] - ppm_sorted[j + 1]) > 0.12:
            region_boundaries.append((ppm_sorted[j] + ppm_sorted[j + 1]) / 2.0)

    def region_id_for_ppm(ppm_v: float) -> str:
        rid = 1
        for b in region_boundaries:
            if ppm_v < b:
                rid += 1
        return f"R{rid}"
    for i in merged_indices:
        left = max(0, i - 10)
        right = min(n, i + 11)
        area = _trapz_uniform(pos[left:right])
        w = float(widths[np.argmin(np.abs(peak_idx - i))]) if peak_idx.size > 0 else 0.0
        ppm_v = float(ppm_display_desc[i])
        linewidth_ppm = max(ppm_step * max(w, 1.0), ppm_step)
        local_x = np.arange(left, right, dtype=np.float64)
        local_y = pos[left:right]
        amp = max(float(pos[i]), 1e-12)
        gamma_pts = max(w / 2.0, 1.0)
        model = amp / (1.0 + ((local_x - float(i)) / gamma_pts) ** 2)
        fit_residual = float(
            np.sqrt(np.mean((local_y - model) ** 2)) / (amp + 1e-12)
        )
        overlap_flag = False
        for j in merged_indices:
            if j == i:
                continue
            if abs(float(ppm_display_desc[j]) - ppm_v) <= max(
                linewidth_ppm * 1.5, 0.03
            ):
                overlap_flag = True
                break
        confidence = round(
            float(min(1.0, max(0.0, (pos[i] - noise_std) / max(mx, 1e-12)))), 3
        )
        peaks.append(
            {
                "ppm": round(ppm_v, 4),
                "position_ppm": round(ppm_v, 4),
                "height": round(float(arr[i]), 6),
                "apex_intensity": round(float(arr[i]), 6),
                "abs_height": round(float(pos[i]), 6),
                "area": round(float(area), 6),
                "width_points": round(w, 3),
                "linewidth_estimate": round(float(linewidth_ppm), 6),
                "shape_model": "lorentzian",
                "fit_residual": round(float(fit_residual), 6),
                "region_id": region_id_for_ppm(ppm_v),
                "overlap_flag": overlap_flag,
                "confidence": confidence,
            }
        )

    peaks.sort(key=lambda p: abs(p["height"]), reverse=True)
    return peaks[:max_peaks]


def build_chart_contract(ppm_desc: list[float], y_desc: list[float], nucleus: str) -> dict[str, Any]:
    if nucleus.upper() in {"1H", "H1", "PROTON"}:
        return {
            "display_direction": "descending",
            "x_contract": "canonical_descending_ppm",
            "default_display_range_ppm": DEFAULT_H1_VIEW_RANGE,
            "default_wide_range_ppm": DEFAULT_H1_WIDE_RANGE,
            "fit_signal_range_ppm": [max(ppm_desc) if ppm_desc else 14.0, min(ppm_desc) if ppm_desc else 0.0],
        }
    return {
        "display_direction": "descending",
        "x_contract": "canonical_descending_ppm",
        "default_display_range_ppm": DEFAULT_C13_VIEW_RANGE,
        "default_wide_range_ppm": None,
        "fit_signal_range_ppm": [max(ppm_desc) if ppm_desc else 220.0, min(ppm_desc) if ppm_desc else -10.0],
    }


# ---------------------------------------------------------------------------
# main processing class
# ---------------------------------------------------------------------------

class FIDProcessPipeline:
    def __init__(
        self,
        base_dir: str,
        dataset_type: str = "auto",
        lb_hz: float = 0.3,
        zf_factor: float = 2.0,
        manual_ph0: float | None = None,
        manual_ph1: float | None = None,
        phase_mode: str = "auto_entropy",
        baseline_method: str = "xi_rocke_ps",
        reference_method: str = "solvent",
        reference_target_ppm: float = 0.0,
        reference_solvent: str | None = None,
    ):
        self.base_dir = base_dir
        self.dataset_type = dataset_type
        self.lb_hz = lb_hz
        self.zf_factor = zf_factor
        self.manual_ph0 = manual_ph0
        self.manual_ph1 = manual_ph1
        self.phase_mode = phase_mode
        self.baseline_method = baseline_method
        self.reference_method = reference_method
        self.reference_target_ppm = reference_target_ppm
        self.reference_solvent = reference_solvent
        self.logs: list[StepLog] = []
        self.warnings: list[str] = []

    def log(self, step: str, ok: bool, detail: str | None = None):
        self.logs.append(StepLog(step=step, ok=ok, detail=detail))

    def run(self) -> dict[str, Any]:
        if not os.path.exists(self.base_dir):
            raise FileNotFoundError(f"Dataset path not found: {self.base_dir}")

        dataset_dir, source_format = resolve_dataset_dir(self.base_dir)
        if dataset_dir is None:
            return self._error("RAW_NOT_FOUND", f"No fid/ser/JDF found under {self.base_dir}")

        vendor = self.dataset_type if self.dataset_type != "auto" else detect_vendor(dataset_dir, source_format)
        if vendor == VENDOR_JEOL:
            return self._error("UNSUPPORTED_VENDOR", "JEOL/JDF parsing is not implemented in fid_process.py yet")
        if vendor not in {VENDOR_BRUKER, VENDOR_VARIAN}:
            return self._error("UNKNOWN_DATASET", f"Could not determine dataset type for {dataset_dir}")

        self.log("resolve_dataset", True, f"vendor={vendor} source_format={source_format} path={dataset_dir}")

        try:
            if vendor == VENDOR_BRUKER:
                dic, raw = ng.bruker.read(dataset_dir)
                udic = ng.bruker.guess_udic(dic, raw)
            else:
                dic, raw = ng.varian.read(dataset_dir)
                udic = ng.varian.guess_udic(dic, raw)
        except Exception as exc:
            return self._error("LOAD_FAILED", f"Failed to load dataset: {exc}")

        self.log("load_dataset", True, f"shape={np.shape(raw)}")

        try:
            fid, squeezed = ensure_1d_complex(raw)
        except ValueError as exc:
            if str(exc) == "unsupported_2d_or_nd":
                return self._error("UNSUPPORTED_2D_EXPERIMENT", "2D or higher-dimensional raw data is not processed by this 1D pipeline")
            return self._error("BINARY_PARSE_FAILED", str(exc))

        if squeezed:
            self.warnings.append("Input array was squeezed to 1D; verify this is truly a 1D dataset.")

        raw_points = int(fid.shape[-1])
        nucleus = nucleus_from_udic(udic)

        digital_filter_status = "n/a"
        group_delay_corrected = False
        if vendor == VENDOR_BRUKER:
            try:
                fid = np.asarray(ng.bruker.remove_digital_filter(dic, fid.copy()), dtype=np.complex128)
                group_delay_corrected = True
                digital_filter_status = "applied"
                self.log("remove_digital_filter", True, "bruker remove_digital_filter")
            except Exception as exc:
                digital_filter_status = f"skipped:{str(exc)[:140]}"
                self.warnings.append(f"Digital filter/group delay correction skipped: {str(exc)[:200]}")
                self.log("remove_digital_filter", False, str(exc)[:200])

        # metadata
        sw_hz = float(udic[0].get("sw", 0.0) or 0.0)
        obs_mhz = float(udic[0].get("obs", 0.0) or 0.0)
        car_hz = float(udic[0].get("car", 0.0) or 0.0)
        car_ppm = car_hz / obs_mhz if obs_mhz > 0 else 0.0
        meta_low = False

        # Varian/Agilent: if udic is weak, recover core metadata from procpar.
        # This prevents ppm-axis collapse to narrow fallback windows.
        if vendor == VENDOR_VARIAN:
            procpar_sw = _to_float_or_none(_procpar_first_value(dic, "sw"))
            procpar_sfrq = _to_float_or_none(_procpar_first_value(dic, "sfrq"))
            procpar_tn = _procpar_first_value(dic, "tn")
            procpar_h1reffrq = _to_float_or_none(_procpar_first_value(dic, "H1reffrq"))

            udic_suspicious = (
                sw_hz <= 0.0
                or obs_mhz <= 0.0
                or obs_mhz > 2000.0
                or nucleus.upper() in {"X", "UNK", "UNKNOWN"}
            )

            if udic_suspicious:
                if procpar_sw and procpar_sw > 0:
                    sw_hz = procpar_sw
                if procpar_sfrq and procpar_sfrq > 0:
                    obs_mhz = procpar_sfrq
                if procpar_tn:
                    nucleus = str(procpar_tn).strip().upper()
                if (car_hz <= 0 or not np.isfinite(car_hz)) and procpar_h1reffrq and procpar_h1reffrq > 0:
                    car_hz = procpar_h1reffrq * obs_mhz
                car_ppm = car_hz / obs_mhz if obs_mhz > 0 else 0.0
                self.log(
                    "procpar_metadata_recovery",
                    True,
                    f"sw_hz={sw_hz:.3f} obs_mhz={obs_mhz:.6f} nucleus={nucleus}",
                )

        if sw_hz <= 0:
            sw_hz = 10000.0
            meta_low = True
            self.warnings.append("Spectral width missing; using 10 kHz fallback.")
        if obs_mhz <= 0:
            obs_mhz = 400.0
            meta_low = True
            self.warnings.append("Spectrometer frequency missing; using 400 MHz fallback.")

        dwell = 1.0 / sw_hz

        # DC removal
        fid = fid - np.mean(fid)
        self.log("dc_removal", True)

        # apodization
        fid = exp_apodize(fid, self.lb_hz, dwell)
        self.log("apodization", True, f"lb_hz={self.lb_hz}")

        # zero fill
        fid = zerofill(fid, self.zf_factor)
        self.log("zero_fill", True, f"points={len(fid)}")

        # FFT positive
        spec = proc.fft_positive(fid)
        self.log("fft_positive", True)

        # phase
        if self.phase_mode == "manual_ph0_ph1" and (
            self.manual_ph0 is None or self.manual_ph1 is None
        ):
            self.warnings.append(
                "manual_ph0_ph1 selected but ph0/ph1 missing; falling back to auto_entropy."
            )
        effective_phase_mode = (
            "auto_entropy"
            if self.phase_mode == "manual_ph0_ph1"
            and (self.manual_ph0 is None or self.manual_ph1 is None)
            else self.phase_mode
        )
        ph0, ph1, phase_q, phase_method = auto_phase(
            spec, self.manual_ph0, self.manual_ph1, effective_phase_mode
        )
        spec_phased = apply_linear_phase(spec, ph0, ph1)
        self.log("phase_correction", True, f"method={phase_method} ph0={ph0:.3f} ph1={ph1:.3f} q={phase_q:.6f}")

        # baseline
        y_real = np.real(spec_phased).astype(np.float64)
        baseline_method = self.baseline_method
        baseline_sigma = None
        baseline_A = None
        baseline_B = None
        try:
            if baseline_method in {"xi_rocke_ps", "xi_rocke", "penalized_smoothing"}:
                baseline, y_corr, baseline_sigma, baseline_A, baseline_B = baseline_xi_rocke(y_real)
                baseline_method = "xi_rocke_ps"
            elif baseline_method == "asls":
                baseline, y_corr = baseline_asls(y_real)
            else:
                baseline, y_corr = baseline_min_envelope(y_real)
                baseline_method = "min_envelope"
        except Exception as exc:
            baseline, y_corr = baseline_min_envelope(y_real)
            baseline_method = "min_envelope_fallback"
            self.warnings.append(f"Baseline method failed; fallback used: {str(exc)[:160]}")
        self.log("baseline_correction", True, baseline_method)

        # ppm axis (authoritative priority: Varian procpar -> udic -> fallback)
        ppm_source = "udic_uc"
        ppm = None
        if vendor == VENDOR_VARIAN:
            sp_hz = _to_float_or_none(_procpar_first_value(dic, "sp"))
            wp_hz = _to_float_or_none(_procpar_first_value(dic, "wp"))
            sfrq_mhz = _to_float_or_none(_procpar_first_value(dic, "sfrq"))
            npts = len(y_corr)
            if (
                npts > 1
                and sp_hz is not None
                and wp_hz is not None
                and sfrq_mhz is not None
                and np.isfinite(sp_hz)
                and np.isfinite(wp_hz)
                and np.isfinite(sfrq_mhz)
                and wp_hz > 0
                and sfrq_mhz > 0
            ):
                i = np.arange(npts, dtype=np.float64)
                # Procpar processed window in acquisition index order (left-to-right FFT bins).
                # We convert to display-descending later via order_desc reindexing, keeping x/y aligned.
                ppm = (sp_hz + i * (wp_hz / (npts - 1))) / sfrq_mhz
                ppm_source = "varian_procpar_sp_wp_sfrq"
                self.log(
                    "ppm_axis_procpar",
                    True,
                    f"sp={sp_hz:.6f} wp={wp_hz:.6f} sfrq={sfrq_mhz:.9f} n={npts}",
                )
        if ppm is None:
            try:
                uc = ng.fileiobase.uc_from_udic(udic, 0, len(y_corr))
                ppm = uc.ppm_scale()
            except Exception as exc:
                ppm = fallback_ppm_axis(len(y_corr), sw_hz, obs_mhz, car_ppm)
                ppm_source = "fallback_linear"
                self.warnings.append(f"udic ppm axis failed; fallback axis used: {str(exc)[:160]}")

        ppm_ok, ppm_reason = ppm_axis_plausible(ppm, nucleus)
        axis_type = "ppm"
        if not ppm_ok:
            ppm_fallback = fallback_ppm_axis(len(y_corr), sw_hz, obs_mhz, car_ppm)
            fallback_ok, fallback_reason = ppm_axis_plausible(ppm_fallback, nucleus)
            if fallback_ok:
                ppm = ppm_fallback
                ppm_source = "fallback_linear_after_plausibility_fail"
                ppm_ok = True
                ppm_reason = "fallback_ok"
                self.warnings.append("Primary ppm axis implausible; fallback axis applied.")
                self.log("ppm_axis_fallback", True, "fallback after plausibility fail")
            else:
                axis_type = "ppm_uncertain"
                meta_low = True
                self.warnings.append(f"AXIS_UNCERTAIN: {ppm_reason}; fallback also failed: {fallback_reason}")
                self.log("ppm_plausibility", False, f"primary={ppm_reason} fallback={fallback_reason}")
        else:
            self.log("ppm_plausibility", True, ppm_reason)

        # reference / solvent
        solvent_hint = None
        if vendor == VENDOR_BRUKER:
            try:
                acqus = dic.get("acqus", {})
                if isinstance(acqus, dict):
                    solvent_hint = acqus.get("SOLVENT") or acqus.get("#SOLVENT")
            except Exception:
                solvent_hint = None
        elif vendor == VENDOR_VARIAN:
            try:
                procpar = dic.get("procpar", {})
                if isinstance(procpar, dict) and "solvent" in procpar:
                    vals = procpar["solvent"].get("values", [])
                    if vals:
                        solvent_hint = str(vals[0])
            except Exception:
                solvent_hint = None

        ppm_raw_axis = np.asarray(ppm, dtype=np.float64).copy()

        if self.reference_method == "manual":
            ppm = ppm + float(self.reference_target_ppm)
            ref_shift = float(self.reference_target_ppm)
            ref_status = f"manual:applied:{ref_shift:.4f}"
            solvent_normalized = None
        elif self.reference_method == "tms":
            ppm, ref_shift, ref_status, solvent_normalized = solvent_auto_ref(
                ppm, y_corr, "TMS"
            )
            ref_status = f"tms:{ref_status}"
        else:
            ref_solvent = self.reference_solvent or solvent_hint
            if ppm_source == "varian_procpar_sp_wp_sfrq":
                # Procpar processed window is authoritative for Varian datasets.
                # Allow only small, high-confidence solvent micro-corrections.
                ppm_before_ref = ppm.copy()
                ppm_try, shift_try, status_try, solvent_try = solvent_auto_ref(ppm, y_corr, ref_solvent)
                if status_try.startswith("solvent:") and "applied" in status_try and abs(float(shift_try)) <= 0.2:
                    ppm, ref_shift, ref_status, solvent_normalized = ppm_try, float(shift_try), status_try, solvent_try
                else:
                    ppm = ppm_before_ref
                    ref_shift = 0.0
                    solvent_normalized = _resolve_solvent_key(ref_solvent)
                    ref_status = f"procpar_authoritative_no_auto_lock:{status_try}"
            else:
                ppm, ref_shift, ref_status, solvent_normalized = solvent_auto_ref(ppm, y_corr, ref_solvent)

        self.log("reference_calibration", True, ref_status)

        # sanitize signal presence
        snr = estimate_snr(y_corr)
        scale = float(np.max(np.abs(y_corr))) if len(y_corr) else 1.0
        if scale < 1e-12:
            scale = 1.0
        y_display = (y_corr / scale).astype(np.float64)
        abs_y = np.abs(y_display)
        signal_p99 = float(np.percentile(abs_y, 99)) if len(abs_y) else 0.0
        has_signal = bool(signal_p99 > 1e-6 and np.max(abs_y) > 1e-6)
        if not has_signal:
            self.warnings.append("FLAT_SIGNAL: Processed spectrum has no meaningful dynamic range.")
            self.log("signal_content_check", False, f"p99={signal_p99:.2e}")
        else:
            self.log("signal_content_check", True, f"p99={signal_p99:.2e}")

        qc_status = overall_qc_status(phase_q, snr, ppm_ok, has_signal, meta_low)

        # display contract: canonical output descending for NMR display
        order_desc = np.argsort(-ppm)
        ppm_desc = sanitize_floats(ppm[order_desc])
        y_desc = sanitize_floats(y_display[order_desc])
        ppm_raw_desc = sanitize_floats(ppm_raw_axis[order_desc])
        y_raw_desc = sanitize_floats(y_corr[order_desc])
        baseline_desc = sanitize_floats((baseline / scale)[order_desc])
        peaks = pick_peaks(ppm_desc, np.asarray(y_desc, dtype=np.float64))
        chart_contract = build_chart_contract(ppm_desc, y_desc, nucleus)

        meta = ProcessingMeta(
            vendor=vendor,
            source_format=source_format or "unknown",
            dataset_dir=dataset_dir,
            nucleus=nucleus,
            dimension=1,
            spectrometer_freq_mhz=obs_mhz,
            spectral_width_hz=sw_hz,
            spectral_width_ppm=(sw_hz / obs_mhz if obs_mhz > 0 else 0.0),
            carrier_hz=car_hz,
            carrier_ppm=car_ppm,
            raw_fid_points=raw_points,
            processed_points=len(y_corr),
            axis_type=axis_type,
            ppm_source=ppm_source,
            display_direction="descending",
            default_display_range_ppm=chart_contract["default_display_range_ppm"],
            default_wide_range_ppm=chart_contract["default_wide_range_ppm"],
            solvent_hint=str(solvent_hint) if solvent_hint is not None else None,
            solvent_normalized=solvent_normalized,
            reference_mode=ref_status,
            reference_offset_ppm_applied=round(float(ref_shift), 6),
            metadata_confidence="low" if meta_low else "normal",
            actual_ppm_range=[float(min(ppm_desc)) if ppm_desc else 0.0, float(max(ppm_desc)) if ppm_desc else 0.0],
        )

        return {
            "ok": True,
            "metadata": asdict(meta),
            "ppm": ppm_desc,
            "intensity": y_desc,
            "ppm_axis_raw": ppm_raw_desc,
            "ppm_axis_referenced": ppm_desc,
            "intensity_raw": y_raw_desc,
            "intensity_processed": y_desc,
            "baseline": baseline_desc,
            "intensity_scale_mode": "global_max",
            "intensity_raw_max_scale": float(scale),
            "peaks": peaks,
            "warnings": self.warnings,
            "processing": {
                "vendor": vendor,
                "group_delay_corrected": group_delay_corrected,
                "digital_filter": digital_filter_status,
                "dc_removed": True,
                # Phase-1 authoritative contract fields
                "apodization_declared": True,
                "apodization": {"lb_hz": float(self.lb_hz), "applied": self.lb_hz > 0},
                "zero_fill_factor": float(self.zf_factor),
                "zero_fill": {"factor": float(self.zf_factor), "applied": self.zf_factor > 1.0},
                "fft_applied": True,
                "phase_method": phase_method,
                "baseline_method": baseline_method,
                "reference_standard": solvent_normalized or "auto",
                "processing_order": [
                    "digital_filter_correction",
                    "apodization",
                    "zero_filling",
                    "fourier_transform",
                    "phase_correction",
                    "baseline_correction",
                    "referencing",
                    "peak_picking",
                    "qc",
                ],
                "phase": {
                    "ph0_deg": round(float(ph0), 6),
                    "ph1_deg": round(float(ph1), 6),
                    "method": phase_method,
                    "mode": self.phase_mode,
                    "quality_score": round(float(phase_q), 8),
                    "manual_applied": self.manual_ph0 is not None and self.manual_ph1 is not None,
                },
                "baseline": {
                    "method": baseline_method,
                    "applied": True,
                    "sigma_lowess": round(float(baseline_sigma), 8) if baseline_sigma is not None else None,
                    "A_penalty": round(float(baseline_A), 8) if baseline_A is not None else None,
                    "B_penalty": round(float(baseline_B), 8) if baseline_B is not None else None,
                    "paper_ref": "Xi_Rocke_2008_BMC_Bioinformatics_9_324" if baseline_method == "xi_rocke_ps" else None,
                },
                "reference": {
                    "status": ref_status,
                    "method": self.reference_method,
                    "target_ppm": round(float(self.reference_target_ppm), 6),
                    "offset_ppm_applied": round(float(ref_shift), 6),
                    "confidence": "high" if abs(ref_shift) <= 0.2 else "medium" if abs(ref_shift) <= 0.5 else "low",
                    "standard": solvent_normalized or ("TMS" if self.reference_method == "tms" else "manual"),
                    "solvent_hint": solvent_hint,
                    "solvent_normalized": solvent_normalized or self.reference_solvent,
                },
                "display_contract": chart_contract,
            },
            "qc": {
                "overall_status": qc_status,
                "phase_neg_energy_ratio": round(float(phase_q), 8),
                "snr_estimate": None if snr == float("inf") else round(float(snr), 4),
                "phase_failed_heuristic": bool(phase_q > 0.65),
                "baseline_uncertain": baseline_method in {"min_envelope", "min_envelope_fallback"},
                "has_meaningful_signal": has_signal,
                "ppm_axis_plausible": ppm_ok,
                "ppm_axis_reason": ppm_reason,
            },
            "integral_regions": [],
            "multiplet_regions": [],
            "processing_steps": [asdict(x) for x in self.logs],
            "display": chart_contract,
        }

    def _error(self, code: str, message: str) -> dict[str, Any]:
        return {
            "ok": False,
            "error": code,
            "message": message,
            "processing_steps": [asdict(x) for x in self.logs],
            "warnings": self.warnings,
        }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="SpectroMind production-oriented 1D FID processor")
    p.add_argument("--baseDir", required=True, help="dataset directory or file path")
    p.add_argument("--datasetType", default="auto", choices=["auto", "bruker", "varian", "jeol"])
    p.add_argument("--lb", type=float, default=0.3, help="line broadening in Hz")
    p.add_argument("--zf", type=float, default=2.0, help="zero-fill factor")
    p.add_argument(
        "--phase_method",
        type=str,
        default="auto_entropy",
        choices=["auto_entropy", "regions_analysis", "manual_ph0_ph1"],
        help="phase correction mode",
    )
    p.add_argument(
        "--baseline_method",
        type=str,
        default="xi_rocke_ps",
        choices=["xi_rocke_ps", "asls", "min_envelope"],
        help="baseline correction algorithm",
    )
    p.add_argument(
        "--reference_method",
        type=str,
        default="solvent",
        choices=["solvent", "manual", "tms"],
        help="reference lock strategy",
    )
    p.add_argument("--reference_target_ppm", type=float, default=0.0, help="manual reference offset ppm")
    p.add_argument("--reference_solvent", type=str, default="", help="reference solvent override")
    p.add_argument("--ph0", type=float, default=float("nan"), help="manual zero-order phase in degrees")
    p.add_argument("--ph1", type=float, default=float("nan"), help="manual first-order phase in degrees")
    return p


def main() -> int:
    args = build_arg_parser().parse_args()
    manual_ph0 = None if np.isnan(args.ph0) else float(args.ph0)
    manual_ph1 = None if np.isnan(args.ph1) else float(args.ph1)
    if (manual_ph0 is None) ^ (manual_ph1 is None):
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "INVALID_PHASE_ARGS",
                    "message": "Provide both --ph0 and --ph1 for manual phase, or neither for auto phase",
                },
                default=_json_default,
            )
        )
        return 1

    try:
        pipeline = FIDProcessPipeline(
            base_dir=args.baseDir,
            dataset_type=args.datasetType,
            lb_hz=args.lb,
            zf_factor=args.zf,
            manual_ph0=manual_ph0,
            manual_ph1=manual_ph1,
            phase_mode=args.phase_method,
            baseline_method=args.baseline_method,
            reference_method=args.reference_method,
            reference_target_ppm=args.reference_target_ppm,
            reference_solvent=args.reference_solvent or None,
        )
        result = pipeline.run()
        print(json.dumps(result, default=_json_default, ensure_ascii=False))
        return 0 if result.get("ok") else 1
    except Exception as exc:
        tb = traceback.format_exc()
        sys.stderr.write(f"[fid_process] FATAL\n{tb}\n")
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "UNHANDLED_EXCEPTION",
                    "message": str(exc)[:500],
                },
                default=_json_default,
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
