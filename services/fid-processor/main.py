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
    format: str = Form("auto"),
    processingSpec: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
):
    """
    Process FID dataset.

    Accepts:
    - Single file upload (fid/ser) via 'dataset'
    - Or must be preceded by /upload-fid to stage dataset on server

    Returns JSON with ppm, intensity, metadata, peaks, qc.
    """
    expected_key = os.environ.get("FID_PROCESSOR_API_KEY", "")
    if expected_key and api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    work_dir = None
    try:
        work_dir = tempfile.mkdtemp(prefix="fid_proc_")

        if dataset:
            # Single file mode
            safe_name = Path(dataset.filename or "fid").name
            input_path = os.path.join(work_dir, safe_name)
            content = await dataset.read()
            with open(input_path, "wb") as f:
                f.write(content)
        else:
            raise HTTPException(status_code=400, detail="No dataset file provided")

        # Run fid_process.py as subprocess (same interface as local dev)
        args = [
            sys.executable,
            FID_PROCESS_SCRIPT,
            "--baseDir",
            input_path,
            "--format",
            format,
        ]

        if processingSpec:
            args.extend(["--processingSpec", processingSpec])

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
