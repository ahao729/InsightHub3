# InsightHub Crawler — Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy crawler source
COPY . .

# Default: run scheduler in dev mode (override in docker-compose)
CMD ["python", "crawl_scheduler.py", "--all", "--dev"]
