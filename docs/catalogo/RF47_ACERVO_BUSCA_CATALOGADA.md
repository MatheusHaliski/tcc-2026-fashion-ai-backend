# RF47 — Acervo & Busca Catalogada

> 04/10/2026 · RF novo do board "TCC 2026 (Fashion AI)", lista *Requisitos Funcionais*.
> Diagramas: [`docs/diagramas/RF47/`](../diagramas/RF47/) · Taxonomia: [`docs/entidades/TAXONOMIA_ENTIDADES.md`](../entidades/TAXONOMIA_ENTIDADES.md)
> · Anatomia da tela: [`docs/anatomias/anatomias_card_v20.html`](../anatomias/anatomias_card_v20.html)
> · Captura por foto (RF45, fora do criador de peça): [`docs/visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md`](../visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md)

## 1. Objetivo

Adicionar uma peça ao guarda-roupa **identificando o produto num catálogo global** (marca, nome, modelo, cor e foto
oficial) em vez de depender só da fotografia. A pessoa diz aproximadamente o que é a peça; o FashionAI encontra o
produto. Peças fora do catálogo (vintage, artesanais, sem marca) são cadastradas pelos dados do formulário, com a
ilustração da categoria; a foto própria pode ser trocada depois, no detalhe da peça ("Trocar foto"). Por decisão do
projeto (04/10/2026), o criador de peça **não tem seção de envio de foto**.

O catálogo é **global e separado do guarda-roupa**: `CatalogProduct` é o produto que o FashionAI conhece;
`WardrobeItem` é a posse desse produto por uma pessoa, **por referência** (`catalog_product_id`,
`catalog_variant_id`, `image_origin`), sem copiar o produto.

## 2. Fluxo na tela (`/pieces/new`, etapa única "1 · Peça")

O criador tem 4 etapas: **Peça** → Mais detalhes → Arte de fundo → Revisar e salvar. A etapa Peça junta, na mesma
tela, com a prévia do card ao lado (sem seção de foto):

1. **Tipo da peça** — Parte superior, Parte inferior, Calçados, Acessórios, Peça única.
2. **Buscar no catálogo** (recomendado) — subtipo → marca (autocomplete com apelidos) → nome/modelo. Duas ou três
   informações já disparam a busca (debounce 350 ms) e sugestões de modelo enquanto digita. Resultados em cards:
   foto oficial (ou ilustração da categoria), marca, nome, modelo · subtipo, variantes de cor, fonte e
   **"% compatível"** — similaridade da busca, **não** certeza de que a peça física é aquela.
   - **"É esta"**: o produto vira referência ("Peça do catálogo", botão Remover) e **preenche o formulário** com os
     dados globais (nome, categoria, subtipo, cor da variante, material, marca, SKU). Os dados da pessoa (tamanho,
     preço, ocasião, estilo, estado, data e local da compra, notas, visibilidade, à venda) ficam com ela.
   - **Sem resultado**: "Não encontrei minha peça" (refinar por código/SKU e cor), **"Pesquisar em lojas
     oficiais"** e "Ou preencha os dados da peça logo abaixo.".
3. **Dados** — o formulário da peça (`PieceFields`), já preenchido pelo produto quando há um.

Ao salvar: **com produto** → `POST /api/pieces/from-catalog` (a foto oficial vira a imagem, `image_origin = CATALOG`;
se o produto não tiver foto oficial, a ilustração da categoria); **sem produto** → `POST /api/pieces` com a ilustração
da categoria. A revisão mostra a "Origem da imagem".

Atalhos: o **Explorador › Buscar marcas & lojas** lista as marcas do catálogo (mesmo sem perfil cadastrado) com
"Buscar peças" → `/pieces/new?brand=<marca>`; `?category=` e `?q=` também pré-preenchem.

## 3. Busca externa e crescimento do catálogo

