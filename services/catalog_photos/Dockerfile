# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgl1 libgomp1 libglib2.0-0 git && rm -rf /var/lib/apt/lists/*
COPY scripts/catalog/requirements*.txt scripts/catalog/
RUN --mount=type=secret,id=proxy_ca,target=/run/secrets/proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca SSL_CERT_FILE=/run/secrets/proxy_ca GIT_SSL_CAINFO=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.7.1 \
    && pip install --no-cache-dir -r scripts/catalog/requirements-photo-models.txt \
    && pip check \
    && python -c "import cv2, torch; from fashn_human_parser import FashnHumanParser; from rembg import new_session; assert torch.version.cuda is None; print('CATALOG_CPU_IMPORTS_VERIFIED')"
COPY scripts/catalog scripts/catalog
COPY lib/assets/default-garments.json lib/assets/default-garments.json
RUN useradd --create-home worker && mkdir -p /app/work /home/worker/.cache/fashionai/catalog && chown -R worker:worker /app/work /home/worker/.cache
ENV CATALOG_PHOTO_DEVICE=cpu CATALOG_PHOTO_MODEL_CACHE=/home/worker/.cache/fashionai/catalog OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
USER worker
ENTRYPOINT ["python", "-m", "scripts.catalog.prepare_photo_models", "--download", "--exec"]
CMD ["python", "-m", "scripts.catalog.process_photo_sets", "--apply", "--watch", "--audit", "/app/work/photo-sets-audit.jsonl"]
