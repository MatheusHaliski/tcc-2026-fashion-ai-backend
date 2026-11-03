# Lote R99-catalog-py — `scripts/catalog/`

Base: `claude/relaxed-pasteur-5b5466` (`fafe7fe`). Objetivo: os 5 scripts Python do catálogo dentro de 250 linhas
(categoria `python`) e os 2 testes congelados dentro de 400 (categoria `teste`), por extração de responsabilidades em
módulos do mesmo diretório, sem mudar comportamento. Os demais scripts de `scripts/catalog` (outro lote) não foram
editados; só três testes de outros arquivos tiveram o **alvo de `patch`** ajustado (ver "Testes ajustados").

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `process_local_sd.py` | 930 | 151 | `local_sd_base.py` (65) — constantes, `PhotoSkip`, `emit`, `pick_device`, `free_memory`; `local_sd_download.py` (134) — `og_image`, `polite_fetch`, `requests_fetch`, `resolve_image`, `open_image`; `local_sd_masks.py` (144) — `ghost_mask`, `body_from_foreground`, `masks_for`, `lenient_clean`, `measure`; `local_sd_renderer.py` (105) — `sd_inputs`, `make_inpaint_condition`, `SdGhostRenderer`; `local_sd_compose.py` (85) — `Packshot`, `compose_packshot`, `slugify`, `output_name`; `local_sd_db.py` (107) — `TableSpec`, conexão, SQL de pendentes, `store_result`; `local_sd_outputs.py` (86) — mixin `LotOutputs` (`write_photo_set`, `write_manifest`); `local_sd_pipeline.py` (166) — `Options`, `GhostPipeline` (`process`, `run`) | Facade |
| `process_catalog_images.py` | 697 | 183 | `catalog_image_download.py` (136) — `MAX_BYTES`, `DownloadFailure`, `public_image_url`, `authorize_download`, `CheckedRedirect`, `ImageDownloader`; `catalog_image_environment.py` (55) — nomes do Railway, variáveis de `--category-frame`; `catalog_image_checkpoint.py` (35) — `AnalysisCheckpoint`; `catalog_image_audit.py` (154) — `JAVA_TRANSPORT_ERRORS`, `update_analysis`, `fresh_source_decision`, `audit_record`; `catalog_image_persist.py` (98) — `update_committed`, `asset_referenced`, `cleanup_assets`, `persist_products`; `catalog_image_report.py` (68) — `safe_audit`, `progress`, `summarize`, `export_reports`; `catalog_image_cli.py` (50) — `build_parser`, `parse_args` | Facade |
| `providers/official_sitemap.py` | 691 | 91 | `sitemap_site.py` (113) — `Fetch`, `DEFAULT_UA`, `StopDomain`, `Politeness`, `looks_like_html`, `Site`; `sitemap_urls.py` (110) — pistas de produto/sitemap/categoria, `looks_like_*`, `page_links`; `sitemap_crawl.py` (105) — `_xml`, `_locs`, `product_urls`, `crawl_categories`; `sitemap_structured.py` (108) — JSON-LD/OpenGraph, `structured_product`; `sitemap_taxonomy.py` (96) — `infer_subcategory`, `clean_title`, `unsupported_reason`, `is_pack`, `same_brand`; `sitemap_item.py` (131) — `brand_cdn_ok`, `to_catalog_item`, `product_images`, `_gtin` | Facade |
| `fashn_open.py` | 465 | 90 | `fashn_open_labels.py` (45) — tabelas de rótulos, `fashn_category`, `garment_label_ids`; `fashn_open_fusion.py` (127) — `Fusion`, `evidence_of`, `keep_large`, `settle_extent`, `fuse`; `fashn_open_weights.py` (94) — `assets`, `sha256_of`, `download`, `verify`, `verify_component`; `fashn_open_models.py` (158) — `import_birefnet`, `BiRefNetMatting`, `LamaInpainter`, `FashnOpenProvider` | Facade |
| `ingest.py` | 439 | 236 | `ingest_report.py` (43) — `same_value`, `Report`, `setup_logging`; `ingest_brands.py` (104) — mixin `BrandSourceUpserts` (marca, apelido de marca, fonte, fontes oficiais); `ingest_children.py` (91) — mixin `ProductChildrenUpserts` (`_aliases`, `_variants`, `_images`) | NENHUM |
| `tests/test_process_local_sd.py` | 466 | 145 | `tests/local_sd_fixture.py` (83) — `shirt_photo`, `masks`, `FakeRenderer`, `Provider`, `FakeFusionProvider`, `FakeFiller`; `tests/test_process_local_sd_io.py` (129) — download, polidez, dispositivo, SQL; `tests/test_process_local_sd_pipeline.py` (155) — lote e engine fashn-open | — |
| `tests/test_official_sitemap.py` | 504 | 220 | `tests/sitemap_fixture.py` (53) — `ld`, `urlset`, `index`, `FakeWeb`, `polite`, `N`, `TEE`; `tests/test_official_sitemap_item.py` (185) — dados estruturados e item; `tests/test_official_sitemap_cli.py` (87) — `collect_official` | — |

