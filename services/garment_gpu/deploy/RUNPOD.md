# Fase 2 do catálogo numa A100 do RunPod

Decisão de 01/11/2026: a Fase 1 do catálogo inteiro roda no Mac (`MAC_PHASE1.md`) e gera `phase2_ids.txt`. O RunPod
recebe **só essa lista**. Orçamento: ~US$ 100 de crédito pré-pago, dos quais ~US$ 70 para a Fase 2 (~45–50 h de A100).

Pod do RunPod é um contêiner **sem Docker dentro**: o `compose.yaml` não roda. O `scripts/runpod_start.sh` faz o papel
dele, com processos no próprio pod:

```
Mac (catalog_batch) ──HTTPS──▶ https://<pod-id>-8000.proxy.runpod.net ──▶ API (uvicorn :8000)
                                                                            │ 127.0.0.1
                                     Redis :6379 · RustFS :9000 · worker Fase 1 · worker Fase 2 (A100 80 GB, bf16)
Network volume (/workspace): venv-fai, hf (pesos ~60 GB), redis, rustfs, logs, fashionai (o repositório)
```

**Onde roda cada comando:** 🖥️ **Mac** (prompt `Matheuss-MacBook-Pro`), 🟣 **pod** (terminal web do RunPod, prompt
`root@<id>:/#`) ou 🌐 **painel** (runpod.io no navegador). Nunca cole segredo no chat: os valores vão do seu arquivo
para o painel do RunPod pela área de transferência (`pbcopy`).

## 1. Network volume (🌐 painel, uma vez)
**Storage → Network Volumes → New Network Volume**: 150 GB, num datacenter do **Secure Cloud** que liste
**A100 80GB** disponível (o volume prende o pod a esse datacenter). Custa ~US$ 0,07/GB/mês = ~US$ 10,50/mês,
ligado ou não, até ser apagado (passo 10).

## 2. Segredos (🖥️ Mac → 🌐 painel, uma vez)
No painel, **Settings → Secrets → Create Secret**, um por linha da tabela. O nome do segredo é livre; use estes para
casar com o passo 3. Cada comando abaixo copia o valor para a área de transferência sem mostrá-lo; cole no campo
*Secret Value* do painel.

| Segredo no RunPod | Valor | Como copiar (🖥️ Mac) |
|---|---|---|
| `fai_api_keys` | a **mesma** linha `FAI_API_KEYS` do `.env` da VM (só SHA-256): o Railway e o Mac continuam com as mesmas chaves | ver abaixo |
| `fai_redis_password` | novo (o Redis agora é local ao pod) | `openssl rand -hex 32 \| tr -d '\n' \| pbcopy` |
| `fai_s3_access_key` | novo | `echo -n fai-s3-$(openssl rand -hex 4) \| pbcopy` |
| `fai_s3_secret_key` | novo | `openssl rand -hex 32 \| tr -d '\n' \| pbcopy` |

`FAI_API_KEYS` e o arquivo das chaves em texto puro (`ADMIN=...`, para consultar as filas do Mac) estão na VM da GCP.
Ligue-a só para copiar (alguns centavos) e desligue em seguida:
```bash
gcloud compute instances start fai-gpu-1 --zone=us-east4-c
```
```bash
gcloud compute ssh fai-gpu-1 --zone=us-east4-c --tunnel-through-iap --command "sed -n 's/^FAI_API_KEYS=//p' ~/fashionai/services/garment_gpu/.env | tr -d '\"\n'" | pbcopy
```
```bash
gcloud compute scp --tunnel-through-iap --zone=us-east4-c fai-gpu-1:~/fai-garment-keys.txt ~/fai-garment-keys.txt && chmod 600 ~/fai-garment-keys.txt
```
```bash
gcloud compute instances stop fai-gpu-1 --zone=us-east4-c
```

## 3. Template do pod (🌐 painel, uma vez)
**My Templates → New Template**, a partir do **RunPod PyTorch** (CUDA 12.x). Um template salvo deixa cada pod novo a
um clique, com as mesmas variáveis, o que importa porque o pod é recriado várias vezes (passos 7 e 9).
- **Container disk:** 30 GB (apaga ao parar; nada importante fica nele). **Volume mount path:** `/workspace`.
- **Expose HTTP ports:** acrescente `8000` aos que o template já tem. **TCP:** só `22` (SSH), se quiser.
- **Environment variables** (o valor entre chaves é resolvido pelo RunPod; não aparece no template):