```
Usuário pesquisa → produto não existe → busca externa (só domínios oficiais da marca)
→ usuário escolhe → FashionAI normaliza → produto entra no catálogo → próximo usuário encontra localmente
```

- `POST /api/catalog/discover` usa `OfficialCatalogDiscovery` (`AiCapability.CATALOG_DISCOVERY`, busca na web via
  motor de IA do RF24, com consentimento). Só aceita resultados de domínios em `catalog_sources` da marca
  (`OFFICIAL_BRAND`, `OFFICIAL_STORE`, `AUTHORIZED_RETAILER`, `PARTNER_API`); domínios bloqueados (Pinterest,
  Instagram, blogs, fóruns, marketplaces desconhecidos) são descartados. Sem IA ou sem fonte oficial: devolve
  nada — **nunca inventa** produto, marca ou imagem.
- O descoberto entra como `DISCOVERED` (não aparece para outros). Quando alguém o escolhe, passa a
  `REFERENCE_ONLY` e `owners_count` sobe: o próximo usuário o encontra na busca local.
- **Crescimento em lote** (`scripts/catalog/collect_official.py`): coleta nomes e dados de produtos direto dos sites
  oficiais das marcas (sitemaps do robots.txt + JSON-LD/OpenGraph da página). Respeita robots.txt e Crawl-delay, para
  no primeiro 403/429, não baixa imagens e grava a URL oficial de cada produto. A saída (JSONL por marca) entra pelo
  `import_products.py`, com dry-run e dedup. Busca na web genérica não serve: devolve sobretudo marketplaces,
  proibidos pelo RN47.04. Detalhes em `scripts/catalog/README.md`.

## 4. API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/catalog/search?category&subcategory&brand&q&color&limit` | busca com intenção resolvida, re-ranqueamento e variante pré-selecionada pela cor |
| GET | `/api/catalog/suggestions` | sugestões de modelo enquanto digita |
| GET | `/api/catalog/brands?q` | autocomplete de marca (nome e apelidos, nº de produtos) |
| GET | `/api/catalog/products/{id}` | produto com variantes, imagens (proveniência) e apelidos |
| POST | `/api/catalog/discover` | busca nas lojas oficiais (RF24/`CATALOG_DISCOVERY`) |
| POST | `/api/pieces/from-catalog` | cria a peça por referência (dados pessoais no corpo) |
| GET | `/api/catalog/stores` | marcas do catálogo com produtos (grade de marcas do criador, vitrine do Provador, RF18) — uma consulta agrupada por marca e categoria |
| GET | `/api/catalog/products?brand&brandId&category&subcategory&q&page&size` | **acervo inteiro**, paginado (padrão 48, máximo 96 por página), em ordem estável (nome, id), com o **total real** do banco — ver §4.1 |
| GET | `/api/catalog/summary` | tamanho do acervo visível: `{products, brands}` |

Removidas em 04/10/2026, sem uso desde que o criador deixou de ter foto: `GET/PUT /api/me/capture-tutorial[/{guide}]` (com a
coluna `user_preferences.capture_tutorial_json`, apagada na V32) e `POST /api/pieces/analysis` (análise de uma foto; a
análise continua em `/api/pieces/analysis/batch` e `/multi`).

Controller: `CatalogController`. Serviços: `CatalogService` (busca, sugestões, produto, discover, addToWardrobe,
marcas para o Explorador e o Provador), `CatalogIngestService` (upsert idempotente), `CatalogNormalizer`,
`CatalogMatchScorer`, `OfficialCatalogDiscovery`; `WardrobeService.createFromCatalog`;
`ExplorerService.brandsAndStores`.

### 4.1 Acervo inteiro × busca ranqueada (10/10/2026)

**Problema verificado.** O pedido era que o criador de peças e a Busca mostrassem **todas** as peças do acervo. Nenhuma
das duas telas fazia isso:

