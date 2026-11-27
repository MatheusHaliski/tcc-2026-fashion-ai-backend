# Lote R73 — card do catálogo com o flat lay da Fase 2

Objetivo: o Total frame do produto mostrar o flat lay aprovado da Fase 2 (GPU própria) em todos os caminhos do card
(photo set READY/DEFAULT, recorte real, sem card), sem o `CatalogImagePipelineService` (congelado em 1025 linhas)
crescer. Para caber, uma regra coesa saiu dele antes da mudança.

## Resultado

| Arquivo | Antes | Depois | Arquivo novo (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `CatalogImagePipelineService.java` | 1025 | 1018 | `CatalogSourcePreflight.java` (26) — evidência de preflight da foto de origem (`CATALOG_SOURCE_PREFLIGHT_V1`), usada pelo photo set, pela prévia e pela Peça inteira | NENHUM |

- `cardImage(canonical, product, variants)` passou a delegar: o corpo de antes virou `photoCard` (inalterado) e o
  resultado passa por `CatalogFlatLayFrame.onCard`, que acrescenta o flat lay como `whole` por último. Antes, o
  caminho do photo set retornava cedo (modo `DEFAULT`, sem `whole`) e o caminho do recorte real removia o `whole`
  quando o `whole_json` não trazia o contexto do produto — nos dois casos o flat lay não chegava à interface.
- `wholeFrame` voltou ao original (só o recorte real): o flat lay entra num ponto só.
- `CatalogImagePipelineServiceTest` chama `CatalogSourcePreflight.valid` nos 2 testes de preflight (mesmas entradas e
  mesmas asserções); os 40 testes da classe passam.

NENHUM padrão GoF: `onCard` só completa um mapa já montado (não há interface comum nem cadeia de objetos), e
`CatalogSourcePreflight` é uma função pura de validação.

`line_ratchet.py --update`: teto do `CatalogImagePipelineService` 1025 → 1018.