## Como foi dividido

- O código foi **movido por faixas de linhas do original, sem edição** (script de corte que lê o arquivo do `HEAD` e
  falha se alguma linha não vazia do original não for atribuída a um módulo novo ou à fachada). Alterações de corpo,
  todas mínimas e listadas: `class GhostPipeline(LotOutputs)` e `class Ingestor(BrandSourceUpserts,
  ProductChildrenUpserts)` (herdam os mixins); em `process_catalog_images.main`, o parser (`build_parser(__doc__)`),
  a validação (`parse_args`), a gravação no MySQL (`persist_products`, que recebe `ProgressCounter` como fábrica do
  contador), o resumo (`summarize`) e a exportação (`export_reports`, que recebe `write_workbook` importado no mesmo
  ponto de antes) viraram chamadas; o corpo de cada bloco foi movido igual, só desindentado.
- Separação pedida: **CLI/argparse** fica nas fachadas (`process_local_sd.build_parser/main`, `fashn_open.main`,
  `process_catalog_images.main` + `catalog_image_cli.py`); **domínio** em `local_sd_masks`, `local_sd_compose`,
  `fashn_open_labels`/`fusion`, `sitemap_urls`/`structured`/`taxonomy`/`item`, `catalog_image_audit`; **I/O** em
  `local_sd_download`, `local_sd_db`, `fashn_open_weights`/`models`, `sitemap_site`/`crawl`, `catalog_image_download`,
  `catalog_image_checkpoint`, `catalog_image_persist`, `ingest_brands`/`children`; **relatório** em `local_sd_outputs`,
  `catalog_image_report`, `ingest_report`.
- As fachadas reexportam todos os nomes que existiam e que alguém usa (inclusive privados como `_sitemap_rank`,
  `_text`, `_images`, `_device`, `_selected`, `fabric_box`). Deixaram de existir nelas só nomes de bibliotecas que eram
  importados para uso interno (`dataclass`, `field`, `Optional`, `Callable`, `Iterable`, `Iterator`, `SimpleNamespace`,
  `urljoin`, `urlparse`, `urlsplit`, `UnidentifiedImageError`) e as regex privadas `_ATTR`, `_META`, `_HREF`, `_LD`,
  `_META_TAG`, `_PACK`, `_AUDIENCE`, `_SKU_SEGMENT` (nenhum uso fora do módulo:
  `grep -rnE "\.(_ATTR|_HREF|_LD|_META_TAG|_PACK|_SKU_SEGMENT|_META)\b" scripts services` vazio).
- Imports: os módulos novos de `scripts/catalog` usam imports absolutos (`from local_sd_base import …`), como os
  scripts vizinhos (`photo_set`, `whole_frame`), valendo tanto para `import process_local_sd` (com `sys.path` do
  script) quanto para `scripts.catalog.process_catalog_images`; os de `providers/` usam imports relativos
  (`from .sitemap_site import …`). Consumidores (`collect_official`, `enrich_images`, `recheck_collected`,
  `import_products`, `seed_catalog`, `sync_collected`, `process_photo_sets`, `process_whole_frames`,
  `photoset_runtime`, `scripts/cloud/*`) não mudaram. Os Dockerfiles copiam `scripts/catalog` inteiro, então os
  módulos novos vão para as imagens.
- `ProgressCounter`, `analyze_records` e `PROGRESS_INTERVAL` ficaram na fachada de `process_catalog_images` porque os
  testes trocam `process_catalog_images.audit_record`, `.wait` e `.PROGRESS_INTERVAL`; `import socket` ficou nela
  porque os testes trocam `process_catalog_images.socket.getaddrinfo`.
- `process_catalog_images` era carregado em duas cópias (`process_catalog_images` e
  `scripts.catalog.process_catalog_images`), cada uma com a sua `DownloadFailure`; agora as duas reexportam a mesma
  classe de `catalog_image_download` (um `except DownloadFailure` pega o erro venha de qual cópia vier).
- Testes: as duas suítes congeladas foram divididas por tema, com as fixtures compartilhadas em
  `tests/local_sd_fixture.py` e `tests/sitemap_fixture.py` (importadas como `scripts.catalog.tests.*`, como o
  `glb_fixture.py` já existente). Nenhum teste ou asserção foi apagado.

## Por que Facade (e NENHUM no `ingest.py`)

- `process_local_sd.py`, `process_catalog_images.py`, `providers/official_sitemap.py` e `fashn_open.py`: cada um vira
  a linha de comando + interface única que reexporta os nomes de módulos coesos; quem importa (testes,
  `photoset_runtime`, `collect_official`, `enrich_images`, `recheck_collected`, `scripts/cloud`) não muda — o mesmo
  arranjo do R98-diagramas.