| Onde | Antes | Por quê |
|---|---|---|
| Criador de peça (busca catalogada) | no máximo 24 cards por busca, e só depois de 2–3 informações | `GET /api/catalog/search` pega até 200 candidatos, corta em `limit` (máx. 48) e devolve `total` = tamanho da página |
| Criador de peça (grade de marcas) | marca escolhida sozinha não listava nada | a busca exigia duas ou três informações |
| Buscar | aba Peças mostra peças **públicas de pessoas**, não o catálogo; marca só do catálogo levava a essas peças | não havia rota para percorrer o catálogo |
| Grade de marcas (criador, Provador, Explorador) | 2 consultas **por marca**, uma delas carregando todas as peças da marca só para listar as categorias | lento com o acervo inteiro; podia estourar o tempo da requisição |

**Agora.**

- `GET /api/catalog/products` percorre o acervo visível (`VALIDATED`, `PERSISTABLE`, `REFERENCE_ONLY`) sem pool e sem
  corte por pontuação, com filtros opcionais e `total` vindo de `COUNT(*)`. Marca desconhecida devolve
  `brandKnown=false` e lista vazia (nunca outra marca no lugar).
- **Criador de peça:** escolher só a marca, só o tipo ou tocar em "Ver todo o acervo" lista **todas** as peças da
  seleção ("300 peças de Farm Rio"). A grade mostra duas linhas por vez; a paginação mostra o total real
  ("Página 1 de 38 · 300 resultados") e "Avançar" além das peças já carregadas busca a próxima página do servidor —
  sem carregar o acervo inteiro de uma vez. Ao digitar um nome (ou escolher cor), volta a busca ranqueada com
  "% compatível". A linha "Acervo completo: N peças de M marcas" vem de `/api/catalog/summary`.
- **Buscar → Acervo** (aba nova): o catálogo inteiro em páginas de 24 com rolagem infinita, filtros de marca e
  categoria, termo opcional, "Mostrando X de N" e "Usar no criador" (abre `/pieces/new` preenchido com marca, nome,
  categoria e tipo). Em Buscar → Marcas, "Ver peças" de uma marca só do catálogo abre o acervo dessa marca.
- **Provador:** usa o mesmo componente; tocar numa loja lista todas as peças dela, paginadas.
- A grade de marcas sai de **uma** consulta agrupada (`visibleCountsByBrandAndCategory`), com `categoryCounts` por
  marca: no criador e no Provador, o bloco mostra quantas peças a marca tem **no tipo escolhido**; marca sem peças
  daquele tipo continua na grade, apagada ("0 produtos"). Falha ao carregar a grade mostra aviso e "Tentar de novo"
  (servidor antigo sem a rota continua sem grade, sem erro).
- Busca com texto: os cards ranqueados continuam ("as mais parecidas") e o botão **"Ver todas as peças com …"** troca
  para o acervo inteiro com aquelas palavras (até três, todas exigidas no nome, modelo ou texto de busca).
- Tocar numa marca da grade manda também o `brandId`, sem depender do nome; id inexistente devolve
  `brandKnown=false`, nunca outra marca.

**Números.** O ambiente de desenvolvimento não acessa o banco de produção, então o total de produção não foi
conferido aqui; as telas mostram o número real de cada ambiente. No repositório: arquivo do acervo
`data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz` com **9 573 produtos de 45 marcas**, mais **182** do seed
(`data/catalog/products/`, 11 marcas); `brands.json` lista 100 marcas, das quais só as com produto visível aparecem na
grade. Evidências (API simulada com os nomes, marcas e tipos desse arquivo; fotos trocadas pela imagem padrão FAI da
categoria): [`docs/evidencias/catalogo-completo-2026-10-10/`](../evidencias/catalogo-completo-2026-10-10/).

### 4.2 Peças agrupadas pela URL antiga (Gap, 11/10/2026)

