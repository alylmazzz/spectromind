# SpectroMind FID Processor — Production Service

Standalone FastAPI service for NMR FID processing using nmrglue.
Deploy alongside SpectroMind Vercel app.

## Quick Start

```bash
cd services/fid-processor
pip install -r requirements.txt
cp ../scripts/fid_process.py .   # or symlink
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker

```bash
docker build -t spectromind-fid-processor .
docker run -p 8000:8000 \
  -e FID_PROCESSOR_API_KEY=your-secret \
  spectromind-fid-processor
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /upload-fid | Stage FID folder dataset |
| POST | /process-fid | Process FID dataset |

## Vercel Integration

Set these environment variables in Vercel:

```
FID_PROCESSOR_URL=https://your-service.com
FID_PROCESSOR_API_KEY=your-secret
```

The SpectroMind API route auto-detects production and proxies to this service.

## Deploy Options

- **Railway**: `railway up` from this directory
- **Fly.io**: `fly launch` then `fly deploy`
- **Render**: Web Service from Dockerfile
- **Hetzner VPS**: Docker + nginx reverse proxy
