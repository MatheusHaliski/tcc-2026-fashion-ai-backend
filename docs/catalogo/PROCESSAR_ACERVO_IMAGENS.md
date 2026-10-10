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
- Imagens já enquadradas na mesma versão (`CATALOG_FRAME_34_FABRIC_V2`, com
  `stored_url`, `assets_json.card` iguais e quadro de tecido válido) são
  preservadas: repetir o comando só processa as pendências e as falhas.

### Regras de enquadramento: 100% tecido da peça (`FABRIC_ONLY_100`)

O quadro 3:4 da foto do acervo contém **somente tecido da roupa**: nenhum pixel
de fundo, arte de fundo, pele/corpo de modelo, cabelo, outra peça ou objeto. Se
não existe um quadro assim na foto, ela **não é reenquadrada nem gravada** — nem
com `--force-category-frame`. Não há mais fallback geométrico nem quadro de
largura fixa (50%).

Como o quadro é calculado (Java, `FabricFrame`, versão `FABRIC_FRAME_34_V1`):

1. **Máscara de tecido.** Fundo de estúdio detectado pela borda e removido por
   preenchimento a partir das bordas (ou o recorte do segmentador quando o fundo
   não é uniforme e a segmentação é confiável); fica só o maior componente.
   Buracos com a cor do fundo dentro da peça (alça da bolsa, vão entre braço e
   corpo, ≥ 0,12% da foto) e manchas de pele que não combinam com as cores
   vizinhas da peça (≥ 0,04%) saem da máscara. Estampas pequenas e claras
   continuam tecido.
2. **Região pela categoria/subcategoria** (tabela abaixo), com âncora no
   landmark do pipeline quando detectado (`PIPELINE_LANDMARK`) ou estimada pela
   geometria da peça (`ESTIMATED_*`).
3. **Margem de segurança.** A máscara é erodida (0,4% do menor lado, mínimo 2 px)
   para a borda do quadro nunca encostar no contorno da peça.
4. **Maior retângulo 3:4** inteiramente dentro do tecido erodido, dentro da
   região e contendo a âncora (ou o ponto livre mais próximo dela). A cobertura
   de tecido tem de ser exatamente 1,0; o Python confere de novo e recusa
   qualquer quadro com cobertura menor ou fora da proporção 3:4 (±0,02).

| Categoria | Subcategoria | O que o quadro mostra (`target`) | Região |
|---|---|---|---|
| `upper_piece` | camiseta, camisa, polo, moletom, suéter… | `chest` — peito | miolo da largura (sem mangas), do ombro (+3,5% da altura em modelo; +6% do tronco em packshot) para baixo; com modelo, termina na primeira troca forte de cor (calça, barriga) e no máximo 0,8× a altura da cabeça abaixo dos ombros |
| `upper_piece` | `jacket`, `blazer`, `coat`, `cardigan`, `vest`, `parka`, `windbreaker`, `kimono` (ou abertura detectada pela cor) | `front_panel` — um painel frontal | mesma faixa, mas só um lado da abertura: o que aparece no meio (outra peça, fundo) fica fora |
| `full_body_piece` | vestido, macacão… | `bodice` — corpo da peça | mesma regra do peito, limitada aos 60% de cima da faixa |
| `lower_piece` | jeans, calça, short, bermuda… | `fly` — braguilha/fechamento | do cós (primeira troca forte de cor subindo a partir do gancho: acima é a camisa/jaqueta) até o gancho, só o miolo do quadril (54% da largura); âncora no zíper do pipeline quando detectado |
| `lower_piece` | `skirt`, `skort`, `leggings`, `culottes` | `front_below_waistband` — frente logo abaixo do cós | de 8% a 75% da altura da peça (45% em leggings), 80% centrais da largura |
| `shoes_piece` | tênis, bota, sapato… | `upper` — cabedal | entre 5% e 80% da altura do calçado (sem sola); âncora no cadarço do pipeline quando detectado |
| `accessory_piece` | bolsa, mochila, lenço, chapéu… | `body` — corpo do objeto | caixa da peça com recuo de 4% |
| `accessory_piece` | `sunglasses`, `eyeglasses`, `necklace`, `bracelet`, `earrings`, `ring`, `watch`, `hair_accessory`, `belt` | — | recusado: `NOT_TEXTILE_ACCESSORY` |