A URL canônica descartava a query, e as 248 peças da Gap (identificadas só por `?pid=`) viravam um produto com 839
fotos. A regra nova mantém os parâmetros de identidade (commit 4ac39d6f; paridade Python × Java em `dedup-cases.json`).
Bancos já importados se consertam com `scripts/catalog/repair_merged_products.py` (detecta, esconde o agrupado sem
apagar e reimporta uma peça por página); passo a passo em `scripts/catalog/README.md`.

### 4.3 Uma foto por peça (11/10/2026)

Cada peça com foto aparece com uma foto no card. A foto do card é escolhida assim: canônica do pipeline (Quality
Gate) › principal da ingestão › qualquer outra foto utilizável da peça (a mais antiga); foto recusada (`REJECTED`)
nunca aparece. Antes, peça sem foto marcada como principal ficava com a ilustração mesmo tendo fotos. Na tela, se a
foto não carrega (arquivo processado ausente, servidor da marca fora do ar), o card tenta a seguinte (a original da
marca) e só então mostra a ilustração da categoria. `/api/catalog/summary` devolve `withImage` (peças visíveis com
pelo menos uma foto utilizável), mostrado ao lado do total ("N peças · N com foto"): os dois números devem ser iguais.

## 5. Ranqueamento ("% compatível")

Candidatos pelo índice `FULLTEXT ... WITH PARSER ngram` de `catalog_products.search_text` (marca, nome, modelo, cor,
coleção, códigos, apelidos) e re-ranqueados por `CatalogMatchScorer`: marca 0,25 · categoria 0,10 · subcategoria
0,20 · texto 0,35 · cor 0,10 (· visual 0,15, reservado), normalizados pelos pesos presentes na busca. Texto: palavra
exata 1, prefixo 0,85, Levenshtein 0,7 (prefixo também na última palavra ainda sendo digitada). Abaixo de 0,35 o
resultado não aparece.

## 5.1 Características únicas da peça lidas do texto

O campo **"Como ela se chama?"** aceita nome, modelo **ou descrição**. O texto é lido como as características únicas da peça,
o que separa duas peças da mesma marca e do mesmo tipo. Exemplo (Calvin Klein, no seed):

| A pessoa escreve | O FashionAI entende | Primeiro resultado |
|---|---|---|
| "camisa com o logo ck estampado em toda a superfície, frente e verso, cinza e preto" | logo em toda a peça · frente e verso · cinza · preto | Camiseta Monogram Allover (cinza/preto) |
| "camisa toda azul com um único logo ck branco no centro" | um logo · centro do peito · peça azul · estampa branca | Camiseta Logo Central (azul) |

- **Leitura local** (`CatalogDesignInterpreter`): vocabulário em `normalization.json → design` (o mesmo que o Python valida) —
  estampa (logo em toda a peça/monograma, um logo, listras, xadrez, floral, camuflado, tie-dye, color block, lisa, estampa),
  posição e tamanho do logo, lados ("frente e verso") e o **papel das cores**: cor logo depois de "logo/estampa" é da
  estampa; depois de "toda/fundo" ou antes de "com" é da peça; cores ligadas por "e" herdam o papel.
- **IA** (`CatalogTextInterpreter`, capacidade `CATALOG_TEXT_INTERPRETER`, RF24): refina descrições com 4+ palavras, só com
  o vocabulário fechado (valor fora dele é descartado); cache por texto; roda fora da transação da busca. Sem IA, vale a
  leitura local — nada é inventado.
- **Produto**: `catalog_products.description` e `design_json` (Flyway V31). Sem design gravado, ele é lido do nome +
  descrição + cor pelo mesmo intérprete.
- **Ranqueamento**: componente **design** (peso 0,45) no `% compatível`: estampa 0,40 · posição 0,15 · tamanho 0,05 ·
  lados 0,10 · cores 0,30 (no papel certo; com logo em toda a peça, as cores do produto inteiro). Cada característica volta
  como motivo (✓/✗) no card.
