# FashionAI Catalog Ingestion Pipeline (RF47)

Bootstrap, ingestão incremental e manutenção do **catálogo global** (`catalog_products`, `catalog_variants`,
`catalog_images`, `catalog_sources`, `brand_aliases`). As regras de normalização e deduplicação são as mesmas do
backend Java (`CatalogIngestService` / `CatalogNormalizer`), lidas do mesmo arquivo
`fai-application/src/main/resources/catalog/normalization.json`.

```bash
pip install -r scripts/catalog/requirements.txt
export MYSQL_HOST=... MYSQL_PORT=3306 MYSQL_DATABASE=fashionai MYSQL_USER=fashionai MYSQL_PASSWORD=...   # mesmas variáveis do backend

python scripts/catalog/seed_catalog.py --dry-run          # valida, normaliza e mostra o que faria (nada gravado)
python scripts/catalog/seed_catalog.py                    # bootstrap: marcas, apelidos, fontes oficiais, produtos
python scripts/catalog/seed_catalog.py                    # de novo: 0 criados, tudo "skipped" (idempotente)
python scripts/catalog/import_products.py lote.json       # ingestão incremental (JSON, JSONL ou CSV), --verbose, --dry-run
python scripts/catalog/import_products.py lote.csv --no-create-brands --overwrite
python scripts/catalog/rebuild_search_index.py            # recalcula search_text (FULLTEXT ngram)
python scripts/catalog/revalidate_catalog.py --limit 200  # HEAD nas fontes: ACTIVE / UNAVAILABLE / SOURCE_REMOVED / NEEDS_REVALIDATION
python -m unittest discover -s scripts/catalog/tests      # testes sem banco (inclui paridade de dedup com o Java)
```

| Regra | Como |
|---|---|
| Idempotência | find-or-create por `slug`/`alias_norm` (marca), `(brand, domain)` (fonte), identificador forte › `dedup_key` (produto), `(product, variant_key)`, `(product, hash da URL)` |
| Dedup | gtin › ean › upc › sku › código › URL canônica › marca+subcategoria+modelo+variante › marca+subcategoria+título+cor; identificadores também procurados nas variantes; mesmo modelo com outra cor vira **variante** |
| Validação | taxonomia (categoria/subcategoria/cor/material/gênero), URL https, GTIN numérico, fonte oficial cadastrada para `OFFICIAL_*`; domínios bloqueados (Pinterest, Instagram, marketplaces…) |
| Origem | toda imagem guarda domínio, URL do produto, tipo da fonte, `retrieved_at`/`last_verified_at`; `REFERENCE_ONLY` salvo `allows_image_persistence` na fonte |
| Transações | uma por produto (marca + produto + variantes + imagens): falha = rollback só daquele item; o lote segue |
| Relatório | `total_read · created · updated · skipped · duplicates_found · errors` + `[CREATE]/[UPDATE]/[DUP]/[ERROR]` no log; execução gravada em `catalog_ingestion_runs` |
| Segurança | credenciais só por variável de ambiente; nada de senha/connection string nos logs |

## Importações longas no Railway: velocidade e recuperação

A deduplicação reúne as buscas por identificadores do produto, variantes e chave normalizada em uma consulta
`UNION ALL`, preservando a prioridade GTIN → EAN → UPC → SKU → código → URL → variantes → chave. A migração
**V61** adiciona os índices de EAN/UPC e dos identificadores de variantes que faltavam. Atualize a API para executar
o Flyway antes de importar um acervo grande com essa versão; sem os índices, esses ramos podem varrer tabelas.
`--skip-existing` mantém os caches de marca/fontes/apelidos e a leitura em lote dos filhos; fotos e variantes novas
continuam sendo inseridas. `--batch-size` controla só o progresso no terminal, não a transação nem o paralelismo.
O cabeçalho deve mostrar **`CATALOG_IMPORT_V2`**. Se não aparecer, você ainda está executando os scripts antigos,
mesmo que tenha reiniciado o terminal ou a importação. O wrapper avisa quando o schema ainda não chegou à V57.

