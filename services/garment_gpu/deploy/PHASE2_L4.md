# Fase 2 na própria L4 (sem cota de A100)

Quando o Google ainda não libera uma segunda GPU (projeto novo, sem histórico de cobrança), a Fase 2 roda na
mesma `fai-gpu-1`, ao lado da Fase 1, com o Qwen-Image-Edit em **4 bits (NF4)**: ~40 GB → ~16 GB de VRAM, que
cabem na L4 de 24 GB junto com os 2 GB da Fase 1. Troca: um pouco de qualidade e de velocidade (estimativa de
30–60 s por imagem com o LoRA Lightning); o piloto confirma.

Não precisa de cota nova: continua sendo uma GPU. Quando a cota de A100 sair, siga `PHASE2_GCP.md`.

## 1. Mais memória RAM na VM (no seu Mac)
O carregamento e a quantização usam RAM; os 16 GB da `g2-standard-4` são pouco. A `g2-standard-8` (32 GB) tem a
mesma L4:
```bash
gcloud compute instances stop fai-gpu-1 --zone=us-west4-a
gcloud compute instances set-machine-type fai-gpu-1 --zone=us-west4-a --machine-type=g2-standard-8
gcloud compute instances start fai-gpu-1 --zone=us-west4-a
```
Os contêineres, o Tailscale e o Funnel voltam sozinhos.

## 2. Ligar o worker da Fase 2 (na `fai-gpu-1`)
```bash
cd ~/fashionai && git pull origin main && cd services/garment_gpu
cat >> .env <<'CFG'
RECON_QUANTIZE=nf4
RECON_OFFLOAD=model
RECON_LORA_PATH=lightx2v/Qwen-Image-Edit-2511-Lightning
RECON_LORA_WEIGHT_NAME=Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors
RECON_STEPS=8
RECON_TRUE_CFG=1.0
RECONSTRUCT_GPU=0
CFG
sudo docker compose --profile reconstruct up -d --build gpu-reconstruct
sudo docker compose logs -f gpu-reconstruct      # 1ª vez baixa ~60 GB; espere "modelos carregados"
nvidia-smi                                       # parado: Fase 2 quase sem VRAM; gerando: ~12–16 GB
```
Se o `.env` já tiver alguma dessas variáveis, edite a linha existente em vez de duplicar.

## 3. Testar
```bash
curl -s localhost:8000/v1/admin/queues -H "X-API-Key: $(sed -n 's/^ADMIN=//p' ~/fai-garment-keys.txt)"
```
Deve listar um worker `reconstruct`. Depois rode o piloto no Mac (`catalog_batch --limit 200`): fotos com modelo
passam a sair em flat lay, com as costas.

**Por que `RECON_OFFLOAD=model`:** em 4 bits os pesos somam ~17 GB. Carregados todos de uma vez na GPU, sobram
~3 GB ao lado da Fase 1, e a geração falha com `CUDA out of memory` (medido no primeiro teste). Com o offload, só o
componente em uso fica na GPU (codificador de texto, depois o transformer, depois o VAE); o resto espera na RAM
(por isso a `g2-standard-8`). Custa alguns segundos por imagem, para trocar os componentes de lugar.

Se ainda faltar memória: `RECON_BACK_VIEW=false` (sem vista de costas) ou `RECON_MAX_SIDE=768`, e recrie o
contêiner (`sudo docker compose --profile reconstruct up -d --force-recreate gpu-reconstruct`).
