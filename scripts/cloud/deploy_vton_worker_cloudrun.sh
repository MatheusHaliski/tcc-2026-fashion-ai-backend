#!/usr/bin/env bash
# Worker de prova virtual (services/anatomical_vton) no Cloud Run, SEM chave de conta de serviço.
#
# Por quê: projetos com a política iam.disableServiceAccountKeyCreation não deixam criar o JSON que o Railway usaria.
# No Cloud Run a conta de serviço fica anexada ao serviço e o worker se autentica pelo servidor de metadados (ADC):
# nenhuma chave existe. O backend Java (Railway) chama o worker pela URL https do Cloud Run com o mesmo Bearer
# (VTON_WORKER_TOKEN), guardado no Secret Manager — o token não aparece na linha de comando nem no histórico.
#
# Uso (Cloud Shell, na raiz do repositório):
#   bash scripts/cloud/deploy_vton_worker_cloudrun.sh            # pede o token (o mesmo do Railway) sem mostrar na tela
#   bash scripts/cloud/deploy_vton_worker_cloudrun.sh --dry-run  # só mostra o que faria
#
# Variáveis opcionais: PROJECT, REGION (us-central1), SERVICE (fashionai-vton-worker), SA_NAME (fashionai-vton-worker),
# ENDPOINT_ID e DEDICATED_HOST (a réplica da GPU na Vertex).
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-fashionai-vton-worker}"
SA_NAME="${SA_NAME:-fashionai-vton-worker}"
ENDPOINT_ID="${ENDPOINT_ID:-8378820113129799680}"
DEDICATED_HOST="${DEDICATED_HOST:-8378820113129799680.us-central1-796635131232.prediction.vertexai.goog}"
SECRET="${SECRET:-vton-worker-token}"
REPO="${REPO:-fashionai-vton}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

[ -n "$PROJECT" ] || { echo "PROJECT vazio: rode gcloud config set project <id> ou PROJECT=<id> bash $0" >&2; exit 2; }
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$ROOT/services/anatomical_vton/deploy/railway/Dockerfile" ] || { echo "rode a partir do repositório (falta services/anatomical_vton)" >&2; exit 2; }
TAG="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/vton-worker:$TAG"

run() { echo "+ $*"; [ "$DRY" = 1 ] || "$@"; }

echo "projeto=$PROJECT região=$REGION serviço=$SERVICE conta=$SA imagem=$IMAGE"
run gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com aiplatform.googleapis.com --project="$PROJECT"

# conta de serviço com acesso à Vertex (idempotente)
if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  run gcloud iam service-accounts create "$SA_NAME" --project="$PROJECT" --display-name="FashionAI VTON worker"
  [ "$DRY" = 1 ] || sleep 30   # a conta nova leva alguns segundos para propagar
fi
run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="roles/aiplatform.user" --condition=None --quiet >/dev/null

# token do worker no Secret Manager (o mesmo valor de VTON_WORKER_TOKEN no Railway)
if [ "$DRY" = 0 ]; then
  if ! gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1 || [ "${ROTATE_TOKEN:-0}" = 1 ]; then
    printf 'Cole o VTON_WORKER_TOKEN do Railway (serviço vton-worker → Variables) e tecle Enter (não aparece na tela): '
    IFS= read -rs TOKEN; echo
    [ "${#TOKEN}" -ge 32 ] || { echo "token curto demais (esperado ≥ 32 caracteres)" >&2; exit 2; }
    if gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
      printf '%s' "$TOKEN" | gcloud secrets versions add "$SECRET" --project="$PROJECT" --data-file=- >/dev/null
    else
      printf '%s' "$TOKEN" | gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=automatic --data-file=- >/dev/null
    fi
    unset TOKEN
  fi
fi
run gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" --condition=None --quiet >/dev/null

# imagem: contexto mínimo (só o worker), sem mandar o repositório inteiro ao Cloud Build
gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1 || \
  run gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --project="$PROJECT"
CTX="$(mktemp -d)"; trap 'rm -rf "$CTX"' EXIT
mkdir -p "$CTX/services"
cp -R "$ROOT/services/anatomical_vton" "$CTX/services/"
rm -rf "$CTX/services/anatomical_vton/tests" "$CTX/services/anatomical_vton/__pycache__"
cp "$ROOT/services/anatomical_vton/deploy/railway/Dockerfile" "$CTX/Dockerfile"
# Em projetos novos o Cloud Build roda como a conta padrão do Compute Engine, que não ganha papéis sozinha (política
# iam.automaticIamGrantsForDefaultServiceAccounts): sem este papel o build falha com 403 ao ler o código enviado.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null || echo PROJECT_NUMBER)"
run gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder" --condition=None --quiet >/dev/null
for attempt in 1 2 3; do
  run gcloud builds submit "$CTX" --project="$PROJECT" --region="$REGION" --tag="$IMAGE" && break
  [ "$attempt" = 3 ] && exit 1
  echo "build falhou (um papel recém-concedido leva ~1 min para valer); nova tentativa em 60 s"; sleep 60
done

# serviço: conta anexada (sem chave), 1 instância no máximo (o catálogo do worker é local, como no Railway), e acesso
# público sem conceder allUsers (--no-invoker-iam-check: funciona mesmo com restrição de domínio); o Bearer protege.
run gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" --image="$IMAGE" \
  --service-account="$SA" --no-invoker-iam-check --port=8080 --cpu=1 --memory=1Gi --timeout=900 \
  --concurrency=4 --min-instances=0 --max-instances=1 \
  --set-env-vars="VTON_RENDER_PROVIDER=vertex_fashn,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=$REGION,VTON_VERTEX_TRYON_ENDPOINT_ID=$ENDPOINT_ID,VTON_VERTEX_TRYON_DEDICATED_HOST=$DEDICATED_HOST" \
  --set-secrets="VTON_WORKER_TOKEN=$SECRET:latest"

[ "$DRY" = 1 ] && exit 0
URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
echo "health: $(curl -fsS "$URL/health" || echo FALHOU)"
echo
echo "WORKER_URL=$URL"
echo "Próximo passo: no Railway, serviço api → Variables → VTON_WORKER_URL=$URL (o VTON_WORKER_TOKEN continua o mesmo)."