`InterfaceError: (0, '')` significa que o PyMySQL está tentando usar uma conexão fechada. O erro de transporte que a
fechou pode ter sido ocultado por um segundo erro durante o rollback. O importador agora preserva a causa original,
reconecta e repete **a transação inteira** do produto, com até três reconexões e esperas de 1, 2 e 4 segundos.
Não faz ping em cada produto. Erros de validação/SQL continuam no relatório e não entram nessa repetição.
Se o banco continuar indisponível, o lote para no item afetado e imprime o relatório parcial, em vez de descartar
as milhares de linhas seguintes tentando usar o mesmo socket. A gravação final do relatório também é recuperável
e usa o mesmo identificador em todas as tentativas, evitando dois registros se a resposta do COMMIT se perder.

```bash
# Após atualizar o código e aplicar V61 pelo Flyway, execute novamente o mesmo comando:
bash scripts/catalog/import_railway.sh HOST_DO_PROXY PORTA_DO_PROXY
# Ou, com MYSQL_* já configuradas:
python scripts/catalog/import_products.py data/catalog/acervo/*.jsonl.gz --skip-existing --batch-size 1000
```

Produtos já confirmados no banco são preservados e as linhas que faltavam são importadas. Não existe checkpoint
por número de linha: a retomada relê o arquivo e deduplica pelo banco. Não apague registros nem recomece com
`--overwrite`. Se o servidor confirmou um produto mas a resposta do COMMIT se perdeu, a tentativa recuperada pode
aparecer como `SKIP`: os contadores representam o resultado final observado, sem contar duas vezes a mesma linha.
`MYSQL_READ_TIMEOUT` e `MYSQL_WRITE_TIMEOUT` valem 60 segundos por padrão, com conexão inicial limitada a 15 segundos.
Os limites de rede e a repetição tratam quedas; a causa exata no servidor/proxy exige seu log do momento da primeira falha.

Dados do seed em `data/catalog/` (`brands.json`, `aliases.json`, `products/<marca>.json`; `samples/` tem um CSV com
erros propositais). As marcas semeadas aparecem no **Explorador › Buscar marcas & lojas** mesmo sem perfil cadastrado.

## Coletor oficial (crescer o acervo para dezenas de milhares de nomes)

`collect_official.py` lê os **sites oficiais** das marcas cadastradas em `data/catalog/brands.json` e grava um JSONL
por marca em `data/catalog/collected/` (fora do git). A importação continua sendo o `import_products.py`, com dry-run,
validação e dedup. Busca na web genérica **não** serve de fonte: devolve sobretudo marketplaces, que o RN47.04 proíbe.

```bash
python scripts/catalog/collect_official.py --brands nike,adidas --max-per-brand 3000 --dry-run   # testa sem gravar
python scripts/catalog/collect_official.py --max-per-brand 2000 --min-interval 2                # todas as marcas
python scripts/catalog/import_products.py data/catalog/collected/*.jsonl --dry-run
python scripts/catalog/import_products.py data/catalog/collected/*.jsonl
```

| Regra | Como |
|---|---|
| Fontes | só domínios `OFFICIAL_BRAND` / `OFFICIAL_STORE` / `AUTHORIZED_RETAILER` da marca; nunca segue link nem redirecionamento para outro domínio |
| robots.txt | URL bloqueada para o User-Agent do coletor não é baixada; `Crawl-delay` respeitado (nunca abaixo de `--min-interval`); robots 401/403 = não coleta |
| Educação | uma requisição por vez por domínio; 403/429 encerra o domínio na hora; novas tentativas só em 5xx/timeout |
| Dados | só dados estruturados publicados pela marca: JSON-LD schema.org `Product`/`ProductGroup` (variantes de cor em `hasVariant`) ou OpenGraph `og:type=product`; nada de HTML livre |
| Taxonomia | subtipo inferido do nome/categoria da página; sem subtipo reconhecido o item é descartado (nunca chutado); marca da página diferente da fonte = descartado |
| Imagens | só URL (REFERENCE_ONLY), do domínio oficial ou do CDN da marca (`static.nike.com`); nenhuma imagem é baixada |
| Retomada | `data/catalog/collected/.state/<marca>.visited`: rodar de novo continua de onde parou; `--fresh` recomeça a marca |
| Saída | cada linha já passa por `normalize_product` (o que não passaria na importação nem é gravado) |

