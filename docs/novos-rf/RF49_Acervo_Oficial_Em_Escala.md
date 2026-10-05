# RF49 — Acervo oficial em escala: coleta dos sites oficiais, fotos completas, importação idempotente e busca com milhares de produtos

> 05/10/2026 · Amplia o RF47 (Acervo & Busca Catalogada). O RF47 nasceu com 11 marcas e 182 produtos semeados à mão;
> o RF49 leva o catálogo para **100 marcas e 8.810 produtos oficiais** e ajusta a busca para continuar certeira nessa
> escala. Diagramas: `docs/diagramas/RF49/` · Testes reais: `docs/testes/busca-catalogada/`.

## 1. Objetivo

Encher o catálogo global (RF47) com produtos reais das marcas — nome, marca, tipo, cor, variantes de cor, descrição,
URL oficial e foto oficial — sem digitação manual e só a partir das **fontes oficiais**, e garantir que a busca do
criador de peças encontre a peça certa (com foto) num catálogo de milhares de produtos.

## 2. O que a pessoa percebe

No criador de peças (`/pieces/new`), ao escolher o tipo, a marca e digitar como a peça se chama ("camiseta azul"),
aparecem produtos oficiais daquela marca com a **foto oficial**, o tipo certo e a cor pedida primeiro. Exemplos
verificados: Nike + "camiseta azul" → camiseta Nike azul (100%); Levi's + "calça jeans 501" → as 501 da levi.com.br;
Everlane + "moletom com capuz preto" → The Waffle-Knit Hoodie preto.

## 3. Como o acervo é montado (operador)

| Etapa | Ferramenta | O que faz |
|---|---|---|
| Marcas e fontes | `data/catalog/brands.json`, `aliases.json` | 100 marcas, 112 domínios `OFFICIAL_BRAND`/`OFFICIAL_STORE`/`AUTHORIZED_RETAILER`; apelidos ("CK", "LV", "A&F") |
| Coleta | `scripts/catalog/collect_official.py` + `providers/official_sitemap.py` | robots.txt (também no `www.`) e Crawl-delay; sitemaps de produto primeiro (`pdp`, Brasil/EUA); JSON-LD `Product`/`ProductGroup` e `og:image`; marcas em paralelo, 1 requisição por vez por site; 403/429 encerra o domínio; retomada por URLs visitadas |
| Regras de tipo | `infer_subcategory`, `clean_title`, `unsupported_reason`, `is_pack` | tipo pelo **nome** (núcleo do nome conforme o idioma; "Short-Sleeve Top" não é shorts); descrição nunca decide; roupa íntima, vale-presente e kits sem tipo ficam de fora; título limpo ("\| Black" vira a cor) |
| Revisão | `recheck_collected.py` | reaplica as regras atuais aos arquivos já coletados (tipo, título, foto http→https) |
| Fotos | `enrich_images.py` | revisita a página oficial dos produtos sem foto: foto das variantes de cor (Nike, Shopify), `og:image`, servidores de imagem da plataforma da loja (VTEX, Shopify, Kering, Thron, Bynder…) |
| Importação | `import_products.py` (JSON/JSONL/`.jsonl.gz`/CSV), `seed_catalog.py`, `rebuild_search_index.py` | dedup gtin › ean › upc › sku › código › URL canônica › marca+subtipo+modelo+variante › marca+subtipo+título+cor; transação por produto; `--dry-run`; relatório |
| Produção | `scripts/catalog/import_railway.sh` + `data/catalog/acervo/*.jsonl.gz` | seed → acervo → índice no MySQL do Railway, usuário `fai_app` com TLS, senha só por `RAILWAY_MYSQL_APP_PASSWORD`, acesso por TCP proxy temporário |

## 4. Busca em escala (backend)

`CatalogService` (`GET /api/catalog/search`):
- **Tipo pela frase mais longa** do texto ("moletom com capuz" = hoodie, não "moletom" + "capuz").
- **Pool de candidatos priorizado** (200 por consulta, antes eram 200 em ordem arbitrária): subtipo + cor (no produto
  ou numa variante, `CatalogProductRepository.candidatesWithColor`) → subtipo → palavras da estampa em pt/en/es
  (`patternTerms`) → pool geral; reforço quando o pool tem menos de 8.