- **Tela**: chips "Entendemos: …" abaixo do campo (com "lido pela IA" / "lido do texto") e a descrição + os motivos em cada
  card de resultado.
- Subtipo deduzido do texto ("camisa") só pontua, não filtra (no Brasil "camisa" também é camiseta).

## 6. Modelo de dados (V30 `V30__catalogo_global.sql`)

| Tabela | Papel |
|---|---|
| `brands` (existente) + `brand_aliases` | marca única; apelidos normalizados (`uq_brand_aliases_norm`) |
| `catalog_sources` | domínios oficiais por marca, `source_type`, `allows_image_persistence` |
| `catalog_products` | produto global; identificadores (gtin, ean, upc, sku, código, URL canônica); `dedup_key` **único**; `source_status`, `ingestion_status`, `owners_count`, `last_verified_at` |
| `catalog_product_aliases` | apelidos do produto ("AF1") |
| `catalog_variants` | cor/código/SKU/GTIN por variante (`uq (product_id, variant_key)`) |
| `catalog_images` | imagem com proveniência: URL, hash, domínio, tipo de fonte, `usage_status`, `retrieved_at`, `last_verified_at` |
| `catalog_ingestion_runs` | relatório de cada execução de ingestão |
| `catalog_products` (+2, V31) | `description`, `design_json` (características únicas da peça) |
| `wardrobe_items` (+4 colunas) | `catalog_product_id`, `catalog_variant_id`, `image_origin`, `user_image_url` |
| `user_preferences` (V32) | `capture_tutorial_json` removida (o guia de fotografia saiu) |

Enums: `CatalogSourceType` (OFFICIAL_BRAND, OFFICIAL_STORE, AUTHORIZED_RETAILER, PARTNER_API, MANUAL_ADMIN),
`CatalogSourceStatus` (ACTIVE, UNAVAILABLE, SOURCE_REMOVED, NEEDS_REVALIDATION), `CatalogIngestionStatus`
(DISCOVERED, VALIDATED, PERSISTABLE, REFERENCE_ONLY, REJECTED), `CatalogImageType`, `CatalogImageUsage`
(REFERENCE_ONLY, PERSISTED, REJECTED), `ImageOrigin` (CATALOG, USER_PHOTO).

## 7. Deduplicação e ingestão idempotente

Ordem de identidade: **GTIN › EAN › UPC › SKU › código do produto › URL canônica › marca + subcategoria + modelo +
variante › marca + subcategoria + título + cor**. Identificadores também são procurados nas variantes; o mesmo modelo
em outra cor vira **variante**, não produto novo. As regras ficam num arquivo só,
`fai-application/src/main/resources/catalog/normalization.json`, lido pelo Java (`CatalogNormalizer`) e pelo Python
(`normalize_product.Normalizer`); o teste `DedupParityTest` + `dedup-cases.json` garante que os dois geram a mesma
chave.

Pipeline Python em `scripts/catalog/` (ver [README](../../scripts/catalog/README.md)): `seed_catalog.py`
(bootstrap de 10 marcas — Nike, Adidas, Lacoste, Levi's, Puma, New Balance, Vans, Converse, Uniqlo, Zara — com 168
produtos de `data/catalog/`), `import_products.py` (JSON/CSV), `deduplicate.py`, `validate_source.py`,
`image_metadata.py`, `rebuild_search_index.py`, `revalidate_catalog.py`. `--dry-run`, `--verbose`, uma transação
por item, relatório `total_read · created · updated · skipped · duplicates_found · errors` e logs
`[CREATE]/[UPDATE]/[SKIP]/[DUP]/[ERROR]`. Rodar o seed duas vezes não duplica nada (provado: 168 criados → 168
ignorados → 168 ignorados). Credenciais só pelas variáveis do backend (`MYSQL_HOST`, `MYSQL_PORT`,
`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`); senha e connection string nunca vão para o log.

