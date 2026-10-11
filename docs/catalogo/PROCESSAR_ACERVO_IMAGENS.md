# Inventário e padronização das imagens da Busca Catalogada

O relatório completo usa o MySQL atual. A busca HTTP devolve no máximo 48
resultados e não oferece cursor, por isso não serve como inventário do acervo.
O script consulta produtos visíveis na busca e suas imagens em uma transação
somente de leitura, com paginação por chave. Produtos sem foto também entram
no relatório. Cada imagem tem sua própria linha; uma peça pode ter várias.

```bash
python -m pip install -r scripts/catalog/requirements-images.txt
# Java 21 e o backend já compilado são necessários somente para --apply.
mvn -DskipTests package

# MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD
# devem estar nas variáveis do ambiente; não use a senha como argumento.
python scripts/catalog/process_catalog_images.py --database \
  --output /tmp/catalogo-imagens.xlsx

# Analisa as pendentes e grava metadados e escolha da imagem canônica.
python scripts/catalog/process_catalog_images.py --database --apply \
  --workers 4 --java-threads 2 --output /tmp/catalogo-imagens.xlsx
```

O runner também aceita as variáveis nativas do Railway `MYSQL_PUBLIC_URL`,
`MYSQLDATABASE` e `MYSQL_APP_PASSWORD`. `MYSQL_PUBLIC_URL` aceita uma URL
`mysql://host:porta/banco`, o endereço `host:porta` ou `//host:porta`; quando o
endereço não inclui banco, informe `MYSQLDATABASE` ou `MYSQL_DATABASE`.
Usa o host/porta do proxy público e o
usuário `fai_app`, como `import_railway.sh`, com TLS. Não extrai a senha de root
da URL pública nem utiliza `MYSQL_ROOT_PASSWORD` implicitamente. Variáveis
explícitas `MYSQL_*` continuam tendo prioridade. A rede precisa permitir o host
do proxy TCP e os domínios oficiais/CDNs das imagens. Liberar o domínio da API
por HTTPS não comprova conectividade MySQL.

O modo de arquivo serve para rastrear referências coletadas e testar o pipeline
localmente. Ele não consulta nem atualiza produção:

```bash
python scripts/catalog/process_catalog_images.py \
  --snapshot data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz \
  --output /tmp/catalogo-snapshot.xlsx

python scripts/catalog/process_catalog_images.py \
  --snapshot data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz --apply \
  --output /tmp/catalogo-snapshot.xlsx
```

## Enquadramento por categoria em todo o acervo (`--force-category-frame`)

Decisão explícita do responsável pelo projeto (10/10/2026): para este
processamento, a autorização de persistência da fonte, o cadastro do domínio em
`catalog_sources` e a identificação visual confirmada **não bloqueiam o lote**.
Sem a opção, o comportamento padrão continua: `SOURCE_RIGHTS_UNCONFIRMED`,
`SOURCE_HOST_NOT_REGISTERED` e `INVALID_IMAGE_AUTHORITY` impedem o upload e a
gravação, e nenhuma permissão de `catalog_sources` é alterada pelo script.

A opção exige `--database --apply --category-frame`. Nesse modo:

- A decisão fica registrada em cada imagem (`assets_json.persistenceDecision`:
  modo `FORCED_CATEGORY_FRAME`, estado e motivo da fonte no momento, host) e a
  decisão da fonte no instante do COMMIT vai para `.changes.audit.jsonl`.
- As proteções técnicas de download não mudam: só HTTPS, sem credenciais na
  URL, porta 443, host público (DNS conferido), redirecionamentos validados,
  tipo `image/*` e até 10 MiB. URL inválida é falha técnica individual
  (`UNSAFE_IMAGE_URL`, `NON_PUBLIC_IMAGE_HOST`, `IMAGE_HTTP_404`…), e o lote segue.
- Checksums (SHA-256 da origem conferido antes de renderizar; SHA-256 do JPEG
  conferido após o upload), guardas de concorrência por produto, preservação de
  revisões humanas e limpeza só de uploads criados nesta execução e sem
  referência confirmada continuam iguais. Com COMMIT incerto nada é apagado.
- A referência ativa passa a ser a imagem enquadrada: `stored_url` e
  `assets_json.card` (que o card da busca usa, modo `PROCESSED`). A URL original
  continua em `image_url` e em `assets_json.originalUrl`; o asset anterior fica em
  `previousStoredUrl`/`previousAssets`. Nenhum objeto antigo é apagado.
- Imagens já enquadradas na mesma versão (`CATALOG_FRAME_34_PRODUCT_RULE_V3`,
  com `stored_url`, `assets_json.card` iguais e quadro da regra válido) são
  preservadas: repetir o comando só processa as pendências e as falhas.