Para chegar a ~20.000 nomes: são 11 marcas e 18 domínios oficiais hoje; `--max-per-brand 2000` cobre a meta se os
sitemaps tiverem produtos suficientes. Mais marcas = mais linhas em `brands.json` (com as fontes oficiais). Quanto se
coleta depende do que cada site publica no sitemap e libera no robots.txt; sites que bloqueiam robôs ficam de fora, e
o relatório diz por quê. Para sites com URLs de produto fora do padrão, `brands.json` aceita
`"collector": {"product_patterns": ["/p/"], "sitemap_patterns": ["product"]}`. Padrão com o prefixo `re:` é expressão
regular sobre a URL original, para lojas cuja página de produto só se reconhece pelo formato (Guess:
`"re:/en-us/.+/[A-Z0-9]+-[A-Z0-9]+\\.html$"`, só a loja dos EUA, sem repetir cada peça em en-ca/fr-ca).

O coletor precisa de acesso direto aos sites das marcas (no ambiente em nuvem, só com a rede liberada nas
configurações do ambiente; sem isso o relatório mostra `PAROU: … sem conexão`).

Detalhes que já derrubaram marcas inteiras e hoje são tratados (com teste em `tests/test_official_sitemap.py`):

| Caso | Tratamento |
|---|---|
| Servidor responde gzip mesmo com `Accept-Encoding: identity` (Mizuno, Dudalina, Olympikus, Track & Field, John John, Hope, Le Lis, Sergio K) | o corpo é descomprimido (`decoded`); antes a página chegava comprimida e parecia não ter dado estruturado |
| Sitemap que é um `<urlset>` de outros sitemaps (Diesel, Carhartt WIP) | URL terminada em `.xml`/`.xml.gz` vira sitemap a ler, nunca página de produto |
| Sitemap do próprio site declarado em `http://` (Aéropostale) | lido em `https://` |
| Fotos em servidor de imagem de plataforma (Amplience da Dr. Martens, Nuvemshop da Amaro) | `STORE_IMAGE_HOSTS` (igual no Java, `OfficialCatalogDiscovery`) |
| robots.txt que redireciona para HTML, atributos HTML sem aspas, JSON-LD com entidades | ver histórico do arquivo |
| 150 páginas seguidas sem dado estruturado | o domínio é largado (`GIVE_UP_AFTER`), sem gastar milhares de requisições |

#### Custo medido em CPU (2026-10-24, máquina de 4 núcleos / 15 GB)

Por foto, sem GPU: segmentador de roupa (u2net_cloth_seg) 4–14 s, parser humano 11–22 s, download < 0,5 s. Cada
processo ocupa ~5 GB (modelos + torch), então cabem **2 processos** em 15 GB (4 estouram a memória). `--measure-only`
sem parser: ~13 s/foto por processo → ~6,5 s/foto com dois → ~7 h para 8 mil fotos. Com parser, ~3× isso. Para o
catálogo inteiro, rode na máquina do lote com GPU (`CATALOG_PHOTO_DEVICE=cuda`; o parser cai para < 1 s) ou divida em
fatias de JSON (`--input`) em máquinas diferentes; `report.jsonl` é retomável (basta tirar do JSON o que já tem linha).

### Parser humano local (recomendado para foto com modelo)

Sem ele, o segmentador de roupa pode incluir um antebraço na classe "superior" e a dedução pelo primeiro plano não corrige
erro dentro da própria máscara da peça (visto na amostra de 2026-10-24: camiseta Converse com o braço do modelo). O parser
FASHN marca pele, rosto, braços e pernas e é o que `LocalClothProvider` já espera:

