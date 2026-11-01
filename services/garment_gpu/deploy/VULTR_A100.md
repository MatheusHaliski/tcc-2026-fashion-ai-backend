# Fases 1 e 2 numa A100 da Vultr

Decisão de 01/11/2026: a cota de A100 na GCP depende de aprovação (pedido anterior negado por o projeto ser
novo). A Vultr dá crédito para conta nova e aluga A100 sem pedido de cota. A pilha inteira (API, Redis, RustFS e os
workers das duas fases) muda para uma VM da Vultr; a VM da GCP fica parada como reserva.

```
Railway (backend Java) ──HTTPS (Tailscale Funnel)──▶ fai-gpu-vultr: API · Redis · RustFS · Fase 1 · Fase 2 (A100)
Mac (catalog_batch)    ──────────────────────────────▶
```

**Atenção à cobrança:** na Vultr, VM **desligada continua cobrando**. Para parar de pagar é preciso **destruí-la**
(passo 8). Planeje rodar o piloto e o catálogo em sequência e destruir ao terminar.

## 1. Criar a VM (painel da Vultr)
- **Products → Compute → Deploy → Cloud GPU**, modelo **NVIDIA A100** com a placa **inteira**. Evite as frações
  (A100 1/7, 1/3, 1/2): têm VRAM pequena demais para a Fase 2.
- VRAM: **80 GB** é o ideal (Fase 2 completa, sem quantização). Com **40 GB**, a Fase 2 roda em 4 bits (passo 4).
- Sistema: **Ubuntu 22.04** (se houver a opção com driver NVIDIA pré-instalado, prefira).
- Disco: **≥ 150 GB** (pesos ~60 GB, imagens Docker ~20 GB, folga para o armazenamento dos jobs).
- **SSH Keys:** adicione a chave pública do Mac (`cat ~/.ssh/id_ed25519.pub`; se não existir,
  `ssh-keygen -t ed25519`).
- **Firewall group:** só SSH (TCP 22) a partir do seu IP. Nada mais precisa ficar aberto: a API sai pelo Funnel.
- Hostname: `fai-gpu-vultr`. Confira no resumo o preço por hora e se o crédito cobre GPU.

## 2. Preparar o host (na VM: `ssh root@<IP da VM>`)
```bash
nvidia-smi || (apt-get update && apt-get install -y ubuntu-drivers-common && ubuntu-drivers autoinstall && reboot)
curl -fsSL https://get.docker.com | sh
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  > /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update && apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker && systemctl restart docker
ufw allow OpenSSH && ufw --force enable
git clone https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend.git ~/fashionai
```
Se o `nvidia-smi` falhou e a VM reiniciou, entre de novo e rode o bloco outra vez (o `nvidia-smi` passa).

## 3. Levar os segredos da GCP (no Mac, sem passar pelo chat)
Mesmas chaves de API: o backend no Railway continua com a mesma `GARMENT_GPU_API_KEY`. A VM da GCP precisa estar
ligada só para esta cópia.
```bash
gcloud compute scp --tunnel-through-iap --zone=us-east4-c fai-gpu-1:~/fashionai/services/garment_gpu/.env ~/fai-migr.env
gcloud compute scp --tunnel-through-iap --zone=us-east4-c fai-gpu-1:~/fai-garment-keys.txt ~/fai-migr-keys.txt
scp ~/fai-migr.env root@<IP da VM>:/root/fashionai/services/garment_gpu/.env
scp ~/fai-migr-keys.txt root@<IP da VM>:/root/fai-garment-keys.txt
rm ~/fai-migr.env ~/fai-migr-keys.txt
```

## 4. Configurar a Fase 2 para a placa (na VM)
```bash
cd ~/fashionai/services/garment_gpu && chmod 600 .env ~/fai-garment-keys.txt
VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
if [ "$VRAM" -ge 70000 ]; then SET="RECON_QUANTIZE=none RECON_OFFLOAD=none RECON_MAX_ATTEMPTS=2"
else SET="RECON_QUANTIZE=nf4 RECON_OFFLOAD=none RECON_MAX_ATTEMPTS=1"; fi
SET="$SET PRIVATE_BIND=127.0.0.1"   # VM com IP público: Redis e RustFS só no localhost (o Docker ignora o ufw)
for kv in $SET; do k=${kv%%=*}; grep -q "^$k=" .env && sed -i "s/^$k=.*/$kv/" .env || echo "$kv" >> .env; done
grep -E '^(RECON_|PRIVATE_BIND)' .env
```
80 GB: modelo completo em bf16 (~58 GB) ao lado da Fase 1. 40 GB: 4 bits (~17 GB) sem offload. Nos dois casos o
LoRA Lightning continua, com o agendador próprio.

## 5. Subir tudo
```bash
docker compose --profile reconstruct up -d --build
docker compose logs -f gpu-reconstruct        # 1ª vez baixa ~60 GB; espere "modelos carregados" com 'scheduler': 'lightning'
```

## 6. Publicar a API (Tailscale Funnel)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --hostname=fai-gpu-vultr          # abra o link e entre com a MESMA conta da tailnet
tailscale funnel --bg 8000
tailscale funnel status                        # URL nova: https://fai-gpu-vultr.<tailnet>.ts.net
curl -s localhost:8000/v1/admin/queues -H "X-API-Key: $(sed -n 's/^ADMIN=//p' ~/fai-garment-keys.txt)"
```
Os dois workers devem aparecer com a A100. Depois, troque a URL em dois lugares:
- **Railway:** `GARMENT_GPU_URL` = URL nova (a chave não muda);
- **Mac:** `FAI_API_URL` em `~/fai-catalog.env`.

## 7. Testar e rodar o catálogo (no Mac)
```bash
cd ~/fashionai && git pull origin main && set -a; source ~/fai-catalog.env; set +a
~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_batch --limit 10 --concurrency 1 --out ~/catalog-vultr-t1
```
Com o flat lay aprovado na revisão, rode o catálogo em lotes (`--limit 2000 --offset ...`).

## 8. Ao terminar
Na Vultr, desligar não para a cobrança. Para parar: **Destroy** a VM no painel (perde o disco: os pesos são
baixados de novo na próxima vez, ~10 min). Antes, baixe o que quiser guardar. Na GCP:
`gcloud compute instances stop fai-gpu-1 --zone=us-east4-c` (reserva parada, cobra só o disco).
