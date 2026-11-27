# Arquitetura e fases

## Componentes

```
Backend Java (Railway) ──HTTPS──▶ API FastAPI ──▶ Redis (filas RQ) ──▶ worker Fase 1 (L4): Grounding DINO + SAM 2.1
  GarmentGpu*Adapter              auth, cotas,        fai-segment         analisa e roteia
                                  jobs, imagens       fai-reconstruct ──▶ worker Fase 2 (A100): Qwen-Image-Edit + QA
                                        │
                                        ▼
                                  RustFS (S3): originais, máscaras, recortes, reconstruções, metadata.json
```

| Peça | Tecnologia | Papel |
|---|---|---|
| API | FastAPI (CPU) | autenticação por chave, validação do upload, registro dos jobs, entrega das imagens |
| Fila | Redis + RQ | uma fila por fase; workers de máquinas diferentes consomem a mesma fila |
| Armazenamento | RustFS 1.0.4 (S3) | `jobs/<id>/input.png`, `mask.png`, `segmented.png`, `reconstructed.png`, `metadata.json`; expiram em `RETENTION_DAYS` |
| Worker Fase 1 | `SimpleWorker` do RQ | carrega os modelos uma vez e os mantém na VRAM (sem fork por job) |
| Worker Fase 2 | idem, em outra VM | Qwen-Image-Edit-2511 com LoRA Lightning (8 passos) |

### Modelos (pesos abertos, rastreados em cada job)

| Fase | Modelo | Licença | Função |
|---|---|---|---|
| 1 | `IDEA-Research/grounding-dino-tiny` | Apache-2.0 | encontra a peça pela descrição em texto (categoria) |
| 1 | `facebook/sam2.1-hiera-tiny` | Apache-2.0 | recorta os pixels da peça dentro da caixa |
| 2 | `Qwen/Qwen-Image-Edit-2511` | Apache-2.0 | redesenha a peça em flat lay |
| 2 | `lightx2v/Qwen-Image-Edit-2511-Lightning` (8 passos) | Apache-2.0 | acelera a Fase 2 ~5× |

`GET /v1/models` lista o que está configurado; cada job guarda os ids exatos em `segmentation.models` e
`reconstruction.models`.

## Fase 1 — segmentação

