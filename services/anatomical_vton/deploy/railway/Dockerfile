# Worker CPU da prova virtual (services/anatomical_vton/api.py) para o Railway.
# Não roda modelo: recebe a peça e a foto do backend Java e chama a GPU na Vertex AI (VTON_RENDER_PROVIDER=vertex_fashn).
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app VTON_ARTIFACT_DIR=/tmp/vton-artifacts \
    VTON_DATABASE_URL=sqlite:////tmp/vton-catalog.sqlite
COPY services/anatomical_vton/requirements.txt services/anatomical_vton/requirements-google-cloud.txt /app/services/anatomical_vton/
RUN python -m pip install --no-cache-dir -r /app/services/anatomical_vton/requirements-google-cloud.txt
COPY services/anatomical_vton /app/services/anatomical_vton
RUN rm -rf /app/services/anatomical_vton/tests && useradd --uid 10001 --create-home vton
USER 10001:10001
CMD ["sh", "/app/services/anatomical_vton/deploy/railway/start.sh"]