```bash
.venv/bin/pip install "fashn-human-parser @ git+https://github.com/fashn-AI/fashn-human-parser.git@f2771f2fb8655349e87e2869bbde7ace0bd06f2c"
# pesos públicos (fashn-ai/fashn-human-parser; revisão e sha256 em services/anatomical_vton/fashn_assets.json) numa pasta FORA do repositório:
#   model.safetensors (256 MB), config.json e preprocessor_config.json
CATALOG_PHOTO_PARSER_WEIGHTS=/caminho/para/parser CATALOG_PHOTO_DEVICE=cpu .venv/bin/python scripts/catalog/process_local_sd.py --limit 20 --dry-run
```

Com o parser, `maskSource` vira `u2net_cloth_seg+fashn_human_parser`, a máscara de corpo deixa de ser heurística e a
região fantasma passa a cobrir exatamente a pele visível. Confira a licença dos pesos antes de distribuí-los.

## Busca melhorada (2026-10-24): páginas de categoria, `sitemap_index.xml` e marca da licenciada

Três causas de "0 produtos" em marcas com site acessível, e o que o coletor passou a fazer — sempre dentro das regras
(robots.txt, só o domínio oficial, só dados estruturados, 403/429 encerram o domínio):

| Causa | Marcas | Solução |
| --- | --- | --- |
| Sitemaps só de categoria (ou nenhum sitemap) | C&A, Balenciaga, Birkenstock, Patagonia | `crawl_categories`: quando os sitemaps não rendem produto, o coletor lê até 40 páginas de categoria (as vistas nos sitemaps ou a página inicial), segue os links de produto (por pista na URL ou, sem pista, os links "folha") e cada página passa pelos mesmos dados estruturados |
| Índice em `/sitemap_index.xml` sem declaração no robots | Superdry, Birkenstock | além de `/sitemap.xml`, tenta `/sitemap_index.xml` |
| Loja oficial que escreve a licenciada como marca do produto | Scotch & Soda ("United Legwear") | `collector.accept_page_brands` em brands.json: só esse nome, só nessa marca; outra marca na página continua recusada |
| Domínio cadastrado só redireciona para outro | Scotch & Soda (`scotch-soda.com` → `scotchandsoda.com`), Puma (`puma.com` → `us.puma.com`) | cadastrar o domínio que responde (o coletor nunca segue redirecionamento para fora do domínio pedido) |

Fora de alcance, documentado: 403 no robots ou nas páginas (Adidas, Zara, Lacoste, Guess, Converse US, ASICS US, Fred
Perry, Hoka, Coach, Kate Spade, Saint Laurent, Salomon, Reiss, Reserva, Youcom, Gymshark, Dr. Martens, Cariuma);
páginas de produto renderizadas só por JavaScript, sem JSON-LD/OpenGraph (Converse BR, Supreme, Aéropostale); Louis Vuitton
sem sitemap nem categorias legíveis; Uniqlo sem resposta (timeout).

## Do coletado ao acervo

```bash
python scripts/catalog/recheck_collected.py                      # regras de tipo atuais nos JSONL (com o coletor parado)
python scripts/catalog/build_acervo.py --out data/catalog/acervo/acervo-oficial-AAAA-MM-DD.jsonl.gz data/catalog/collected/*.jsonl
```

Execução de 24/10/2026 (55 marcas sem peças → 32 com produto, 7886 peças): `docs/catalogo/COLETA_2026-10-24.md`.

`build_acervo.py` passa cada linha pelas regras de tipo e pelo `normalize_product`, deixa a descrição em texto puro e
tira as peças que já estão em outro arquivo de `data/catalog/acervo/` (mesma URL canônica): cada arquivo traz só peças
novas. O gzip sai sem data no cabeçalho (mesmo conteúdo, mesmo arquivo). O `import_railway.sh` importa todos os
arquivos da pasta com `--skip-existing`.

## Reparo: produtos agrupados pela URL antiga (Gap `?pid=`)

