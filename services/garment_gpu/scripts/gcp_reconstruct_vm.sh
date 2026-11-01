#!/usr/bin/env bash
# VM da Fase 2 (Qwen-Image-Edit) no Google Cloud: A100 80 GB, sem IP público (Cloud NAT + SSH pelo IAP).
#   ./gcp_reconstruct_vm.sh create        # procura uma zona com A100 80 GB livre e cria a VM
#   SPOT=1 ./gcp_reconstruct_vm.sh create # instância spot: ~60–70% mais barata, pode ser interrompida
#   ./gcp_reconstruct_vm.sh start|stop|status|ssh
# A VM cobra por hora enquanto estiver ligada: use "stop" ao terminar cada lote (o disco e os pesos ficam).
set -u
NAME="${NAME:-fai-gpu-a100}"
MACHINE="${MACHINE:-a2-ultragpu-1g}"            # 1× A100 80 GB, 12 vCPU, 170 GB RAM
IMAGE_FAMILY="${IMAGE_FAMILY:-common-cu129-ubuntu-2204-nvidia-580}"
REGIONS="${REGIONS:-us-central1 us-east4 us-east5 us-west1 europe-west4 asia-southeast1}"
STATE="$HOME/.fai-gpu-a100.zone"

zone() { [ -f "$STATE" ] && cat "$STATE" || { echo "VM ainda não criada (rode: $0 create)" >&2; exit 2; }; }

ensure_nat() {
  local region="$1"
  [ -n "$(gcloud compute routers list --regions="$region" --format='value(name)' 2>/dev/null)" ] && return 0
  echo ">>> criando Cloud NAT em $region (a VM não tem IP público)"
  gcloud compute routers create "fai-router-$region" --network=default --region="$region" --quiet
  gcloud compute routers nats create "fai-nat-$region" --router="fai-router-$region" --region="$region" \
    --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges --quiet
}

create() {
  local spot=() zones z log=/tmp/fai_a100_create.log
  [ "${SPOT:-0}" = 1 ] && spot=(--provisioning-model=SPOT --instance-termination-action=STOP)
  zones=$(gcloud compute accelerator-types list --format="value(name,zone)" 2>/dev/null \
          | awk '$1=="nvidia-a100-80gb"{z=$2; sub(/.*\//,"",z); print z}' | sort -u)
  for region in $REGIONS; do
    for z in $(echo "$zones" | grep "^$region-"); do
      echo "== $z"
      if gcloud compute instances create "$NAME" --zone="$z" --machine-type="$MACHINE" \
          --image-project=deeplearning-platform-release --image-family="$IMAGE_FAMILY" \
          --boot-disk-size=300GB --boot-disk-type=pd-balanced --maintenance-policy=TERMINATE \
          --metadata=install-nvidia-driver=True --no-address "${spot[@]}" --quiet >"$log" 2>&1; then
        echo "$z" > "$STATE"
        ensure_nat "$region"
        echo ">>> VM criada em $z. Entre com: $0 ssh"
        return 0
      fi
      grep -E "message:|Quota" "$log" | head -1 | sed 's/^ */   /'
    done
  done
  echo ">>> nenhuma zona com A100 80 GB disponível agora (ou falta cota). Cole a saída na conversa."
  return 1
}

case "${1:-}" in
  create) create ;;
  start) gcloud compute instances start "$NAME" --zone="$(zone)" ;;
  stop) gcloud compute instances stop "$NAME" --zone="$(zone)" ;;
  status) gcloud compute instances describe "$NAME" --zone="$(zone)" --format="value(status,machineType.basename())" ;;
  ssh) gcloud compute ssh "$NAME" --zone="$(zone)" --tunnel-through-iap ;;
  *) echo "uso: $0 create|start|stop|status|ssh"; exit 2 ;;
esac