- `ingest.py`: o `Ingestor` continua sendo a mesma classe com os mesmos métodos; marcas/fontes e filhos do produto
  saíram para mixins (herança simples, sem nova interface, sem delegação), o que mantém `self.*`, os caches e os
  nomes dos métodos idênticos. Não é um padrão GoF: registrado NENHUM.
- `LotOutputs` (mixin do `GhostPipeline`) segue a mesma lógica: só separa a escrita dos arquivos do lote.

## Testes ajustados (alvo de `patch`, sem mudar asserções)

Mudar o módulo onde a função vive muda onde o `mock.patch` precisa trocá-la (o nome é procurado no módulo de quem
chama). Ajustes:

| Teste | Antes | Depois |
|---|---|---|
| `test_process_catalog_images.py` (2) | `process_catalog_images.public_image_url` | `catalog_image_download.public_image_url` (usada por `ImageDownloader`/`CheckedRedirect`) |
| `test_category_frame_force.py` (2), `test_category_frame_revert.py` (1) | `scripts.catalog.process_catalog_images.public_image_url` | `catalog_image_audit.public_image_url` (usada por `audit_record`) |
| `test_fashn_open.py` (4) | `patch.object(fo, "assets")`, `patch.object(fo, "PACKAGE")` | `patch.object(fo_weights, "assets")`, `patch.object(fo_models, "PACKAGE")` (+2 linhas de import) |

Sem o ajuste, `test_fonte_nao_autorizada_e_enquadrada_e_persistida_com_a_decisao` falhava (a URL ia para o DNS real).

## Testes e equivalência

Ambiente: sem pytest no sistema; instalei com `python3 -m pip install --user pytest scipy aiohttp fastapi httpx pyflakes`
(PyPI). Sem torch, PyMySQL e fashn-human-parser (por isso os 17 `skipped`). Nada de rede, GPU ou dados reais.

| Etapa | Comando | Antes | Depois |
|---|---|---|---|
| Suíte do catálogo (pytest) | `python3 -m pytest -q scripts/catalog/tests -rA` | 309 passed, 9 failed, 17 skipped, 108 subtests | 309 passed, 9 failed, 17 skipped, 108 subtests — mesmo status por teste (só mudam as linhas dos `skip` em `test_fashn_open.py`, +2 linhas de import) |
| Suíte do catálogo (CI) | `python3 -m unittest discover -s scripts/catalog/tests` | 332 testes (9 failures, 17 skipped) | 332 testes (9 failures, 17 skipped) |
| Consumidores | `python3 -m pytest scripts/cloud/tests services/anatomical_vton/tests/test_photoset.py -rA` | 28 passed, 4 failed | idêntico (lista de status igual) |
| Retrato | script de caracterização no scratchpad: `og_image`, `pending_sql`, `normalize_row`, `output_name`, `ghost_mask`, `compose_packshot` (SHA-256 do PNG + info), `sd_inputs`, `polite_fetch`, `--help` de `process_local_sd`/`process_catalog_images`/`fashn_open`, `safe_audit`, `select_records`, `missing_frame_environment`, `update_committed`, `update_analysis`, classificação de 8 URLs, `page_links`, `clean_title`, `infer_subcategory`, `structured_product` + `to_catalog_item`, `brand_cdn_ok`, `fuse` em 3 modos (SHA-256 das máscaras e alfa), `fashn_category`, `same_value`, `Report` | — | todas as saídas iguais; só a lista de nomes dos módulos difere (os nomes de biblioteca/regex privadas listados acima saem; `LotOutputs`, `BrandSourceUpserts`, `ProductChildrenUpserts`, `build_parser`, `parse_args`, `persist_products`, `summarize`, `export_reports` entram) |
| CLI direto | `python3 scripts/catalog/process_local_sd.py --help`, `python3 scripts/catalog/fashn_open.py verify --dest /inexistente` | ok | ok |
| Compilação | `python3 -m py_compile scripts/catalog/*.py scripts/catalog/providers/*.py scripts/catalog/tests/*.py` | — | ok |
| Nomes indefinidos/imports | `python3 -m pyflakes` nos módulos novos e testes novos | — | limpo (nas fachadas, só os reexports `# noqa: F401`) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | — | 0 violações; os 7 arquivos do lote como `APERTAR` (930→151, 697→183, 691→91, 465→90, 439→236, 466→145, 504→220) |

As 9 falhas e as 4 dos consumidores já existiam na base (mesmos testes antes e depois): diferenças numéricas de
máscara com o scipy 1.18 instalado aqui (`LenientCleanupTest`, `FuseTest`, `AutomaticProviderTest`, `photo_set_lot`,
`photo_pipeline`, photo-set do fashn-open) e o lote do Vertex em `scripts/cloud`.

## Pendências

- Nenhum arquivo do lote ficou acima do limite. Falta o integrador rodar `python -m scripts.refactoring.line_ratchet --update`.
- `ingest.py` ficou com 236 linhas (o `_upsert`, de 93, é um método só e não foi fatiado).
- As falhas preexistentes acima não foram investigadas (fora do escopo: o código foi só movido).