| Variável | Valor |
|---|---|
| `FAI_API_KEYS` | `{{ RUNPOD_SECRET_fai_api_keys }}` |
| `REDIS_PASSWORD` | `{{ RUNPOD_SECRET_fai_redis_password }}` |
| `S3_ACCESS_KEY` | `{{ RUNPOD_SECRET_fai_s3_access_key }}` |
| `S3_SECRET_KEY` | `{{ RUNPOD_SECRET_fai_s3_secret_key }}` |

Os demais valores já têm padrão no `runpod_env.py`: `RECON_QUANTIZE=none`, `RECON_OFFLOAD=none`, LoRA Lightning
8 passos, `RECON_TRUE_CFG=1.0`, **`RECON_MAX_ATTEMPTS=1`**, `RECON_BACK_VIEW=true`, `RECON_MAX_SIDE=1024`,
`METRICS_PUBLIC=false`, `HF_HOME=/workspace/hf`. Só acrescente uma variável no template para mudar um padrão.

## 4. Criar o pod (🌐 painel)
**Pods → Deploy**: **Secure Cloud** (fotos com pessoas, LGPD), **A100 80GB** (SXM ou PCIe), **1 GPU**, **On-Demand**
(nunca *Spot/Interruptible*: a interrupção perde o lote em andamento), o network volume do passo 1 e o template do
passo 3. Anote o preço por hora mostrado no resumo: ele entra nas projeções (`PRECO_HORA`).

## 5. Subir o serviço (🟣 pod)
**Connect → Web Terminal** (ou SSH). Primeira vez:
```bash
cd /workspace && git clone https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend.git fashionai
```
```bash
bash /workspace/fashionai/services/garment_gpu/scripts/runpod_start.sh
```
Na primeira subida o script instala o redis-server, baixa o RustFS 1.0.4 (SHA-256 conferido), cria a venv no volume
(~5–10 min, uma vez só; log em `/workspace/logs/install.log`) e os workers baixam os pesos (~60 GB, ~10–20 min):
```bash
tail -f /workspace/logs/reconstruct.log     # espere "modelos carregados" com 'scheduler': 'lightning'
```
Em todo pod novo (o volume já tem venv e pesos, sobe em ~2 min):
```bash
cd /workspace/fashionai && git pull origin main && bash services/garment_gpu/scripts/runpod_start.sh
```
Outros comandos: `runpod_start.sh status` (processos, GPU, disco, últimos jobs), `stop`, `restart`. Logs em
`/workspace/logs/{redis,storage,api,segment,reconstruct}.log`. Processo que cai é reiniciado sozinho; fechar o
terminal web não derruba nada. Variável faltando ou inválida: o script para e diz **o nome** dela.

## 6. Apontar o Mac (e o Railway) para o pod
A URL é `https://<pod-id>-8000.proxy.runpod.net` (o script imprime; o id está no painel). Ela muda a cada pod novo.
🖥️ Mac:
```bash
sed -i '' "s#^FAI_API_URL=.*#FAI_API_URL=https://<pod-id>-8000.proxy.runpod.net#" ~/fai-catalog.env
```
```bash
set -a; source ~/fai-catalog.env; set +a; curl -s "$FAI_API_URL/v1/admin/queues" -H "X-API-Key: $(sed -n 's/^ADMIN=//p' ~/fai-garment-keys.txt)"
```
Devem aparecer um worker `segment` e um `reconstruct` com `gpu: NVIDIA A100...`. 🌐 **Railway** (opcional, só se o
app precisar da GPU durante o lote): `GARMENT_GPU_URL` = a URL do pod; a chave não muda. Com o pod desligado o
backend cai para os outros provedores. Ao terminar, volte a URL antiga ou apague a variável.

## 7. Portão 1: 10 fotos da lista e medição (🖥️ Mac, depois 🟣 pod)
```bash
cd ~/fashionai && set -a; source ~/fai-catalog.env; set +a && ~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_batch \
  --ids-file ~/catalog-fase1/phase2_ids.txt --limit 10 --concurrency 2 --out ~/catalog-fase2/teste-10
```
Sem a lista da Fase 1 (`phase2_ids.txt`), teste com a amostra fixa do catálogo: `--limit 20` sem `--ids-file` (o
servidor decide a Fase 2 sozinho). A amostra é determinística, então repetir os mesmos 20 compara antes e depois de
uma correção. O `audit.jsonl` e o `summary.json` só ficam completos quando o lote termina: espere o `relatório:` final.

