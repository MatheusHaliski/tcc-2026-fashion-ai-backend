# Módulo 05 — catálogo, marcas, SKU, variantes, busca: lote CATALOG-PHOTO-CHOICE-001

Base: `bcaee73` (main após PR #416). Branch: `gof/05-catalogo`. `git status --short` limpo antes do lote.

## Mapeamento real do fluxo (só o necessário para o lote)

`components/catalog/*` (`catalog-search.tsx`, `catalog-results-grid.tsx`, `fashion-card.tsx`, `catalog-photo.tsx`)
→ `lib/api/catalog.ts` (tipos `CatalogProduct`, `CatalogCardImage`, `CatalogVariant`, `ImageProvenance`)
→ `CatalogController` (`fai-web`): `GET /api/catalog/search`, `/suggestions`, `/brands`, `/stores`, `/products`,
`/summary`, `/products/{id}` (+ `variantId`, `imageId`), `POST /products/{id}/preview-image|verify-image`,
`POST /api/catalog/discover`, `POST /api/pieces/from-catalog`
→ `CatalogService` (`@Transactional(readOnly = true)` nas leituras; `discover`/`addToWardrobe` de escrita)
→ `CatalogProductRepository`, `CatalogVariantRepository`, `CatalogImageRepository`, `CatalogProductAliasRepository`,
`CatalogSourceRepository`, `BrandRepository`, `BrandAliasRepository`
→ entidades `CatalogProduct`, `CatalogVariant` (cor + código + SKU), `CatalogImage` (`image_url` × `stored_url`,
`primary`, `canonical`, `variant_id`, `assets_json.photoSet`)
→ mapas JSON (`card`, `variantMap`, `images[]`) → cards/ficha no frontend.

A foto de cada peça é decidida em quatro caminhos: `cards()` (acervo paginado), `rank()` (busca e descoberta;
foto da variante da cor pedida), `product()` (ficha, com `variantId`/`imageId`) e `addToWardrobe()` (foto herdada pela
peça pessoal).

## Problema concreto e decisão

Em `CatalogService`, `mainImages`, `mainImagesFor` e `selectedImage` misturavam as três consultas ao
`CatalogImageRepository` com a política de escolha da foto. Problemas reais:

1. **Duplicação:** o comparador de preferência (photo set `READY` › canônica › principal › id) estava escrito duas
   vezes (fallback de `mainImagesFor` e `selectedImage`), com o `photoSet(...)` repetido inline 5 vezes.
2. **Custo:** `CatalogImagePipelineService.photoSet` faz parse de `assets_json` e era chamado dentro do comparador,
   ou seja, O(n log n) parses por ordenação, mais um por foto atual no `forEach`.
3. **Testabilidade:** a regra só era testável montando o serviço inteiro com 10 dependências.

Decisão: extrair a **política pura** para `CatalogPhotoChoice` (package-private, mesmo pacote, 123 linhas). O serviço
continua fazendo exatamente as mesmas consultas, na mesma ordem e com os mesmos argumentos; a classe só decide:
`usable`, `primaryThenCanonical`, `missing`, `fillWithOldest` (estáticos), `dropForeign`, `notReady`, `preferReady`
(instância com o contexto produto/variantes da consulta) e `select` (variante/foto pedida). O status `READY` é
memorizado por foto (`IdentityHashMap`) dentro de uma instância, ou seja, por chamada. Não há cache entre requisições.
`selectedImage` (wrapper privado) foi removido: as 3 chamadas usam `CatalogPhotoChoice.select` direto.

### Padrões avaliados e não aplicados neste lote

- **Strategy (fallback de mídia):** há uma única política de escolha; não existe variação selecionável em runtime.
  Uma interface com uma implementação seria abstração artificial. Se surgir um segundo modo, por exemplo uma política
  por loja, `CatalogPhotoChoice` vira a implementação padrão sem mudar os chamadores.
- **Builder (query de busca):** `search()` monta o pool com 4 a 5 chamadas fixas a `candidates*`; não há parâmetros
  opcionais combinatórios que justifiquem builder. Fica para um lote próprio com caracterização do pool.
- **Iterator (paginação com cursor):** `browse` já usa `Page` do Spring Data com teto de 96; não há leitura em lote
  em memória nesse fluxo.
- **Adapter/Factory Method (origens/parsers):** pertencem a `CatalogIngestService`/`OfficialCatalogDiscovery`, que não
  foram tocados. A ingestão massiva está fora do escopo seguro (nada de reimportar imagens).
- **Proxy (cache remoto):** a memorização é local à chamada; não introduz cache, TTL nem acesso remoto.
- **Facade:** `CatalogService` já é a fachada do controller.
- **Singleton:** nenhum Singleton manual introduzido.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração: `CatalogServicePhotoChoiceTest`, 5 testes novos. Camadas principal › canônica › mais antiga (sem data por último, empate pela URL); 3ª consulta só com os ids sem foto e pulada quando todos têm; foto de variante órfã descartada; preferência canônica › principal › id; READY vence a canônica não READY mas não substitui uma principal READY; variante pedida com cor, SKU e código da mesma `CatalogVariant` e foto própria, na ficha e na busca por cor | `mvn -B -pl fai-application -Dtest='CatalogServicePhotoChoiceTest,CatalogServiceTest' test` no código original | 20 testes (15 + 5), 0 falhas |
| Depois da extração: caracterização + `CatalogPhotoChoiceTest` (4 testes unitários puros) + consumidores (`CatalogServiceTest`, `CatalogSearchResolveTest`, `WardrobeServiceCadastroTest`, `PhysicalStorePurchaseTest`, `AssetCatalogServiceTest`, `CatalogImagePipelineServiceTest`, `CatalogImageIdentityTest`) | `mvn -B -pl fai-application -Dtest='CatalogPhotoChoiceTest,CatalogServicePhotoChoiceTest,CatalogServiceTest,CatalogSearchResolveTest,PhysicalStorePurchaseTest,WardrobeServiceCadastroTest,AssetCatalogServiceTest,CatalogImagePipelineServiceTest,CatalogImageIdentityTest' test` | 96 testes, 0 falhas/erros |
| Limite de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos do lote; `CatalogService` com teto apertável 847 → 811. 2 violações preexistentes em arquivos **não tocados** (`IdentityService`, `SchemeService`): o baseline da branch principal é posterior à base `bcaee73` desta worktree |

Logs: `evidence/05-catalog-baseline.log`, `evidence/05-catalog-after.log`.

Não foram usados banco, servidor, navegador, rede, GPU/Vertex nem acervo real. Nenhuma imagem foi baixada ou
reimportada; todas as fixtures são locais e em memória.
`fai-web` não foi recompilado: a API pública de `CatalogService` não mudou. Só membros `private` foram removidos
(`usable`, `selectedImage`); `mainImages`/`mainImagesFor`, package-private, mantêm assinatura.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `CatalogService.java` (congelado no baseline) | 847 linhas | 811 (−36; −4,25 %) |
| `CatalogPhotoChoice.java` (novo, ≤ 250) | — | 123 |
| Runtime combinado | 847 | 934 (+87: javadoc da política, assinaturas) |
| Testes novos | — | `CatalogServicePhotoChoiceTest` 209 + `CatalogPhotoChoiceTest` 128 (≤ 400 cada) |
| Parses de `photoSet` por ordenação de n fotos | O(n log n) | ≤ n (memorizado por chamada) |

O ganho é coesão, eliminação da duplicação do comparador e custo menor de JSON por requisição, não redução global
de complexidade.

## Contratos preservados

URLs, métodos, DTOs/mapas (`imageUrl`, `catalogImage`, `imageSource`, `selectedVariant`, `variants`, `images[]`),
`image_url` × `stored_url`, ordem e quantidade das consultas ao repositório (sem N+1 novo), transações, regra de
identidade de variante (`CatalogImageIdentity`: SKU e cor da mesma `CatalogVariant`; foto de outra cor nunca entra por
fallback), foto `REJECTED` nunca exibida, `REFERENCE_ONLY`/`DISCOVERED`, i18n e frontend sem alteração. Sem mudança de
schema, migration ou configuração.

## Riscos e pendências do domínio 05

- `CatalogService` continua PARTIAL (811 linhas): `resolve()` (interpretação de texto com consultas de marca no laço),
  montagem do pool de `search()`, `card()`/`variantMap()` (apresentação) e `addToWardrobe()` (montagem do `PieceForm`)
  ainda no mesmo bean. Próximo candidato: extrair a apresentação `card`/`variantMap`/`applyVariant` como mapeador puro,
  com caracterização das chaves do JSON.
- N+1 remanescente, que não piorou: `brands.findById` por marca distinta em `cards()`/`rank()` (memorizado por marca) e
  `brandMap()` → `countByBrandIdAndIngestionStatusIn` por marca sugerida (até 12).
- `rank()` faz `images.findByProductIdIn(ids)` para fotos por cor além das consultas de `mainImagesFor`; unificar exige
  mudar a ordem de consultas e fica para outro lote.
- `AdminCatalogService`, `CatalogIngestService`, frontend (`components/catalog`, `lib/api/catalog.ts`) não alterados.