Motivos de recusa (a foto fica como está, a linha sai como falha
`FABRIC_FRAME_UNAVAILABLE:<motivo>` e o lote segue):

| Motivo | Significado |
|---|---|
| `NOT_TEXTILE_ACCESSORY` | acessório sem tecido para preencher o quadro (óculos, joias, relógio, cinto) |
| `NO_PRODUCT` | o pipeline não encontrou a peça |
| `BACKGROUND_NOT_UNIFORM` | fundo sem cor de estúdio e segmentação com confiança < 0,6: não há como separar tecido de fundo com segurança |
| `SEGMENTATION_FRAGMENT` | sobrou só um detalhe do primeiro plano (caixa < 6% da foto), em geral peça da cor do fundo |
| `GARMENT_NOT_ISOLATED` | peça de cima sobre modelo sem região de tecido própria (ex.: camiseta da cor do fundo; o quadro cairia no short) |
| `NO_FABRIC_REGION` | nenhum retângulo 3:4 cabe no tecido da região da categoria |
| `FABRIC_REGION_TOO_SMALL` | o retângulo que cabe tem menos de 120 px ou menos de 14% da largura da peça |
| `FABRIC_COVERAGE_BELOW_100` | o retângulo encontrado tem algum pixel que não é tecido |
| `JAVA_<código>` | o Java recusou a foto antes (`IMAGE_TOO_SMALL`, `UNREADABLE_IMAGE`…) |

Fotos pequenas continuam ampliadas para 900×1200 (`render.upscaleFactor`,
`qualityNote=UPSCALED_REDUCED_QUALITY`). Âncora estimada (zíper ou cadarço não
detectado), pele excluída da máscara (`PERSON_SKIN_EXCLUDED_FROM_MASK`) e baixa
confiança da segmentação viram observações em `assets_json.editorFrame`
(`policy`, `fabricCoverage`, `target`, `focusSource`, `region`, `skinExcluded`,
`cropWidthPx`), não bloqueios. Falhas do canal Java (JVM caiu, timeout,
protocolo) continuam falha técnica.

Imagens gravadas pela versão anterior (`CATALOG_FRAME_34_50_V1`, quadro de 50%
que podia mostrar fundo) contam como **não padronizadas**: repetir o comando
reprocessa todas elas com a política nova.

Avaliação em 75 fotos reais do acervo (todas as categorias, packshot e modelo):
37 receberam quadro, todos conferidos visualmente com 100% de tecido da peça
certa; as demais foram recusadas pelos motivos acima e ficam como estão. Limites
conhecidos: peça clara em fundo claro, moletom aberto sobre camiseta, calçado
pequeno de perfil e produto cadastrado na categoria errada (o quadro segue a
categoria do cadastro).

### Execução no Mac

```bash
cd tcc-2026-fashion-ai-backend
python3 -m pip install -r scripts/catalog/requirements-images.txt
mvn -q -DskipTests package                      # fat JAR do backend (Java 21) — obrigatório: o JAR antigo não tem o FabricFrame

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

Código de saída 2 significa que houve falhas individuais; o resumo JSON no
`stdout` e o `.summary.json` trazem `failure_reasons`, `frame_observations`,
`fabric_frame_unavailable` e `write_results`. Rode de novo para repetir só as pendências.

### Como conferir que as imagens foram substituídas

Na planilha (aba **Acervo**): **Pipeline após a execução = Sim**, **Imagem
processada / recorte** com link `…/catalog/framed/…jpg`, **Versão do pipeline**
`CATALOG_FRAME_34_FABRIC_V2`, **Motivo / observações** = "Enquadramento salvo no S3 e
referência ativa atualizada no banco", **Enquadramento: foco** (categoria → alvo e
origem do foco), **Enquadramento: observações** e **Dimensões (origem → saída)**.
No `.changes.audit.jsonl`, cada linha confirmada traz `before`/`after` com
`stored_url`, `assets_json` e `persistence_decision_at_commit`. No banco:

```sql
SELECT COUNT(*) FROM catalog_images
 WHERE pipeline_version = 'CATALOG_FRAME_34_FABRIC_V2' AND stored_url LIKE '%/catalog/framed/%';
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