- Imagens gravadas pelas versões anteriores — `CATALOG_FRAME_34_50_V1` (quadro de
  50% que podia mostrar fundo) e `CATALOG_FRAME_34_FABRIC_V2` (close só de tecido:
  peito, braguilha, cabedal) — contam como **não padronizadas** e são
  **reprocessadas** na próxima execução com a regra V3. Quem está rodando a V2
  agora pode deixar terminar: a próxima execução com o JAR novo refaz essas
  imagens (o checkpoint guardado pela V2 é descartado e a foto é analisada de novo).

### Regra de enquadramento do produto (`PRODUCT_RULE`, V3)

O quadro do lote segue **a mesma Regra de Enquadramento do Produto do card**
(`fai-application/src/main/resources/catalog/semantic-regions.json`, §9.1 do
`PIPELINE_IMAGENS_CATALOGO.md`), calculada pelo mesmo motor
(`SemanticCropper.registryRuleCrop`, usado também pelo `FeedFraming` do card de
4:5) — card e lote não divergem: só a proporção muda. O Java (`ProductRuleFrame`,
versão `PRODUCT_RULE_FRAME_V1`) devolve o quadro em `productFrame`; o Python
(`category_frame.py`) confere e grava.

**Proporção: 3:4 (900×1200), mantida.** O 3:4 é o quadro do editor pedido pelo
responsável no #218 e já usado pelas imagens V1/V2; o card não força 4:5 nas
imagens do lote: `.catalog-card-media` e o `PieceCard` usam
`photoAspect(catalogImage.aspect)`, que lê o `crop_json.aspect = "3:4"` gravado
(4:5 é só o padrão para imagem sem proporção). O registro e o `FeedFraming`
continuam 4:5; a regra é a mesma, aplicada à proporção do quadro.

| Categoria | Subcategoria | Regra (registro) | O que o quadro 3:4 mostra |
|---|---|---|---|
| `upper_piece` | camiseta, polo, camisa, moletom, suéter, jaqueta… | COVER / TOP, vista FRONT, foco na metade de cima | a peça preenche o quadro (nada de fundo), **gola/decote na borda de cima**, peito visível, mangas cortadas pelas laterais; em foto com modelo o quadro começa no decote — sem rosto nem pescoço — e não pega pele de braço |
| `full_body_piece` | vestido, macacão… | COVER / TOP | igual à parte de cima, a partir do decote |
| `lower_piece` | jeans, calça, short, bermuda, legging… | COVER / TOP, foco cós/bolsos/braguilha | **cós na borda de cima**, a peça preenche a largura, cós + bolsos + braguilha na metade de cima (do cós a 80% do gancho tudo é peça) e **as pernas seguem além da base** (o vão entre elas aparece embaixo); em foto com modelo a camisa/jaqueta acima do cós fica de fora (e a aba de jaqueta que cai sobre o quadril sai da máscara pela cor) |
| `lower_piece` | `skirt`, `skort` | COVER / TOP | cós no topo e o quadro todo é peça |
| `shoes_piece` | tênis, sapato, bota… | WIDTH / CENTER, vista SIDE | **o calçado inteiro**, o comprimento na largura do quadro (folga de 2% de cada lado), centrado na vertical, fundo em cima e embaixo |
| `accessory_piece` | bolsa, mochila, carteira, boné, chapéu | CONTAIN / CENTER (folga 2%) | **o objeto inteiro**, contido e centrado, com margem de fundo |
| `accessory_piece` | `watch` | COVER / FOCUS (mostrador) | o mostrador no centro, preenchendo o quadro (pulseira cortada) |
| `accessory_piece` | `belt` | CONTAIN / FOCUS (fivela) | o cinto inteiro; a fivela não é detectada, então o quadro centra o cinto (`FOCUS_NOT_DETECTED_CENTERED`) em vez de supor a fivela na ponta |
| `accessory_piece` | `sunglasses`, `eyeglasses` | WIDTH / CENTER | as duas lentes inteiras na largura |
| `accessory_piece` | colar, pulseira, brinco, anel, gorro, cachecol | CONTAIN / CENTER | o objeto inteiro com margem |

Joias, relógio, óculos e cinto **não são mais recusados** (a V2 os recusava
como `NOT_TEXTILE_ACCESSORY`): a regra os enquadra inteiros.

Como o quadro é calculado:

