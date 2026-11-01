# FashionAI Garment GPU — segmentação e reconstrução de peças em GPU própria

Pipeline próprio de imagem de vestuário, **sem API de imagem de terceiros**: modelos de pesos abertos rodam em
servidores NVIDIA da equipe (RunPod, Google Cloud, Vertex/GCE ou máquina própria), atrás de uma API privada.

```
Backend Java (Spring)  ──X-API-Key──▶  API FastAPI (CPU) ──▶ Redis (filas RQ) ──▶ worker GPU de segmentação
  GarmentGpu*Adapter                    auth · cotas · jobs        fai-segment         Grounding DINO + SAM 2.1
                                              │                    fai-reconstruct ──▶ worker GPU generativo
                                              ▼                                        Qwen-Image-Edit + QA
                                        S3 (RustFS no compose, ou AWS/R2/GCS)  ◀── originais, máscaras, PNGs, metadata
```

| Etapa | Modelo | Licença | O que faz |
|---|---|---|---|
| Detecção | `IDEA-Research/grounding-dino-tiny` | Apache-2.0 | localiza camiseta, bermuda, tênis, acessório (texto → caixa) |
| Segmentação | `facebook/sam2.1-hiera-tiny` | Apache-2.0 | recorta só os pixels da peça (sem corpo nem fundo) |
| Reconstrução | `Qwen/Qwen-Image-Edit-2511` | Apache-2.0 | recria a peça inteira, frontal, em fundo branco de catálogo |

Cada job grava os ids exatos dos modelos usados (`segmentation.models`, `reconstruction.models`) e `GET /v1/models`
lista modelo, papel, licença e origem — rastreabilidade dos pesos. Depois do primeiro download (volume `hf-models`),
`HF_HUB_OFFLINE=1` garante que nenhuma chamada externa acontece.

## O que cada modo entrega

* **`mode=segment`** — recorte fiel: só pixels fotografados. Não inventa manga escondida nem remove braço sobreposto
  ao tecido. Saídas: `catalog` (PNG 1024×1536 centralizado, fundo branco ou transparente) ou `cutout` (mesmo quadro
  da foto, alfa — contrato do rembg).
* **`mode=reconstruct`** — segmenta e depois o Qwen-Image-Edit recebe o recorte (imagem 1) e a foto original
  (imagem 2, só como referência do que está escondido) e gera a foto de catálogo. O resultado é **reconstrução por
  IA**: sai marcado (`ai_generated`, cabeçalho `X-FAI-AI-Generated: true`), passa pelo QA automático e fica com
  `review.status=pending` até uma pessoa aprovar.

## Infraestrutura GPU

| GPU | Uso recomendado | Configuração |
|---|---|---|
| T4 16 GB | segmentação (testes) | worker `segment` |
| L4 24 GB | segmentação com folga | worker `segment`; reconstrução só com `RECON_OFFLOAD=sequential` (lenta) |
| L40S 48 GB | reconstrução | `RECON_OFFLOAD=model` |
| A100/H100 80 GB | reconstrução em produção | `RECON_OFFLOAD=none` |

Pod do RunPod (contêiner sem Docker): `scripts/runpod_start.sh` sobe Redis, RustFS, API e os dois workers como
processos vigiados, com venv, pesos e dados no network volume — guia em `deploy/RUNPOD.md`.

São pontos de partida, não garantias: meça VRAM/latência no seu hardware (DCGM no perfil `monitoring`). Os pesos do
Qwen-Image-Edit ocupam dezenas de GB em disco — reserve ≥ 80 GB livres.

## Instalação (servidor Linux com NVIDIA)

```bash
cd services/garment_gpu
cp .env.example .env                               # preencha REDIS_PASSWORD, S3_ACCESS_KEY, S3_SECRET_KEY (openssl rand -hex 32)
python3 -m services.garment_gpu.security fashionai-backend --scopes "submit|read"   # (na raiz do repositório)
#   → entregue a chave ao backend Java (GARMENT_GPU_API_KEY) e cole a entrada em FAI_API_KEYS no .env
./scripts/preflight.sh                             # driver, Docker, NVIDIA Container Toolkit, disco, .env
docker compose up --build -d                       # Fase 1: API + Redis + RustFS + worker de segmentação
docker compose --profile reconstruct up --build -d # Fase 2: + worker Qwen-Image-Edit
docker compose logs -f gpu-segment                 # 1ª subida baixa os pesos para o volume hf-models
FAI_API_KEY=<chave> ./scripts/smoke_api.sh camiseta.jpg upper_piece reconstruct
```