## 8. Regras de negócio

| Código | Regra |
|---|---|
| RN47.01 | O catálogo é global; a peça da pessoa referencia o produto, sem copiá-lo. |
| RN47.02 | "% compatível" é similaridade da busca; quem confirma que é a peça é a pessoa ("É esta"). |
| RN47.03 | Nenhuma imagem sem origem rastreável: toda `catalog_image` guarda domínio, URL e datas; sem licença de persistência, fica `REFERENCE_ONLY` (só a URL). |
| RN47.04 | Fontes aceitas: só domínios oficiais/autorizados da marca; nunca Pinterest, Instagram, blogs, fóruns ou marketplaces desconhecidos. |
| RN47.05 | Descoberto ≠ persistido: o resultado externo só entra no catálogo quando alguém o escolhe. |
| RN47.06 | Nunca inventar marca ou produto: sem evidência, a busca devolve vazio (marca fica `UNKNOWN`/não identificada). |
| RN47.07 | A ingestão é idempotente e deduplica pela ordem de identidade da seção 7. |
| RN47.08 | Fontes são revalidadas (`ACTIVE`, `UNAVAILABLE`, `SOURCE_REMOVED`, `NEEDS_REVALIDATION`); a peça da pessoa continua mesmo se a fonte sumir. |
| RN47.09 | O criador não envia foto: a imagem é a foto oficial do produto ou a ilustração da categoria; a pessoa pode trocar a foto depois, no detalhe da peça. |
| RN47.10 | A categoria só muda pelos chips de tipo ou pelo produto escolhido — nunca em silêncio. |

## 9. Critérios de aceite (resumo)

- CA01 Buscar por 2–3 informações (marca + tipo, ou nome com 3+ letras) devolve produtos ordenados por compatibilidade.
- CA02 Escolher um produto preenche o formulário e salva a peça por referência, com a variante/cor escolhida.
- CA03 Sem resultado, a tela oferece refinar, pesquisar nas lojas oficiais ou preencher os dados, na mesma etapa.
- CA04 A busca externa só mostra produtos de domínios oficiais e nunca inventa resultado.
- CA05 Produto escolhido na busca externa é encontrado localmente pelo próximo usuário.
- CA06 Seed e importação rodam duas vezes sem duplicar marcas, produtos, variantes ou imagens.
- CA07 As marcas do catálogo aparecem no Explorador com atalho para a busca catalogada.
- CA08 A etapa Peça não tem envio de foto; sem produto, a peça é salva com a ilustração da categoria.
- CA09 Marca, tipo ou "Ver todo o acervo" sem texto listam **todas** as peças da seleção, paginadas, com o total real do banco.
- CA10 Buscar → Acervo percorre o catálogo inteiro (filtros de marca e categoria, termo opcional) e leva a peça ao criador.

## 10. Testes

Java: `CatalogNormalizerTest`, `CatalogMatchScorerTest`, `OfficialCatalogDiscoveryTest`, `DedupParityTest`.
Python: `scripts/catalog/tests/test_normalize.py`. Frontend (vitest): `components/catalog/catalog-flow.test.tsx`
(busca → "É esta" → salva por referência; sem resultado → lojas oficiais → preencher os dados),
`lib/capture/capture-guides.test.ts`, fluxos RF4/RF47 em `components/shell-and-flows.test.tsx` (sem seção de foto;
salvar sem produto). Acervo inteiro (10/10/2026): `CatalogServiceTest.acervoInteiroPaginadoComTotalRealEResumo` e
`gradeDeMarcasContaTodasAsPecasEmUmaConsultaAgrupada` (Java); `catalog-brand-grid.test.tsx` (marca → acervo inteiro
paginado; "Ver todo o acervo"), `catalog-results-grid.test.tsx` (paginação ligada ao servidor),
`app/search-entities.test.tsx` (aba Acervo; "Ver peças" de marca do catálogo).