1. **Máscara da peça** (a mesma da V2): fundo de estúdio removido a partir das
   bordas (ou a máscara do segmentador, se confiante), maior componente, buracos
   com a cor do fundo fora; em foto com modelo, as manchas de pele de tamanho de
   corpo (rosto, pescoço, braços, mãos ≥ 0,15% da foto) saem da máscara.
2. **Caixa de referência** da categoria: parte de cima da gola à barra (com modelo,
   dos ombros até a primeira troca de cor depois da cintura natural); parte de
   baixo do cós (com modelo, a primeira troca **brusca** de cor subindo a partir do
   gancho: a barra da camisa, a barriga, o cinto) até a barra, na largura mediana
   do quadril; objeto: todos os pedaços relevantes (o outro pé do par, o outro
   brinco) e o que o segmentador do pipeline considera a peça.
3. **Regra do registro** sobre essa caixa (`registryRuleCrop`), em 3:4.
4. **COVER/TOP** (parte de cima/baixo): o maior quadro 3:4 até o tamanho da regra,
   centrado no eixo da peça, com o topo na faixa da gola/do cós e inteiramente
   dentro da máscara (erodida 0,3%); parte de baixo: inteiramente dentro do cós a
   80% do gancho. Com modelo, as laterais recolhem 2,5% (vão fino braço–tronco).
   **WIDTH/CONTAIN**: o quadro da regra inteiro; o que passar da foto é completado
   com a cor do fundo de estúdio de cada borda (como o smartPadding do card) e o
   recorte é arredondado **para fora** (o objeto nunca é cortado). COVER continua
   arredondando **para dentro** até o 3:4 exato.
5. **Conformidade** pelo mesmo cálculo do card (`ruleScore`): foco na metade de
   cima (parte de cima/baixo), calçado de lado (`SHOE_NOT_SIDE_VIEW`). Dúvida vira
   revisão no modo padrão e observação (`RULE_COMPLIANCE_DOUBT`) no modo forçado.

Motivos de recusa (a foto fica como está, nada é gravado, a linha sai como falha
`FRAME_UNAVAILABLE:<motivo>` e o lote segue):

| Motivo | Significado |
|---|---|
| `PIECE_NOT_ISOLATED` | calçado/acessório sobre pessoa (tênis no pé, bolsa no ombro): a caixa seria a pessoa |
| `HUMAN_IN_FRAME` | o segmentador de pessoa (quando instalado) viu pele/rosto no quadro de uma parte de cima/baixo |
| `GARMENT_NOT_ISOLATED` | parte de cima sobre modelo sem região própria (camiseta da cor do fundo; o quadro cairia na calça) |
| `WAISTBAND_NOT_FOUND` | foto com modelo em que a peça de cima cobre o cós (mesma cor, casaco por cima): o quadro não teria o cós no topo |
| `NO_COVER_WINDOW_AT_TOP` | nenhum quadro de cobertura cabe com o topo na gola/no cós (peça clara em fundo claro, estampa da cor do fundo) |
| `FRAME_TOO_SMALL` | o quadro que cabe tem menos de 90 px ou é estreito demais para a peça (< 22% da parte de cima, < 40% do quadril) |
| `PADDING_NEEDS_STUDIO_BACKGROUND` | o objeto inteiro precisaria passar da foto, mas o fundo não é de estúdio (não há cor para completar) |
| `NO_PRODUCT`, `BACKGROUND_NOT_UNIFORM`, `SEGMENTATION_FRAGMENT` | a máscara da peça não existe ou não é confiável (como na V2) |
| `COVERAGE_BELOW_100`, `OBJECT_CUT`, `INVALID_CROP`, `ASPECT_NOT_3_4`, `INVALID_RULE` | conferências do Python: quadro de cobertura com algo que não é peça, objeto cortado, recorte fora dos limites |
| `JAVA_<código>` | o Java recusou a foto antes (`IMAGE_TOO_SMALL`, `UNREADABLE_IMAGE`…) |

Em `assets_json.editorFrame` (e no `crop_json`) ficam `version`, `policy =
PRODUCT_RULE`, `rule` (`fit`, `align`, `view`, `focusTopHalf`), `fit`, `align`,
`ruleSource` (`catalog/semantic-regions.json`, versão do registro, piece_type,
subcategoria e `origin`: `pieceType` ou `subcategory:<nome>` quando a subcategoria
tem regra própria), `target`, `focus`/`focusSource`, `garmentCoverage` e
`coverageScope` (FRAME ou WAIST_TO_CROTCH), `objectInside`, `padding`,
`background`, `model`, `observations` e `decision`. O relatório ganha
`frame_fit`, `frame_align`, `frame_rule_source` e `frame_padding`; o resumo traz
`frame_unavailable` (e o nome antigo `fabric_frame_unavailable`, com os mesmos
números).