Preparação do host (uma vez): driver NVIDIA, Docker Engine e NVIDIA Container Toolkit; depois
`sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker`. Docker Desktop no macOS não
expõe CUDA; use o Mac como cliente. A API escuta só em `127.0.0.1:8000`; para expor, use o perfil `edge` (Caddy com
HTTPS automático, `DOMAIN` e `ALLOWED_CIDRS` no `.env`) ou um túnel `ssh -L 8000:127.0.0.1:8000`.

Sem GPU, valide pesos e a API do transformers antes de alugar uma máquina (segundos por foto em CPU):

```bash
pip install -r services/garment_gpu/requirements-segment.txt torch torchvision
FAI_DEVICE=cpu python -m services.garment_gpu.scripts.smoke_segment foto.jpg --category upper_piece --out work/smoke
```

## API

Autenticação: `X-API-Key: <chave>` (ou `Authorization: Bearer`). Escopos por chave: `submit`, `read`, `review`,
`admin`. Cada cliente só vê os próprios jobs (outro cliente recebe 404); `review` lê e revisa todos, sem excluir.

| Método | Caminho | Escopo | Descrição |
|---|---|---|---|
| POST | `/v1/garments` | submit | multipart: `image` (JPG/PNG/WEBP), `category` (`upper_piece`, `lower_piece`, `shoes_piece`, `accessory_piece`, `auto`), `mode` (`segment`/`reconstruct`), `background` (`white`/`transparent`), `framing` (`catalog`/`cutout`), `bbox` (`[x1,y1,x2,y2]` quando a detecção erra), `name`, `color` (dicas), `prompt` (substitui a descrição; a frase que proíbe inventar marcas é sempre mantida), `seed`. Resposta `202` com `job_id` |
| GET | `/v1/jobs/{id}` | read | `status` (`queued`, `segmenting`, `reconstructing`, `completed`, `failed`), `stage`, métricas, `quality`, `review`, eventos e `images` |
| GET | `/v1/jobs/{id}/image?variant=` | read | `final` (padrão), `segmented`, `reconstructed`, `mask`, `input` |
| POST | `/v1/jobs/{id}/review` | review | `{"decision": "approved" \| "rejected", "notes": "..."}` |
| DELETE | `/v1/jobs/{id}` | submit | apaga registro e imagens (direito de exclusão) |
| GET | `/v1/models` | read | modelos configurados, licenças e origem |
| GET | `/v1/admin/queues` | admin | filas, registros do RQ e workers com GPU/VRAM |
| GET | `/health`, `/ready`, `/metrics` | — | liveness, Redis+S3, Prometheus (o Caddy bloqueia `/ready` e `/metrics` de fora) |

Erros: `{"detail": {"code": "...", "message": "..."}}` — `UNAUTHORIZED` 401, `FORBIDDEN` 403, `INVALID_IMAGE` /
`INVALID_BBOX` 422, `TOO_LARGE` 413, `RATE_LIMITED` / `TOO_MANY_ACTIVE_JOBS` 429 (com `Retry-After`). Falhas de
foto ficam no job: `NO_GARMENT_DETECTED`, `INCONSISTENT_MASK` (refaça com `bbox` ou outra foto).

## QA automático e critérios de aprovação

Cada reconstrução é comparada com os pixels realmente fotografados (`quality.py`):