Até 10/10/2026 a URL canônica descartava a query inteira. A Gap identifica cada peça só por `?pid=`
(`gap.com/browse/product.do?pid=…`), então as 248 linhas da Gap no acervo caíam no mesmo produto, que juntava as fotos
de todas (839 fotos num produto só). A regra nova mantém os parâmetros de identidade (`IDENTITY_PARAMS`: pid,
productid, product_id, prodid, itemid, item_id, styleid, style_id, skuid) em `normalize_product.py` e
`CatalogNormalizer.java`, mas um banco que já importou o acervo continua com o produto agrupado. Para consertar:

```bash
python scripts/catalog/repair_merged_products.py                                    # só relata, nada é gravado
python scripts/catalog/repair_merged_products.py --reimport data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz --dry-run
python scripts/catalog/repair_merged_products.py --apply --reimport data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz
```

| Passo | O que faz |
|---|---|
| Detecta | produto visível com URL canônica sem identificador e fotos vindas de 2+ páginas que a regra nova separa (cada foto guarda a página de origem em `source_url`) |
| Esconde (`--apply`) | `ingestion_status = REJECTED`; nada é apagado, e peças de guarda-roupa que apontam para ele continuam válidas (o relatório diz quantas) |
| Reimporta (`--reimport`) | só as linhas das peças agrupadas, com `--skip-existing`: uma peça por página, cada uma com a própria foto |
| Idempotente | rodar de novo não encontra mais nada |

Simulação com as 248 linhas reais da Gap (teste em `tests/test_repair_merged.py` e banco SQLite descartável): antes,
1 produto com 839 fotos; depois, 248 peças com 1 a 4 fotos cada, nenhuma sem foto. Gravar na produção exige rodar
com as variáveis `MYSQL_*` do backend e `--apply`.

## Quadro do editor por categoria (3:4 preenchido — V4)

Compile o JAR atual (`mvn -q -DskipTests package`, Java 21) e instale
`python3 -m pip install -r scripts/catalog/requirements-images.txt`.
O script exige `fabricFrameVersion` no JAR e rejeita checkpoints de outra versão.
Execute primeiro uma amostra:

```bash
python3 scripts/catalog/process_catalog_images.py --database --apply --category-frame \
  --limit 20 --workers 4 --java-threads 2 --output data/catalog/frame-34-v4.xlsx
```