Avaliação em 75 fotos reais do acervo (as mesmas da V2, packshot e modelo), pelo
JAR e pelo `category_frame.py`: **60 receberam quadro** (V2: 37) — acessórios
23/23, calçados 6/6, parte de cima 18/24, parte de baixo 13/22 — e as folhas de
contato foram conferidas visualmente por categoria. Recusas: cós coberto pela
peça de cima (4), nenhum quadro no topo (4), quadro pequeno (3), fragmento (2),
fundo não uniforme (1), camiseta branca em fundo branco (1). Limites conhecidos:
peça clara em fundo claro, cáqui/bege em modelo (cor de pele), listras da cor do
fundo, preto sobre preto (a barra/o cós não aparecem pela cor), vão fino e claro
entre braço e tronco, acessório no corpo de uma pessoa quando a pele não destoa
da roupa, produto cadastrado na categoria errada (o quadro segue o cadastro).

### Execução no Mac

```bash
cd tcc-2026-fashion-ai-backend
python3 -m pip install -r scripts/catalog/requirements-images.txt
mvn -q -DskipTests package                      # fat JAR do backend (Java 21) — obrigatório: o JAR da V2 não tem a regra do produto (V3)

# MYSQL_HOST/PORT/DATABASE/USER/PASSWORD (ou MYSQL_PUBLIC_URL + MYSQL_APP_PASSWORD do Railway)
# S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION/S3_ENDPOINT e
# STORAGE_PUBLIC_BASE_URL (ou APP_BASE_URL com S3_SERVE_THROUGH_API=true) já exportados; nada vai na linha de comando.

# 1) amostra: 20 registros (todas as imagens dos produtos desses registros)
python3 scripts/catalog/process_catalog_images.py --database --apply --category-frame --force-category-frame \
  --limit 20 --workers 4 --java-threads 2 --output ~/catalogo/amostra-20.xlsx

# 2) acervo completo (retomável: repita o mesmo comando com o mesmo --output/checkpoint)
python3 scripts/catalog/process_catalog_images.py --database --apply --category-frame --force-category-frame \
  --workers 6 --java-threads 3 --output ~/catalogo/acervo-enquadrado.xlsx
```

Sem o JAR novo o script para antes de começar ("JAR sem a regra de enquadramento
do produto (V3)"): ele confere a capacidade `productFrameVersion` anunciada pelo
Java. Código de saída 2 significa que houve falhas individuais; o resumo JSON no
`stdout` e o `.summary.json` trazem `failure_reasons`, `frame_observations`,
`frame_unavailable` e `write_results`. Rode de novo para repetir só as pendências.
Uma recusa da V3 não apaga nada: a imagem continua com a referência que tinha
(inclusive um quadro V1/V2 já gravado), e o produto continua na busca.

### Como conferir que as imagens foram substituídas

Na planilha (aba **Acervo**): **Pipeline após a execução = Sim**, **Imagem
processada / recorte** com link `…/catalog/framed/…jpg`, **Versão do pipeline**
`CATALOG_FRAME_34_PRODUCT_RULE_V3`, **Motivo / observações** = "Enquadramento salvo no S3 e
referência ativa atualizada no banco", **Enquadramento: foco** (categoria → alvo e
origem do foco), **Enquadramento: observações** e **Dimensões (origem → saída)**.
No `.changes.audit.jsonl`, cada linha confirmada traz `before`/`after` com
`stored_url`, `assets_json` e `persistence_decision_at_commit`. No banco:

```sql
SELECT COUNT(*) FROM catalog_images
 WHERE pipeline_version = 'CATALOG_FRAME_34_PRODUCT_RULE_V3' AND stored_url LIKE '%/catalog/framed/%';
-- ainda nas versões anteriores (serão refeitas na próxima execução)
SELECT pipeline_version, COUNT(*) FROM catalog_images
 WHERE pipeline_version IN ('CATALOG_FRAME_34_50_V1', 'CATALOG_FRAME_34_FABRIC_V2') GROUP BY pipeline_version;
```

No catálogo: a busca (`GET /api/catalog/search`) e o produto devolvem
`catalogImage.mode = "PROCESSED"` com `catalogImage.url` igual ao `stored_url` da
imagem canônica; o card da Busca Catalogada mostra essa URL. Só a canônica de
cada produto aparece no card; as alternativas também ficam enquadradas e são
usadas se a canônica mudar. O worker da API ignora imagens com
`pipeline_version` `CATALOG_FRAME_*`: uma nova versão do pipeline não refaz um
enquadramento decidido pelo responsável.