- **Ordem**: produto sem foto oficial cede até 10 pontos (`NO_PHOTO_PENALTY`) para o que tem foto; o "% compatível"
  mostrado não muda.

## 5. Regras de negócio

- RN49.01 — Só fontes oficiais ou autorizadas cadastradas para a marca (herda RN47.04); nunca segue link ou
  redirecionamento para outro domínio.
- RN49.02 — robots.txt e Crawl-delay são lei; 401/403/429 encerram o domínio na hora, sem insistir.
- RN49.03 — Só dados estruturados publicados pela marca (JSON-LD/OpenGraph); nada de HTML livre.
- RN49.04 — Foto só como referência (URL, `REFERENCE_ONLY`), do domínio oficial, de host com o nome da marca ou do
  servidor de imagens da plataforma da loja; domínios bloqueados (Pinterest, marketplaces…) nunca passam.
- RN49.05 — O tipo vem do nome do produto; sem tipo reconhecido o item é descartado (nunca chutado); marca da página
  diferente da fonte é descartada.
- RN49.06 — Importação idempotente: rodar de novo não duplica; colorações do mesmo modelo viram variantes.
- RN49.07 — Na busca, o subtipo lido do texto pontua e prioriza o pool, mas não filtra (herda RN47.11).
- RN49.08 — Credenciais de banco só por variável de ambiente; acesso externo ao banco de produção só temporário e
  removido ao fim da importação.

## 6. Critérios de aceite

| CA | Critério | Situação |
|---|---|---|
| CA01 | coletar produtos de todas as marcas cujo site permite robôs, com retomada e relatório por domínio | pronto (46 marcas com produtos; 25 domínios recusaram robôs e foram respeitados) |
| CA02 | nenhum item com tipo chutado, roupa íntima, kit sem tipo ou marca divergente | pronto (`recheck_collected.py`; testes) |
| CA03 | ≥ 90% dos produtos coletados com foto oficial | pronto (95%: 8.357 de 8.810) |
| CA04 | importar sem duplicar; segunda rodada só atualiza | pronto (0 criados na reimportação) |
| CA05 | busca com tipo + marca + nome traz a marca certa, o tipo certo, a cor pedida e foto no topo | pronto (12/12 buscas reais) |
| CA06 | acervo carregado no MySQL de produção (Railway) | **pendente** (aguarda a senha do `fai_app` no ambiente da sessão) |

## 7. Limitações conhecidas

- Sites que recusam robôs ficam fora (adidas, Zara, Lacoste, Louis Vuitton, Reserva, Converse/Vans dos EUA…); essas
  marcas só têm os produtos do seed, sem foto.
- Dolce & Gabbana não declara foto nos dados estruturados (0 de 290 com foto).
- Cores fora da taxonomia ("Bone", "Rosewood") não agrupam variantes por URL e aparecem como bolinhas vazias no card.
- Estilo, ocasião e preço ainda não são guardados no catálogo (proposta na auditoria da taxonomia).

## 8. Outras mudanças desta sessão (registradas nos RFs de origem)

| Onde | Mudança |
|---|---|
| RF47 | criador de peça em etapa única sem foto; leitura das características da peça pelo texto (`CATALOG_TEXT_INTERPRETER`); design gravado no produto (V36) |
| RF18 | Provador virtual de lojas com o catálogo e ambiente 3D por marca |
| RF4 | rotas sem uso removidas: `GET/PUT /api/me/capture-tutorial` e `POST /api/pieces/analysis` (análise segue em `/batch` e `/multi`); V32 remove `user_preferences.capture_tutorial_json` |
| Integração | correção do merge do main (#117): mensagens perdidas, Flyway duplicado (V33–V35), `DemoFixtures` no Jackson 3 |
| Documentos | Termos de Uso e Política de Privacidade v1 (`docs/legal/`), proposta RF48 de resgate/doação de FAI Points, RF41 v2 (pontos em todos os RFs), plano de assinatura e monetização (`docs/negocio/`) |

## 9. Dependências

RF47 (catálogo e busca), RF18 (provador usa o catálogo), RF24 (motor de IA da leitura do texto), RF14/RF26 (marcas e
Explorador).