O modo gera um JPEG 900×1200 e substitui a foto ativa por um arquivo no S3,
verificando o conteúdo por SHA-256 antes de atualizar `stored_url`/`assets_json`.
O card usa `PROCESSED`, sem aplicar o recorte novamente. A URL de origem e o
objeto anterior ficam preservados para recuperação; não sobrescreve arquivos
em servidores das marcas. Só fontes com `allows_image_persistence` habilitado
e domínio correspondente podem persistir imagens (ou a decisão explícita
`--force-category-frame`, ver `docs/catalogo/PROCESSAR_ACERVO_IMAGENS.md`). O domínio
é normalizado (maiúsculas/`www.`) e também reconhece subdomínios da fonte na URL da
foto, com a mesma regra de limite entre nomes usada pela API. Configure `S3_BUCKET`,
`S3_ENDPOINT`, região e credenciais, mais `STORAGE_PUBLIC_BASE_URL` (HTTPS) ou
`S3_SERVE_THROUGH_API=true` com `APP_BASE_URL` (HTTPS) para o bucket privado. Antes
de ler o banco ou iniciar o Java, o modo confere `MYSQL_HOST`, `MYSQL_DATABASE`,
`MYSQL_USER`, `MYSQL_PASSWORD` (aceitando os nomes do Railway), `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e a URL pública do bucket, e para com a
lista das variáveis que faltam — só os nomes, nunca os valores (código de saída 2).

A política `PIECE_FILLED_100` usa `FabricFrame`: o quadro é 3:4 e cada pixel
pertence à peça. A máscara exclui fundo, pele e outras peças e é erodida antes
do recorte. Sem região válida, nenhuma imagem nova é gerada, inclusive com
`--force-category-frame` (`FRAME_UNAVAILABLE:<motivo>`).

| Categoria | Foco |
|---|---|
| Parte superior | Gola |
| Parte inferior | Zíper/braguilha; peças sem zíper usam o painel abaixo do cós |
| Acessório | Centro |
| Calçado | Logo |
| Peça única | Corpete |

Focos sem landmark são registrados como estimados, sem afirmar identificação
visual confirmada. A peça ocupa o quadro sem padding ou margens de fundo.
A versão é `CATALOG_FRAME_34_FILLED_V4`; V1/V2/V3 são reavaliadas. Se uma
foto com quadro antigo não admitir a nova regra, a referência pode voltar ao
original preservado, com a decisão auditada `REVERTED_TO_ORIGINAL`. Não apaga
os objetos anteriores do S3. Revisões humanas e processamento ativo são
preservados pela gravação do lote.

O clique em **É esta** pede uma nova análise da foto original ao backend,
sem reutilizar análise em cache, e aplica o recorte semântico ao card. O lote
continua responsável pela geração do JPEG no S3. Se a verificação falhar,
a seleção não é concluída silenciosamente. Fotos recusadas pela revisão
não são reabilitadas por essa ação.

O progresso distingue análises Java concluídas de resultados prontos para
gravação, com motivos individuais e resumo `failure_reasons`. No Railway,
o job precisa dos scripts, dependências Python e JAR compilado; o container
da API não deve ser presumido como contendo essas ferramentas.

## Peça inteira (Total frame processado — `WHOLE_FRAME_V2`)

Equivalente ao quadro de Tecido, mas com a peça INTEIRA: o segmentador de roupa separa a peça do corpo (pele, cabelo,
outras roupas) e do fundo da marca; a peça vai para um quadro 3:4 de 900×1200 em fundo claro, com a margem do Total frame
(até 76% da largura e 74% da altura). Lado cortado na foto encosta só naquela borda. Vale também para foto com modelo.

```bash
pip install -r scripts/catalog/requirements-whole.txt   # rembg local (u2net_cloth_seg + isnet-general-use)
python scripts/catalog/process_whole_frames.py --limit 20 --out-dir /tmp/whole-preview   # ensaio: só prévias + auditoria
python scripts/catalog/process_whole_frames.py --apply --limit 500                      # envia e grava (com autorização)
```

- Entrada: foto canônica aprovada (`catalog_images`), categoria/subcategoria e os sinais da análise do Tecido
  (`metrics_json.debug.productFrame.model`, `sourceHumanEvidence`, `truncated`).
- Foto com pessoa usa só a classe de roupa da categoria (cima, baixo ou corpo inteiro); foto de produto e calçado/acessório
  usam o recorte geral. Tudo roda na máquina do lote: foto com pessoa nunca vai para serviço externo.
- Saída: `catalog/whole/<uuid>/<sha256>.jpg` (mesmo armazenamento e verificação do Tecido) em `catalog_images.whole_url`,
  com `whole_json` (caixa da peça no quadro, fundo, lados cortados, escala), `whole_status` e `whole_pipeline_version` (V75).
  A gravação confere `source_sha256` e incrementa `version` (a linha mudou desde a análise → pulada).
- A API devolve `catalogImage.whole` com `processed: true`; a Peça inteira da interface usa essa imagem.

## Peça inteira LOCAL com Stable Diffusion — `process_local_sd.py` (sem API paga)

O lote de packshot por API externa parou por falta de créditos; este é o substituto que roda na máquina do lote
(CUDA em fp16, Apple Silicon/MPS e CPU em fp32), gravando `catalog_images.processed_image_url`. **A interface ainda não
lê essa coluna** (decisão do responsável): o resultado fica disponível no banco e em `./output_images/` para revisão.

```bash
python3 -m venv .venv && .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu   # ou a build CUDA/MPS da sua máquina
.venv/bin/pip install -r scripts/catalog/requirements-sd.txt
export DATABASE_URL='mysql+pymysql://usuario:senha@host:3306/fashionai'      # ou as MYSQL_* do backend; nada no código
.venv/bin/python scripts/catalog/process_local_sd.py --measure-only --limit 5000   # 1. só mede: ineligible.json para a quarentena
.venv/bin/python scripts/catalog/process_local_sd.py --limit 20 --dry-run          # 2. ensaio: PNGs em ./output_images, sem UPDATE
.venv/bin/python scripts/catalog/process_local_sd.py --limit 200                   # 3. gera e grava processed_image_url
```

Por foto: download (link direto ou `og:image` de página HTML; polidez por host e espera em 429) → rembg local pela classe
de roupa (calçado/acessório: recorte geral; sem o parser humano configurado, o corpo é deduzido como primeiro plano geral
menos a peça — `--no-foreground-body` desliga) → limpeza da máscara (pessoa, outras peças, riscos fora do perímetro) e medição — **altura da peça < 25% da foto =
INELIGIBLE**, nada é gerado nem apagado (`ineligible.json` alimenta `quarantine_unsafe_products.py`) → inpainting SÓ na região
fantasma (corpo visível por dentro da peça: gola entre os ombros, punhos, barra, entre as pernas) com
`stable-diffusion-v1-5/stable-diffusion-inpainting` (o `runwayml/…` saiu do ar; `--model` aceita o SDXL inpainting e
`--controlnet` o `control_v11p_sd15_inpaint`) → composição: tecido ORIGINAL preservado pixel a pixel, fundo branco, peça
centralizada com a maior aresta em 50% do quadro 900×1200 e sombra suave → PNG `{marca}_{categoria}_{produto}_{imagem}.png`
+ `.json` de evidências → `UPDATE` só se a coluna ainda estiver vazia. `report.jsonl` e `metadata_clean.json` registram
cada foto (RENDERED, REJECTED, REVIEW, INELIGIBLE, RETRY, FAILED); uma falha não para o lote e a memória do acelerador é
liberada a cada foto. `--no-ai` dá só o recorte; `--public-base-url` grava URL em vez de caminho local; `--table products`
atende a tabela genérica do roteiro original.

## Auditoria e direitos de persistência

Consulte `docs/catalogo/AUDITORIA_PERSISTENCIA_PIPELINE.md` para a investigação,
limites da validação, fila administrativa e execução controlada. Proveniência
não autoriza um host terceiro. O inventário SQL fornece fontes da mesma marca;
Python aplica uma única política no preflight e na transação. A flag FALSE
legada é UNKNOWN (o schema não registra uma negativa explícita). CDN terceiro
precisa de cadastro específico com direito de persistência.

Antes de qualquer lote, execute `audit_catalog_persistence.py --output ...json`.
Sem `--apply`, o processador principal não baixa, analisa, grava S3 ou altera
MySQL. `--authorized-only --limit 20` prepara amostra de produtos elegíveis com
seu inventário completo, para não invalidar a transação por seleção parcial.
Novos objetos usam chaves exclusivas; falhas conhecidas removem apenas objetos
sem referências confirmadas. Em COMMIT incerto/DB indisponível, a limpeza fica
pendente para auditoria. `audit_catalog_storage.py` lista candidatos e nunca exclui.


### Coleta e importação contínua

`collect_official.py` coleta JSONL em `data/catalog/collected/`; coletar não
insere produtos no MySQL. O glob `data/catalog/acervo/*.jsonl.gz` tampouco lê
os arquivos dessa pasta. Para importar os registros completos enquanto a
coleta continua, abra outro terminal com o mesmo ambiente virtual e MYSQL_*:

```bash
python3 scripts/catalog/sync_collected.py --watch
```

O sincronizador usa o importador existente, ignora produtos já cadastrados,
espera a quebra de linha antes de ler um registro e salva seu deslocamento
somente após a transação. O processo é exclusivo por pasta/checkpoint e pode
ser interrompido e retomado. Sem `--watch`, faz apenas uma passagem.
As telas consultam novamente o acervo ao voltar à aba e periodicamente quando
visíveis. Produtos recusados continuam fora do catálogo disponível; o resumo
separa o total cadastrado do disponível, sem inventar contagens.
