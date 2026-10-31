# Módulo 18 — Python: pipelines, foto canônica, 3D e cloud — lote CANONICAL-GLB-DECODER-001

Base: `bcaee73` (main após PR #416). Branch: `gof/18-python`. `git status --short` limpo antes do lote.

## Mapeamento real (fluxo da prévia canônica 3D)

`scripts/cloud/photo_sets_vertex.py` (gera `photo-sets/<id>/{set.json,whole.png,fabric.png}` + `report.jsonl` via
endpoint FASHN; opcionalmente chama `render_lot`) → **`scripts/catalog/canonical_full_frame.py`**
(`main` argparse `--from-lot/--asset-root/--out/--limit/--force` → `render_lot` → `load_manifest` (manifesto
`FAI_CANONICAL_TEMPLATE_V0`) → `canonical_candidate` (gates READY/taxonomia/ACTIVE/arquivos do contrato/sha256 do GLB/
idempotência por hashes) → `render_asset_png` (decodificação GLB → textura do `fabric.png` → câmera → rasterização
CPU 900×1200 RGBA) → `whole_canonical.png` + `canonical_render.json` em pasta separada `canonical-preview/`).
Outros consumidores: `whole_frame.render_canonical_whole_preview` (usa `render_asset_png`) e
`canonical_photo_guided` (importa `CATEGORIES, HEIGHT, WIDTH, CanonicalFrameError, load_manifest, render_asset_png`).
Não há banco, bucket nem rede neste caminho.

## Problema concreto e decisão

`canonical_full_frame.py` (345 linhas, congelado em `line_baseline.json`) misturava num só módulo o **decodificador
binário glTF/GLB** (cabeçalho, chunks JSON/BIN, accessors densos/estritos, validação de topologia — ~85 linhas de
parsing puro e crítico para segurança, pois lê bytes de arquivo) com textura, câmera, rasterização, gates do lote,
idempotência e CLI. O decodificador não tinha nenhum teste executável sem a biblioteca de assets
(`tests/test_canonical_full_frame.py` pula inteiro quando `fai_canonical_assets/build` não existe — caso deste
ambiente e do CI de `scripts/catalog/tests`).

Extração de função/módulo puro: **`scripts/catalog/canonical_glb.py`** com `parse_glb(bytes)`,
`accessor_array(doc, bin, i)`, `primitives_from_document(doc, bin, category, subcategory)`, `load_primitives(path, …)`,
`Primitive` e `CanonicalFrameError` (movida para cá; `canonical_full_frame` a reexporta, então
`canonical_photo_guided` e quem faz `except CanonicalFrameError` continuam com a mesma classe). O parsing passou a
aceitar `bytes`, testável sem disco. Código, ordem das checagens e códigos de erro copiados sem alteração.

### Padrões avaliados e não aplicados

- **Strategy (renderizadores/engines):** só existe um renderizador CPU; nenhuma seleção explícita a fazer.
- **Template Method (fases do lote):** `canonical_full_frame` e `canonical_photo_guided` compartilham gates, mas com
  saídas e contratos diferentes; unificar exigiria caracterização com a biblioteca real de GLB (indisponível).
- **Chain of Responsibility (gates de `canonical_candidate`):** os gates mudam de natureza (SKIPPED retornado vs.
  exceção levantada → FAILED); separar exige caracterização própria. Fica como próximo candidato.
- **Adapter/Factory:** não há provider externo neste caminho. Nenhum Singleton.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (5 testes novos em `test_canonical_frame_fixture.py`, GLB de um quad gerado em tmp: 900×1200 RGBA, alfa no canto, pixel central, sha256 dos pixels `7a1316…80fe`, 467 856 pixels opacos, framing, 2 triângulos, REVIEW; 7 erros de contêiner; 8 erros semânticos/topologia; lote REVIEW→ALREADY_RENDERED sem tocar `set.json/whole.png/fabric.png`; FAILED por checksum e decodificador) | `python3 -m unittest -v scripts.catalog.tests.test_canonical_frame_fixture tests/test_canonical_full_frame.py tests/test_canonical_photo_guided.py` | 15 testes: 5 OK, 10 skipped (assets ausentes, preexistente) |
| Depois + `test_canonical_glb.py` (7 testes: parse por bytes, accessors densos, view intercalada com stride 20 + índices uint32, tipos não suportados/bounds negativos, material, leitura só do caminho dado, identidade da exceção entre módulos) | `python3 -m unittest -v scripts.catalog.tests.test_canonical_frame_fixture scripts.catalog.tests.test_canonical_glb tests/test_canonical_full_frame.py tests/test_canonical_photo_guided.py` | 22 testes: 12 OK, 10 skipped; ~0,7 s |
| CLI inalterada | `--help` do original vs. novo (execução como script) | saída idêntica |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `canonical_full_frame.py` APERTAR 345→259. As 14 violações listadas são de serviços Java em `fai-application` já reduzidos na branch principal (worktree em base anterior), fora deste lote |

Logs: `evidence/18-canonical-glb-baseline.log`, `18-canonical-glb-after.log`, `18-line-ratchet.log`.

Ambiente sem `scipy`/`pytest`: usei `unittest`; a suíte `scripts/catalog/tests` completa não roda aqui (muitos
módulos importam `scipy`), por isso só os testes do caminho tocado foram executados. Sem GPU, Vertex, rede, bucket,
banco; nenhum arquivo apagado; fixtures de poucos KB em `tempfile`. `python -I` não se aplica à execução do script
como arquivo: o original já falha com `-I` (não acha `photo_set_quality`) — comportamento preexistente, igual após o lote.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `scripts/catalog/canonical_full_frame.py` | 345 | 259 (−86; −24,9 %) |
| `scripts/catalog/canonical_glb.py` (novo) | — | 114 |
| Runtime combinado | 345 | 373 (+28: docstring, constantes nomeadas, funções separadas para bytes/documento/caminho) |
| Testes novos | — | `test_canonical_frame_fixture.py` 119, `test_canonical_glb.py` 73, `glb_fixture.py` 77 |

Memória/tempo: sem mudança de algoritmo; a leitura continua um `read_bytes()` por GLB. Contagem de arquivos de saída
inalterada (2 por set em `canonical-preview/<id>/`).

## Contratos preservados

Flags CLI, saída `whole_canonical.png` + `canonical_render.json` em pasta separada, 900×1200 RGBA, status
`REVIEW`/`CANONICAL_TEMPLATE_UNVERIFIED`, `approval == PROTOTYPE_UNVERIFIED`, códigos de erro, gates READY/taxonomia/
ACTIVE, verificação sha256 do template, idempotência por hashes (`ALREADY_RENDERED`/`STALE_…_REQUIRES_FORCE`), nunca
sobrescrever `set.json/whole.png/fabric.png/report.jsonl`. Nomes públicos importados por outros módulos
(`CATEGORIES, HEIGHT, WIDTH, CanonicalFrameError, load_manifest, render_asset_png, render_lot, canonical_candidate`)
continuam em `canonical_full_frame`. Os privados `_glb/_accessor/_primitives` deixaram de existir (sem uso externo — grep).

## Riscos e pendências do domínio 18

- `canonical_full_frame.py` segue PARTIAL (259 > 250): próximo corte natural é a câmera/rasterização
  (`_camera` + laço de `render_asset_png`) como módulo geométrico, já coberto pelo hash de pixels deste lote.
- `photo_set.py` (300) e `process_local_sd.py` (930) dependem de `scipy`; extrair `clean_target_mask`/`_fabric_box`
  (geometria de máscara) exige ambiente com `scipy` para caracterização.
- `tests/test_canonical_*` (raiz) não estão em nenhum workflow de CI e pulam sem assets; os novos testes ficam em
  `scripts/catalog/tests`, já executado pelo `ci.yml`.
- `deploy_fashn_vertex.py` (888) e `photo_sets_vertex.py` (269): `write_photo_set`/`already_done` são candidatos a
  módulo de serialização do photo set, com caracterização em tmp.
