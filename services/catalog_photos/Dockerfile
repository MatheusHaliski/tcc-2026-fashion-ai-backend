FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY scripts/catalog/requirements*.txt scripts/catalog/
RUN pip install --no-cache-dir -r scripts/catalog/requirements-photo-pipeline.txt
COPY scripts/catalog scripts/catalog
COPY lib/assets/default-garments.json lib/assets/default-garments.json
RUN useradd --create-home worker && mkdir /app/work && chown worker:worker /app/work
USER worker
CMD ["python", "-m", "scripts.catalog.process_photo_sets", "--apply", "--watch", "--audit", "/app/work/photo-sets-audit.jsonl"]
