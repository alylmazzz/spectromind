"""
SpectroMind FID Processor — FastAPI production service.
Drop-in replacement for local scripts/fid_process.py.
Receives FID dataset via multipart, processes via nmrglue, returns JSON.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SpectroMind FID Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the fid_process.py script (mounted or copied alongside)
FID_PROCESS_SCRIPT = os.environ.get(
    "FID_PROCESS_SCRIPT",
    str(Path(__file__).resolve().parent / "fid_process.py"),
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "fid-processor"}


@app.post("/process-fid")
async def process_fid(
    dataset: UploadFile = File(None),
    files: list[UploadFile] = File(default_factory=list),
    paths: list[str] = Form(default_factory=list),
    format: str = Form("auto"),
    processingSpec: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
):
    """
    Process FID dataset.

    Accepts:
    - Single file via 'dataset' field
    - Multiple files + relative paths via 'files'/'paths' fields (folder upload)

    Returns JSON with ppm, intensity, metadata, peaks, qc.
    """
    expected_key = os.environ.get("FID_PROCESSOR_API_KEY", "")
    if expected_key and api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    work_dir = None
    try:
        work_dir = tempfile.mkdtemp(prefix="fid_proc_")

        # Folder upload mode: reconstruct directory structure
        if files:
            if len(files) != len(paths):
                return {
                    "success": False,
                    "error_code": "FID_PATH_MISMATCH",
                    "error_message": f"files={len(files)} paths={len(paths)} mismatch",
                }

            for file, rel_path in zip(files, paths):
                safe_rel = os.path.normpath(rel_path).lstrip("/\\")
                if safe_rel.startswith("..") or os.path.isabs(safe_rel):
                    continue
                target = os.path.join(work_dir, safe_rel)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                content = await file.read()
                with open(target, "wb") as f:
                    f.write(content)

            # Recursively find raw FID file and dataset root
            fid_path, dataset_root, vendor = _find_dataset_root(work_dir)
            if not fid_path:
                return {
                    "success": False,
                    "error_code": "FID_RAW_FILE_NOT_FOUND",
                    "error_message": "Klasörde 'fid' veya 'ser' ham veri dosyası bulunamadı.",
                    "received_files": len(files),
                    "received_filenames": [p for _, p in zip(files[:20], paths[:20])],
                    "searched_root": work_dir,
                }
            input_path = dataset_root
            if format == "auto" and vendor:
                format = vendor
        elif dataset:
            safe_name = Path(dataset.filename or "fid").name
            input_path = os.path.join(work_dir, safe_name)
            content = await dataset.read()
            with open(input_path, "wb") as f:
                f.write(content)
        else:
            return {
                "success": False,
                "error_code": "FID_NO_DATASET_FILE",
                "error_message": "No dataset file provided",
            }

        # Run fid_process.py as subprocess (same interface as local dev)
        args = [
            sys.executable,
            FID_PROCESS_SCRIPT,
            "--baseDir",
            input_path,
            "--datasetType",
            format,
        ]

        if processingSpec:
            try:
                spec = json.loads(processingSpec)
            except json.JSONDecodeError:
                spec = {}
            apo = spec.get("apodization", {})
            if isinstance(apo, dict) and "lb_hz" in apo:
                args.extend(["--lb", str(apo["lb_hz"])])
            zf = spec.get("zeroFill", {})
            if isinstance(zf, dict) and "factor" in zf:
                args.extend(["--zf", str(zf["factor"])])
            phase = spec.get("phase", {})
            if isinstance(phase, dict):
                mode = phase.get("mode", "")
                if mode in ("auto_entropy", "regions_analysis", "manual_ph0_ph1"):
                    args.extend(["--phase_method", mode])
                if mode == "manual_ph0_ph1":
                    if "ph0_deg" in phase:
                        args.extend(["--ph0", str(phase["ph0_deg"])])
                    if "ph1_deg" in phase:
                        args.extend(["--ph1", str(phase["ph1_deg"])])
            baseline = spec.get("baseline", {})
            if isinstance(baseline, dict) and "algorithm" in baseline:
                args.extend(["--baseline_method", baseline["algorithm"]])
            reference = spec.get("reference", {})
            if isinstance(reference, dict):
                if "method" in reference:
                    args.extend(["--reference_method", reference["method"]])
                if "target_ppm" in reference:
                    args.extend(["--reference_target_ppm", str(reference["target_ppm"])])
                if "solvent" in reference:
                    args.extend(["--reference_solvent", reference["solvent"]])

        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=work_dir,
        )

        if result.returncode != 0:
            return {
                "success": False,
                "error_code": "FID_PROCESS_FAILED",
                "error_message": result.stderr[:2000] or "Unknown Python error",
                "stdout": result.stdout[:2000],
            }

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return {
                "success": False,
                "error_code": "FID_PARSE_OUTPUT_FAILED",
                "error_message": "Python processor returned invalid JSON",
                "raw_output": result.stdout[:2000],
            }

        data["success"] = True
        return data

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error_code": "FID_TIMEOUT",
            "error_message": "Processing timed out (120s limit)",
        }
    except Exception:
        return {
            "success": False,
            "error_code": "FID_API_INTERNAL",
            "error_message": traceback.format_exc()[-2000:],
        }
    finally:
        if work_dir and os.path.isdir(work_dir):
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception:
                pass


@app.post("/upload-fid")
async def upload_fid(
    files: list[UploadFile] = File(...),
    paths: list[str] = Form(...),
    api_key: Optional[str] = Form(None),
):
    """
    Stage FID dataset on server (folder upload).
    Returns datasetId for subsequent /process-fid call.
    """
    expected_key = os.environ.get("FID_PROCESSOR_API_KEY", "")
    if expected_key and api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    if len(files) != len(paths):
        raise HTTPException(status_code=400, detail="files and paths length mismatch")

    dataset_id = f"fid_{uuid.uuid4().hex[:12]}"
    base_dir = os.path.join(tempfile.gettempdir(), "spectromind", dataset_id)
    os.makedirs(base_dir, exist_ok=True)

    try:
        for file, rel_path in zip(files, paths):
            # Security: prevent path traversal
            safe_rel = os.path.normpath(rel_path).lstrip("/\\")
            if safe_rel.startswith("..") or os.path.isabs(safe_rel):
                raise HTTPException(status_code=400, detail=f"Invalid path: {rel_path}")

            target = os.path.join(base_dir, safe_rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            content = await file.read()
            with open(target, "wb") as f:
                f.write(content)

        return {
            "ok": True,
            "datasetId": dataset_id,
            "baseDir": base_dir,
            "fileCount": len(files),
        }
    except HTTPException:
        raise
    except Exception:
        shutil.rmtree(base_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Upload failed")


def _find_dataset_root(root_dir: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Recursively find raw FID file, dataset root directory, and vendor type.

    Returns: (fid_path, dataset_root, vendor) where vendor is 'bruker'/'varian'/None.
    """
    fid_path = None

    # Recursive walk: find first fid/ser file
    for dirpath, _, filenames in os.walk(root_dir):
        for name in filenames:
            if name.lower() in ("fid", "ser"):
                fid_path = os.path.join(dirpath, name)
                break
        if fid_path:
            break

    if not fid_path:
        return None, None, None

    # Determine dataset root: walk up from fid_path
    # Varian: directory containing both fid and procpar
    # Bruker: directory containing fid/ser and acqus/acqu
    dataset_root = os.path.dirname(fid_path)
    vendor = None

    # Check current directory and parents for vendor markers
    check_dir = dataset_root
    for _ in range(3):  # Check up to 3 levels up
        has_procpar = os.path.isfile(os.path.join(check_dir, "procpar"))
        has_acqus = os.path.isfile(os.path.join(check_dir, "acqus"))
        has_acqu = os.path.isfile(os.path.join(check_dir, "acqu"))

        if has_procpar:
            dataset_root = check_dir
            vendor = "varian"
            break
        if has_acqus or has_acqu:
            dataset_root = check_dir
            vendor = "bruker"
            break
        parent = os.path.dirname(check_dir)
        if parent == check_dir:
            break
        check_dir = parent

    return fid_path, dataset_root, vendor


def _find_raw_fid(root_dir: str) -> Optional[str]:
    """Recursively search for raw FID file (fid/ser) in directory tree."""
    for dirpath, _, filenames in os.walk(root_dir):
        for name in filenames:
            if name.lower() in ("fid", "ser"):
                return os.path.join(dirpath, name)
    # Also check root directly
    for name in ("fid", "ser"):
        p = os.path.join(root_dir, name)
        if os.path.isfile(p):
            return p
    return None


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