| Sinal | Como | Critério |
|---|---|---|
| Cor | ΔE (CIELAB) entre as 3 cores dominantes, ponderado | `> QA_MAX_DELTA_E` (10) → `COLOR_DRIFT`; `> 1,5×` → reprova |
| Distribuição de cor | interseção de histogramas a*/b* | entra na nota |
| Estrutura | SSIM do recorte × reconstrução normalizados | entra na nota |
| Silhueta | IoU das máscaras normalizadas | `< 0,35` → `SILHOUETTE_CHANGED` |
| Fundo | bordas brancas | `< 85%` → `BACKGROUND_NOT_CLEAN` |
| Pessoa restante | pele (YCbCr) a mais que no original | `> 8%` → reprova (`POSSIBLE_PERSON_LEFT`) |

Nota = 0,35·cor + 0,20·histograma + 0,20·SSIM + 0,15·IoU + 0,10·fundo. Veredito: `pass` (nota ≥ `QA_MIN_SCORE` e
sem alertas), `warn` ou `fail`. Sem `pass`, o worker tenta outra semente (`RECON_MAX_ATTEMPTS`) e guarda a melhor.
O QA **não certifica** escudos, logotipos, texto e costuras (`requires_human_review`): a decisão final é da revisão
humana (`POST /review`). Calibração inicial com fotos reais de pessoas vestindo a peça: mesma peça → `pass` com
ΔE 0,4–6,5; peça trocada → `fail`. Recalibre os limiares com o seu acervo.

## Fase 1 → Fase 2 (`mode=auto`)

A Fase 1 só preserva pixels reais: ela nunca transforma uma peça vestida em peça esticada. Com `mode=auto`, a API
segmenta, analisa o recorte (`analysis.py`) e decide sozinha:

* **foto de produto** (sem pessoa, peça inteira) → para na Fase 1: `output=flat_product`;
* **peça vestida, coberta por mão/braço ou cortada pela foto** → vai para a Fase 2, que gera a peça em *flat lay*
  (esticada sobre uma superfície, vista de cima, sem corpo nem manequim fantasma);
* sem worker da Fase 2 no ar → devolve o recorte com `output=needs_reconstruction_unavailable` (não é produto final).

Proteções da segmentação: o SAM gera três máscaras e fica com a que pertence à caixa do detector; máscara que
vaza da caixa (pernas sob shorts, cabelo sobre camisa) é recusada com `MASK_OUTSIDE_DETECTION` em vez de entregar o
corpo; buraco de pele dentro da peça (mão na frente) fica aberto para a Fase 2 repintar, em vez de colar a mão.

## Lote do catálogo (enquadramento full frame)

`catalog_batch` percorre o catálogo, manda cada foto para a GPU e guarda o recorte enquadrado. Ele **só lê** o MySQL
(as mesmas variáveis `MYSQL_*` do backend); nada é gravado no banco. Cada foto é classificada em:

| Classe | Significado | Precisa da Fase 2? |
|---|---|---|
| `COMPLETE_PRODUCT` | peça sozinha, completa | não |
| `COMPLETE_ON_MODEL` | modelo vestindo a peça: o recorte ainda tem forma de corpo | **sim** (tecido esticado) |
| `OCCLUDED` | braço ou mão na frente da peça | sim |
| `CUT` | a foto corta a peça na borda | sim |

```bash
pip install -r services/garment_gpu/requirements-batch.txt
export FAI_API_URL=https://… FAI_API_KEY=…            # chave com escopos submit|read
export MYSQL_HOST=… MYSQL_PORT=… MYSQL_DATABASE=… MYSQL_USER=… MYSQL_PASSWORD=… MYSQL_SSL_MODE=REQUIRED
python -m services.garment_gpu.scripts.catalog_batch --limit 200 --out work/catalog-pilot
```

A saída traz `index.html` (grade visual com original × recorte e as métricas de cada foto), `summary.json`,
`audit.jsonl` e os PNGs. O resumo projeta, para o catálogo inteiro, **quantas peças precisariam de reconstrução** —
que é o que define o custo da A100 — além das horas e do custo da segmentação (`--gpu-hour-usd`, `--workers`).

Rode primeiro um piloto (algumas centenas de produtos, a amostra é determinística), confira a grade e só então
processe tudo com `--offset` em páginas. Os limiares da classificação estão no topo de `analysis.py`.

