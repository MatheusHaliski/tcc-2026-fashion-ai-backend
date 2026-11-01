# Instalação da Fase 2 (Qwen-Image-Edit) no Google Cloud

A Fase 2 roda numa **segunda VM, com A100 80 GB**, que entra na mesma fila (Redis) e no mesmo armazenamento
(RustFS) da `fai-gpu-1`. A ligação é pelo Tailscale: nenhuma das duas VMs tem IP público.

```
fai-gpu-1 (L4)                         fai-gpu-a100 (A100 80 GB)
API · Redis · RustFS · worker Fase 1 ◀──Tailscale──▶ worker Fase 2 (Qwen-Image-Edit-2511 + Lightning 8 passos)
```

Custo: a VM cobra por hora ligada (~US$ 5/h sob demanda, ~US$ 1,5–2/h em spot, valores de referência). Ligue para
cada lote e desligue ao terminar: o disco e os pesos (~60 GB) ficam guardados.

## 1. Cotas (uma vez)
No console, IAM e administrador → Cotas, serviço **Compute Engine API**:
- `GPUs (all regions)` → **2** (a L4 já usa 1);
- `NVIDIA A100 80GB GPUs` na região onde vai criar → **1** (para spot: `Preemptible NVIDIA A100 80GB GPUs`).

## 2. No servidor central (`fai-gpu-1`)
```bash
cd ~/fashionai && git pull origin main && cd services/garment_gpu
./scripts/make_worker_env.sh          # abre Redis/RustFS para a rede privada e gera worker.env (sem imprimir segredos)
```

## 3. Criar a VM da Fase 2 (no seu Mac)
```bash
cd ~/fashionai && git pull origin main
./services/garment_gpu/scripts/gcp_reconstruct_vm.sh create          # ou SPOT=1 ... para pagar menos
gcloud compute scp --tunnel-through-iap --zone=us-west4-a fai-gpu-1:~/fashionai/services/garment_gpu/worker.env /tmp/worker.env
gcloud compute scp --tunnel-through-iap --zone="$(cat ~/.fai-gpu-a100.zone)" /tmp/worker.env fai-gpu-a100:~/worker.env
rm /tmp/worker.env
./services/garment_gpu/scripts/gcp_reconstruct_vm.sh ssh
```

## 4. Na VM da Fase 2
```bash
nvidia-smi                                                    # deve mostrar a A100 80GB
curl -fsSL https://get.docker.com | sudo sh
sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=fai-gpu-a100                     # abra o link e entre com a MESMA conta da fai-gpu-1
git clone https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend.git ~/fashionai
cd ~/fashionai/services/garment_gpu && mv ~/worker.env .env && chmod 600 .env
sudo WORKER_STAGE=reconstruct docker compose -f compose.worker.yaml up --build -d
sudo docker compose -f compose.worker.yaml logs -f gpu-worker  # 1ª vez baixa ~60 GB de pesos; espere "modelos carregados"
```

## 5. Testar
Na `fai-gpu-1`, com a chave admin, a fila deve listar um worker `reconstruct` com `gpu: NVIDIA A100-SXM4-80GB`:
```bash
curl -s localhost:8000/v1/admin/queues -H "X-API-Key: $(sed -n 's/^ADMIN=//p' ~/fai-garment-keys.txt)"
```
Depois rode o piloto de novo no Mac (`catalog_batch --limit 200`): agora fotos com modelo saem em flat lay.

## 6. Ao terminar
```bash
./services/garment_gpu/scripts/gcp_reconstruct_vm.sh stop     # no Mac; para religar: ... start
```
Sem a VM da Fase 2, o `mode=auto` devolve o recorte marcado `needs_reconstruction_unavailable` e o backend usa os
outros provedores; nada quebra.