🟣 Tempo real por imagem (cada job da Fase 2 gera frente + costas):
```bash
grep -o 'job in [0-9:.]*s on' /workspace/logs/reconstruct.log | tail -n 10 | awk '{split($3,t,":"); sub(/s$/,"",t[3]); s+=t[1]*3600+t[2]*60+t[3]; n++} END {if (n) printf "%d jobs: %.1f s/job = %.1f s/imagem\n", n, s/n, s/n/2}'
```
Projeção: `custo_fase2 = imagens_restantes × s_por_imagem / 3600 × PRECO_HORA` (~16.200 imagens com costas). Cole a
saída e as miniaturas na conversa. Frente em `cutouts/`, costas em `backs/` (miniaturas `*-back.jpg` no `index.html`). **Primeiro**: confirmar que o flat lay saiu limpo (não ruído sobre a silhueta).

Se não couber no orçamento, em ordem, e só com a sua aprovação para o que reduz qualidade:
1. `RECON_MAX_ATTEMPTS=1` (já é o padrão);
2. primeira passada só de frente, `RECON_BACK_VIEW=false` (~8.100 imagens); costas depois, se sobrar crédito;
3. `RECON_MAX_SIDE=768` (~1,7× mais rápido, menos detalhe).

Para mudar um valor sem recriar o pod (🟣, vale até o pod parar; para ficar, ponha no template):
```bash
export RECON_BACK_VIEW=false && bash /workspace/fashionai/services/garment_gpu/scripts/runpod_start.sh restart
```

## 8. Portão 2: piloto de 200 e revisão com o pod desligado
```bash
~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_batch --ids-file ~/catalog-fase1/phase2_ids.txt \
  --limit 200 --offset 10 --concurrency 3 --gpu-hour-usd PRECO_HORA --out ~/catalog-fase2/piloto-200
```
Terminado, **pare ou encerre o pod** (🌐 *Stop* / *Terminate*) e revise `~/catalog-fase2/piloto-200/index.html` com
calma: com o pod parado só o volume cobra.

## 9. Lotes de 2.000
Pod novo com o mesmo template e volume (passo 4), `runpod_start.sh` (passo 5), URL nova no Mac (passo 6), e:
```bash
~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_batch --ids-file ~/catalog-fase1/phase2_ids.txt \
  --limit 2000 --offset 210 --concurrency 3 --gpu-hour-usd PRECO_HORA --out ~/catalog-fase2/lote-210
```
Próximos: `--offset 2210`, `4210`, … até o fim da lista. Entre um lote e outro, confira o saldo (🌐 **Billing**) e
refaça a projeção com o tempo medido.

## 10. Ao terminar (🌐 painel)
1. Confirme que as saídas estão no Mac (`~/catalog-fase2/*`). O pod não guarda nada que o Mac não tenha.
2. **Terminate** o pod e **apague o network volume** (Storage → Network Volumes → Delete): o volume cobra até ser
   apagado.
3. Apague os segredos `fai_*` (Settings → Secrets) e volte o `GARMENT_GPU_URL` do Railway, se mudou.

## Problemas conhecidos
| Sintoma | O que fazer |
|---|---|
| `configuração do pod incompleta` | o nome citado falta no template ou o segredo não existe (`{{ RUNPOD_SECRET_... }}` com nome errado) |
| `storage não respondeu` e erro de disco no `storage.log` | RustFS recusando o sistema de arquivos do volume: `export FAI_S3_DATA=/root/rustfs` e `restart` (dados do bucket no disco do contêiner; o lote já baixa e apaga cada job) |
| `CUDA out of memory` no `reconstruct.log` | confira se nada mais usa a GPU (`nvidia-smi`); a A100 80 GB comporta Fase 1 (~2 GB) + Fase 2 bf16 (~58 GB) |
| Pod parado não liga de novo (sem A100 livre) | crie um pod novo com o mesmo template e volume; tudo que importa está no volume |
| `pip install falhou` | veja `/workspace/logs/install.log`; apague `/workspace/venv-fai` e rode de novo |