## Fase 3 — distribuição, escala e métricas

* **Workers em outras máquinas:** `compose.worker.yaml` + `.env.worker.example` sobem só um worker GPU apontando
  para o Redis e o S3 centrais pela rede privada (WireGuard/Tailscale; `PRIVATE_BIND` publica Redis/S3 só nela).
  Segmentação e reconstrução escalam separadamente (filas `fai-segment` e `fai-reconstruct`).
* **Worker sem fork:** `SimpleWorker` carrega o modelo uma vez e o mantém na VRAM (o worker padrão do RQ faria fork
  por job e recarregaria os pesos a cada foto, além de ser inseguro com CUDA já inicializado).
* **Escala por demanda:** `fai_queue_depth{queue}` é o sinal para o autoscaler (KEDA, RunPod, MIG/GCE).
  `WORKER_MAX_IDLE_SECONDS>0` encerra o worker ocioso (escala a zero); a API e o Redis continuam no ar.
* **Métricas:** `docker compose --profile monitoring up -d` → Prometheus (`127.0.0.1:9090`), Grafana
  (`127.0.0.1:3000`) e NVIDIA DCGM (uso, VRAM, temperatura e potência). Alertas em `deploy/alerts.yml`: fila
  acumulando, fila sem worker, VRAM > 95%, QA reprovando > 40%, falhas técnicas recorrentes.
* **LoRA de vestuário:** `python -m services.garment_gpu.scripts.export_lora_dataset --out work/lora-dataset`
  exporta pares (recorte + original → imagem aprovada + prompt) só de jobs aprovados na revisão e no QA. Treine com
  um treinador de LoRA para Qwen-Image-Edit (ex.: DiffSynth-Studio, ostris ai-toolkit) e carregue com
  `RECON_LORA_PATH=/loras/arquivo.safetensors` (pasta `./loras`). Treine só com imagens cujos direitos a equipe tem.

## Expor a API com Cloudflare Tunnel (VM sem IP público)

Quando a política da organização proíbe IP público na VM (padrão em projetos novos do Google Cloud), o perfil
`tunnel` publica a API em HTTPS sem abrir porta nenhuma: o `cloudflared` só faz conexão de saída até a Cloudflare.

1. No painel Cloudflare **Zero Trust → Networks → Tunnels**, crie um túnel (tipo *Cloudflared*), copie o token e
   adicione um **Public hostname** (ex.: `gpu.seudominio.com`) com serviço **HTTP** → `api:8000`.
2. Na VM, no `.env`: `CLOUDFLARE_TUNNEL_TOKEN=<token>` e `METRICS_PUBLIC=false` (as métricas não ficam públicas).
3. `docker compose --profile tunnel up -d` e teste de fora: `curl https://gpu.seudominio.com/health`.
4. No backend Java (Railway): `GARMENT_GPU_URL=https://gpu.seudominio.com` e `GARMENT_GPU_API_KEY=<chave submit|read>`.

A autenticação continua sendo a chave por cliente da API; opcionalmente, restrinja ainda mais com regras de WAF ou
uma aplicação Cloudflare Access com *service token*.

### Sem domínio: Tailscale Funnel

Sem domínio próprio, o Tailscale Funnel dá uma URL HTTPS fixa e gratuita (`https://<máquina>.<tailnet>.ts.net`),
também sem IP público na VM (é como a `fai-gpu-1` está publicada):

```bash
curl -fsSL https://tailscale.com/install.sh | sh && sudo systemctl enable --now tailscaled
sudo tailscale up --hostname=fai-gpu-1          # abre um link de login
sudo tailscale funnel --bg 8000                 # na 1ª vez pede para habilitar HTTPS/Funnel na tailnet
tailscale funnel status                         # mostra a URL pública; desligar: sudo tailscale funnel --https=443 off
```

Use `METRICS_PUBLIC=false`: o Funnel não filtra rotas. `/health` é público; `/ready` só mostra o detalhe das
dependências para chave admin; o resto exige chave. A configuração do Funnel persiste em reinícios.

## Integração com o backend Java

