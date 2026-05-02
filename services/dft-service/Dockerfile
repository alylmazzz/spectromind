FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    make \
    gfortran \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install ASE (Atomic Simulation Environment)
RUN pip install ase

# Note: xTB and ORCA need to be installed separately
# For xTB: Download from https://github.com/grimme-lab/xtb
# For ORCA: Download from https://orcaforum.kofo.mpg.de/

# Copy service code
COPY . .

# Expose port
EXPOSE 8003

# Run service
CMD ["python", "main.py"]