1. **Detecção:** o Grounding DINO recebe a lista de nomes da categoria (ex.: `upper_piece` → "t-shirt. shirt.
   polo shirt. sweatshirt. hoodie. jacket…") e devolve caixas com pontuação. Fica a de maior pontuação que não
   ocupe o quadro inteiro.
2. **Recorte:** o SAM 2.1 recebe a caixa e propõe **três máscaras**. Escolhemos a que fica **dentro da caixa**
   (desempate pela confiança do próprio SAM). Com uma única máscara, o SAM pegava o objeto de maior contraste
   dentro da caixa — pernas nuas sob um short, cabelo sobre uma camisa clara.
3. **Portões de qualidade** (recusam em vez de entregar algo errado):
   - `MASK_OUTSIDE_DETECTION`: mais de 25% da máscara fora da caixa (`MASK_MIN_INSIDE_BOX=0.75`) — sinal de corpo
     ou fundo, não da peça;
   - `INCONSISTENT_MASK`: máscara menor que 0,5% ou maior que 92% do quadro (`MASK_MIN/MAX_FRACTION`);
   - `NO_GARMENT_DETECTED`: o detector não achou nada da categoria.
4. **Limpeza:** remove ilhas pequenas e preenche buracos internos — **exceto buracos de pele** (uma mão na frente
   do tecido), que ficam abertos para a Fase 2 repintar. Antes, preencher esse buraco colava a mão no recorte.
5. **Enquadramento:** `framing=catalog` (padrão) centraliza a peça num quadro 1024×1536 com margem, fundo branco
   ou transparente; `framing=cutout` mantém o quadro original (contrato do rembg, usado pela remoção de fundo do
   app).

## Critérios de entrada na Fase 2 (`analysis.py`)

Com `mode=auto`, a API analisa o recorte junto com a foto original e decide:

| Classe | Como é detectada | Destino |
|---|---|---|
| `COMPLETE_PRODUCT` | sem pessoa, peça sem tocar a borda | **Fase 1 é o produto final** (`output=flat_product`) |
| `COMPLETE_ON_MODEL` | pele fora da peça ≥ 1% do quadro (alguém vestindo) | Fase 2 — tecido esticado |
| `OCCLUDED` | manchas de pele **cercadas** pela peça (mão/braço na frente) > 4% da área da peça, ou parte de cima muito côncava | Fase 2 |
| `CUT` | a peça encosta na borda da foto (1% de margem) | Fase 2 — completar o que ficou fora |

Calçados e acessórios (`shoes_piece`, `accessory_piece`) nunca vão para a Fase 2 no `auto`, mesmo cortados ou ao
lado de uma pessoa: são fotografados como produto, e a Fase 2 chegou a desenhar roupa para um par de tênis (teste no
RunPod, 02/11/2026). O recorte da Fase 1 é o produto final deles.

Sem worker da Fase 2 no ar, o job termina com o recorte e `output=needs_reconstruction_unavailable`: o cliente sabe
que **não** é produto final. `mode=segment` nunca reconstrói; `mode=reconstruct` sempre reconstrói.

**Limitação conhecida:** a detecção de pele usa uma faixa de cor (YCbCr). Roupa bege, creme ou rosa também cai na
faixa, por isso a oclusão só conta pele *cercada* pela peça, e a decisão "tem pessoa" olha pele *fora* dela. O
próximo passo é trocar essa heurística pelo SAM 3D Body (corpo da modelo reconstruído em 3D e projetado na foto),
ver [fase3-provador.md](fase3-provador.md).

## Fase 2 — reconstrução

- **Entradas:** imagem 1 = recorte da Fase 1 em fundo branco, com o espaço coberto por mãos ou antebraços preenchido
  com a cor do tecido vizinho (`reference.py`; sem isso o modelo desenhava um vazado onde estava a mão); imagem 2 =
  foto original (só como referência das partes escondidas). O nome e a cor do produto entram no prompt.
- **Instrução:** peça em *flat lay* — deitada e esticada sobre uma superfície, vista de cima, centralizada,
  simétrica, frente para cima, mangas e pernas estendidas, fundo branco; sem pessoa, parte do corpo, manequim,
  cabide, efeito "manequim fantasma" ou vincos de uso; preservar cores, estampas, logotipos, escudos e costuras e
  **não inventar marcas** (essa frase nunca é removida, nem quando o cliente manda o próprio texto). Com o LoRA
  Lightning o `true_cfg` é 1.0 e o prompt negativo é ignorado, então as proibições ficam no prompt positivo
  (`prompts.py`): manter tipo, gola, manga e comprimento da foto; o que é liso nas fotos fica liso (sem estampa,
  logotipo, texto, etiqueta, bordado, listra, debrum, bolso, botão ou vazado inventados).
- **Tentativas:** até `RECON_MAX_ATTEMPTS` sementes; fica a de melhor QA.
- **QA automático** (`quality.py`), contra os pixels fotografados:

| Sinal | Medida | Alerta |
|---|---|---|
| Cor | ΔE (CIELAB) entre as 3 cores dominantes | > 10 (`QA_MAX_DELTA_E`); > 15 reprova |
| Distribuição de cor | interseção de histogramas a*/b* | entra na nota |
| Estrutura | SSIM do recorte × reconstrução | entra na nota |
| Silhueta | IoU das máscaras | < 0,35 alerta — **exceto** quando a origem estava vestida (o flat lay muda a silhueta de propósito) |
| Fundo | bordas brancas | < 85% alerta |
| Pessoa restante | pele a mais que na peça original | > 8% reprova |
| Costas × frente | ΔE entre as cores dominantes das duas vistas geradas | > 10 (`BACK_COLOR_MISMATCH`), no máximo `warn` |

  Nota = 0,35·cor + 0,20·histograma + 0,20·SSIM + 0,15·IoU + 0,10·fundo; `pass` exige nota ≥ 0,62 sem alertas.
  O QA **não certifica** logotipos, escudos e textos: toda reconstrução fica `review.status=pending` até uma pessoa
  aprovar em `POST /v1/jobs/{id}/review`. Reconstruções aprovadas alimentam o dataset de LoRA
  (`scripts/export_lora_dataset.py`).

## API (resumo)

| Rota | Uso |
|---|---|
| `POST /v1/garments` | foto + `category`, `mode` (`segment`/`reconstruct`/`auto`), `framing`, `background`, `bbox`, dicas |
| `GET /v1/jobs/{id}` | status, `analysis`, `segmentation`, `quality`, `review`, `output`, links das imagens |
| `GET /v1/jobs/{id}/image?variant=` | `final`, `segmented`, `reconstructed`, `mask`, `input` |
| `POST /v1/jobs/{id}/review` | aprovação humana |
| `DELETE /v1/jobs/{id}` | apaga registro e imagens |
| `GET /v1/admin/queues` | filas e workers vivos (com GPU e VRAM) |

Chaves por cliente com escopos (`submit`, `read`, `review`, `admin`); só o SHA-256 fica no servidor.

## Integração com o backend Java

| Adaptador | Porta | Uso |
|---|---|---|
| `GarmentGpuSegmentationAdapter` | `BackgroundRemovalPort` | remoção de fundo do Flat Lay (RF4), `framing=cutout` |
| `GarmentGpuImageEditAdapter` | `ImageEditPort` | "cópia da peça por IA"; resultado com QA `fail` é descartado |

Ambos são a primeira opção (`@Order(0)`) quando `GARMENT_GPU_URL` está configurada, com circuit breaker; sem a GPU,
o backend cai para os outros provedores. O job é apagado no servidor de GPU após o download. O portão de
privacidade do Flat Lay (foto com pessoa não sai do backend para remoção de fundo) continua valendo.
