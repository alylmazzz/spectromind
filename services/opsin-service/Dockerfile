FROM python:3.11-slim

WORKDIR /app

# Install Java (required for OPSIN)
RUN apt-get update && apt-get install -y \
    openjdk-17-jre \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8001

# Run application
CMD ["python", "main.py"]