## Como interpretar a planilha

As primeiras colunas são **Nome da peça**, **Marca**, **Imagem URL** e **Pipeline
aplicado (sim/não)**. O relatório preserva o estado anterior e mostra o estado
posterior em outra coluna, junto do status, motivo, origem, versão, IDs e recorte.

- **Sim:** análise `APPROVED` na versão `CATALOG_IMAGE_PIPELINE_V4`, com recorte
  válido e evidência de enquadramento. Para roupas, exige `GARMENT_COVER_V1` e
  `foregroundOnly=true`: tecido ocupa todo o quadro, conforme as referências.
  Superiores/peça única usam 4:5; inferiores usam 2:1 na região acima da separação
  das pernas. Calçados e acessórios mantêm sua regra semântica própria.
- **Não:** os metadados atuais não comprovam essa padronização, a imagem foi
  rejeitada, ainda está pendente ou a peça não possui foto.
- **Não verificado:** a fonte é um snapshot sem metadados de processamento.
  Ausência de histórico no arquivo não demonstra que a foto em produção esteja
  pendente; esse estado não é convertido artificialmente em Sim ou Não.

No nível A (`REFERENCE_ONLY`), o pipeline calcula metadados e o frontend aplica
o `SEMANTIC_CROP` à URL original. **A URL pode permanecer igual após a
padronização.** Não é preciso copiar a foto ou fabricar uma segunda URL. No
nível B, o app pode exibir o asset persistido; o inventário registra a URL efetiva
e a original separadamente. Em um snapshot, o estado posterior representa o
resultado local da análise, não uma atualização do app.

## Execução e retomada

O terminal informa imediatamente as fases de leitura do inventário, inicialização
do Java, análise, gravação no MySQL e exportação. Durante a análise, mostra a cada
5 segundos quantos registros terminaram, quantas análises foram concluídas e
quantas falharam, inclusive enquanto aguarda downloads. Essas mensagens ficam
em `stderr`; o JSON final permanece em `stdout`, permitindo redirecionar cada
saída separadamente. O progresso não imprime URLs nem credenciais. Se a senha
for lida com `read -s`, a digitação fica invisível: cole a senha e pressione Enter.
O avanço da análise não significa que uma alteração já foi gravada no banco.

O pipeline é o `CatalogImageBatchCli` Java existente, reutilizado em uma única
JVM. O fat JAR é extraído uma vez em cache por hash. É possível informar
`--java`, `--java-classpath` ou `CATALOG_IMAGE_JAVA_CLASSPATH`; o script não
recompila por foto. Um JAR com versão diferente de V4 é recusado.

Downloads temporários têm limite de 10 MiB, TLS, validação de endereços públicos
e redirecionamentos. Domínios que respondem 403/429 são interrompidos; uma
negação CONNECT do proxy encerra as novas tentativas de rede do lote. As fotos
temporárias são removidas ao terminar. Não há geração ou retoque de pixels.

O arquivo `.checkpoint.sqlite` reaproveita análises concluídas por URL, contexto
da peça, versão do pipeline e revisão observada do registro. Falhas de download
não são tratadas como sucesso e são tentadas novamente na próxima execução.
Para retomar, execute o mesmo comando e mantenha o checkpoint. `--limit N` gera
uma amostra identificada; não transforma uma execução parcial em inventário
completo.

No modo MySQL, download, análise e ranking acontecem fora da transação. A
gravação é atômica por produto, valida versão/URL/hash e preserva decisões
humanas e jobs em andamento. Alterações concorrentes fazem o produto ser
pulado. Reconexões repetem a transação completa, inclusive quando a resposta
do COMMIT se perde. Reaplicações de nível A removem referências a assets antigos
dos metadados, sem apagar os arquivos originais ou substituir a URL da fonte.

As saídas acompanhantes são `.audit.jsonl` (inventário e resultados),
`.summary.json`, `.java.log` e, ao escrever no MySQL, `.before.audit.jsonl` e
`.changes.audit.jsonl` (antes/depois das linhas realmente confirmadas).
`NEEDS_REPROCESSING` e `REJECTED` permanecem sinalizados para revisão; o runner
não força aprovação para preencher a planilha.

```bash
python -m unittest discover -s scripts/catalog/tests
```

Os testes verificam inventário consistente após desconexão, regra de enquadramento,
protocolo Java, atualização concorrente/commit recuperado, retomada e planilha.
O smoke com Java real pode usar uma imagem local para conferir a integração sem
depender de rede externa. Os testes de protocolo não substituem acesso ao banco
de produção nem validação visual do acervo completo.
