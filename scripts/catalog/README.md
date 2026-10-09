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
**V57** adiciona os índices de EAN/UPC e dos identificadores de variantes que faltavam. Atualize a API para executar
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
# Após atualizar o código e aplicar V57 pelo Flyway, execute novamente o mesmo comando:
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
`"collector": {"product_patterns": ["/p/"], "sitemap_patterns": ["product"]}`.

O coletor precisa de acesso direto aos sites das marcas. No ambiente de desenvolvimento em nuvem do projeto, o proxy
bloqueia esses domínios: o relatório mostra `PAROU: … sem conexão`. Rode-o numa máquina com internet aberta.

## Quadro do editor por categoria (3:4, 50%)

Após compilar o JAR atual e instalar `requirements-images.txt`, execute na raiz:

```bash
python3 scripts/catalog/process_catalog_images.py --database --apply --category-frame \
  --output data/catalog/frame-34-50.xlsx --workers 4 --java-threads 2
```

Use primeiro `--limit 20` e um arquivo de saída diferente para conferir uma amostra.
O modo grava `crop_json` para exibição sem substituir imagens originais. 50% é a
largura normalizada do quadro, como no controle do editor, e não ocupação da peça.
Camisas e acessórios usam o centro da caixa do produto. Partes de baixo e calçados
usam a região de foco existente como estimativa do zíper/cadarço e ficam em
`NEEDS_REPROCESSING` para revisão: o analisador não confirma esses landmarks.
Categorias não previstas e fotos onde o quadro de 50% não cabe são reportadas
como erro, sem atualização. Revisões humanas e processamento ativo são preservados.
O modo é explícito e não muda o pipeline automático da API. A versão dos metadados
é `CATALOG_FRAME_34_50_V1`; checkpoints guardam a análise original, para reaplicar
as regras sem baixar novamente. No Railway, execute em um job com o checkout,
Python, Java, JAR compilado e as mesmas variáveis MySQL do backend; o container
atual da API não deve ser presumido como contendo os scripts e suas dependências.
