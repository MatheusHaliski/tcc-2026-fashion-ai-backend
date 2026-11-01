# Fase 1 do catálogo no Mac (Apple Silicon, GPU via MPS)

A Fase 1 (Grounding DINO + SAM 2.1, ~3 GB) cabe na GPU de um MacBook Pro M3 Pro de 18 GB. A Fase 2 não cabe
(~58 GB em bf16; o 4 bits do bitsandbytes é só para NVIDIA): ela fica para a GPU alugada, que passa a receber
**só** as peças que precisam dela. Estimativa: ~3–6 s por foto → catálogo inteiro (14.321) em ~12–24 h, sem custo.

## 1. Instalar (uma vez, no Mac, na raiz do repositório)
```bash
cd ~/fashionai && git pull origin main
~/.venv-fai/bin/pip install -r services/garment_gpu/requirements-segment.txt -r services/garment_gpu/requirements-batch.txt torch torchvision
~/.venv-fai/bin/python -c "import torch; print('MPS:', torch.backends.mps.is_available())"   # MPS: True
```
Na primeira execução os pesos (~1 GB) são baixados para `~/.cache/huggingface`.

## 2. Testar com 20 produtos
```bash
cd ~/fashionai && set -a; source ~/fai-catalog.env; set +a
PYTORCH_ENABLE_MPS_FALLBACK=1 ~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_local \
  --limit 20 --out ~/catalog-fase1-teste
open ~/catalog-fase1-teste/index.html
```
Confira as miniaturas (recorte certo, sem corpo) e o `fotos/h` impresso.

## 3. Catálogo inteiro
```bash
caffeinate -i env PYTORCH_ENABLE_MPS_FALLBACK=1 ~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_local \
  --out ~/catalog-fase1
```
- `caffeinate -i` impede o Mac de dormir; deixe-o na tomada.
- Se parar (fechou a tampa, caiu a rede), rode **o mesmo comando**: ele pula o que já foi feito. Falhas de download
  são refeitas; recusas da Fase 1 (`REJECTED`) não.
- Recortes ~15–25 GB; com pouco disco, acrescente `--no-cutouts` (guarda só miniaturas e relatório).

Saídas em `~/catalog-fase1`: `audit.jsonl` (uma linha por produto), `index.html`, `summary.json`, `cutouts/` (fotos
de produto já prontas: classe `COMPLETE_PRODUCT`) e **`phase2_ids.txt`** (vestidas, ocluídas e cortadas).

## 4. Fase 2 só com a lista (GPU alugada)
```bash
~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_batch --ids-file ~/catalog-fase1/phase2_ids.txt \
  --limit 2000 --offset 0 --concurrency 2 --out ~/catalog-fase2/lote-0
```
Repita com `--offset 2000`, `4000`, … até o fim da lista. O servidor refaz a Fase 1 dessas fotos (~1 s cada, para
ter a máscara junto do job) e gera o flat lay.
