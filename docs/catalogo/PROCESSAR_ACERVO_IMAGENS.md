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