No backend (`.env` da API Spring): `GARMENT_GPU_URL=https://gpu.seu-dominio` e `GARMENT_GPU_API_KEY=<chave
submit|read>`. Com isso, dois adaptadores entram como **primeira opção** (`@Order(0)`):

* `GarmentGpuSegmentationAdapter` (`BackgroundRemovalPort`) — remoção de fundo do Flat Lay (RF4), `framing=cutout`.
* `GarmentGpuImageEditAdapter` (`ImageEditPort`) — "cópia da peça por IA"; reconstrução com QA `fail` é descartada e
  o fluxo segue para Gemini/Replicate, se configurados. Sem chaves de terceiros, a GPU própria é o único provedor.

Ambos usam circuit breaker (`ProviderCircuit`), prazo configurável e apagam o job no servidor de GPU depois do
download (`GARMENT_GPU_DELETE_AFTER_DOWNLOAD=false` mantém as imagens para revisão/LoRA até a retenção). O portão
de privacidade do Flat Lay continua valendo: foto com pessoa não sai do backend para **nenhum** provedor de remoção
de fundo, inclusive este. A URL precisa ser https, ou http apenas em rede privada.

## Produção e segurança

Implementado: chaves por cliente com escopos (só SHA-256 no `.env`), isolamento entre clientes, rate limit por
minuto e teto de jobs ativos (Redis, vale para várias réplicas), validação real do formato e teto de pixels antes de
decodificar, EXIF removido na regravação, HTTPS (Caddy) com lista de IPs, Redis com senha, contêineres sem root e
`no-new-privileges`, retenção (lifecycle do bucket `RETENTION_DAYS` + TTL dos registros), exclusão por job, retry
com espera para falhas técnicas, alertas, backups (`scripts/backup.sh` — bucket com rclone e RDB do Redis; agende no
cron e use `BACKUP_REMOTE` para cópia fora do servidor).

Pendente antes de abrir para usuários finais: OIDC/SSO para a revisão humana (hoje a revisão é por chave),
antimalware nos uploads, painel de revisão e testes de carga/latência na GPU escolhida.

## Validação feita e o que falta

* 37 testes (`pytest services/garment_gpu/tests`): API, RQ real (SimpleWorker em fakeredis), retry, QA, S3 (moto),
  segurança, rate limit, export LoRA. As redes neurais são substituídas por dublês determinísticos.
* Pesos reais de Grounding DINO + SAM 2.1 rodados em CPU em fotos reais de pessoas vestindo camiseta/moletom: peças
  isoladas sem braços nem rosto (score do SAM ≥ 0,98, ~10–15 s/foto em CPU).
* `QwenImageEditPlusPipeline` real (diffusers 0.39) exercitado com componentes minúsculos aleatórios: carga, duas
  imagens de referência, prompt negativo, `true_cfg_scale` e tamanho — e o QA reprovou corretamente a saída aleatória.
* Stack real com Docker: imagem da API, Redis, RustFS, worker no host processando jobs enviados pela API, revisão,
  métricas e backup.
* **Não validado aqui:** inferência CUDA, qualidade do Qwen-Image-Edit-2511 com os pesos reais, VRAM/latência por
  GPU, imagens dos workers GPU e configurações do Caddy/Prometheus com as próprias ferramentas — faça no servidor GPU.

## Diferenças em relação ao protótipo inicial (ZIP)

* RQ fazia fork por job: o modelo era recarregado a cada foto → `SimpleWorker` com modelo pré-carregado.
* `torchvision` é obrigatório para o processador do SAM 2 e faltava; `transformers>=4.56` (SAM 2 entrou na 4.56);
  diffusers estável (0.39) no lugar do git.
* `minio/minio` e `minio/mc` não existem mais no Docker Hub: armazenamento trocado por RustFS (Apache-2.0,
  compatível com S3, lifecycle testado) e backup por rclone.
* Limite de máscara 75% recusava fotos flat lay em que a peça ocupa o quadro → 92%; máscara limpa (ilhas e buracos).
* Upload validado pelo formato real, teto de pixels antes de decodificar e `DecompressionBombError` tratado (antes
  virava 500).
