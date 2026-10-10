# Auditoria de persistência do catálogo

## Situação e limites da conclusão

O resultado de produção fornecido pelo usuário contém 14.118 imagens bloqueadas,
zero uploads concluídos e zero alterações no banco. A consulta fornecida também
mostra zero imagens com fonte elegível. Esses resultados foram fornecidos pelo
usuário; não são consultas realizadas nesta execução na nuvem.

A causa cadastral individual das rejeições ainda não foi demonstrada. O executor
possui variáveis MySQL, mas não tem permissões TCP e o proxy TCP recusa conexão.
Por isso não foi possível inspecionar o esquema real, ler catalog_sources de
produção, validar S3 real ou listar objetos órfãos. Não foi concedida permissão,
não houve transformação/upload de imagem de produção e não houve mutação MySQL.

Evidências verificadas no repositório:

- V30 define allows_image_persistence NOT NULL DEFAULT FALSE e cria fontes
  iniciais com FALSE.
- As 112 fontes de data/catalog/brands.json omitem allows_image_persistence.
- O importador usava bool(src.get(..., False)), convertendo a string "false"
  para True e substituindo uma permissão existente por False quando omitida.
- O importador reativava fontes ao atualizar metadados; agora preserva atividade.

Esses mecanismos explicam como fontes podem nascer sem autorização e mostram
bugs concretos de mapeamento, mas não provam qual mecanismo gerou o estado atual
de cada marca. A auditoria real deve preceder qualquer regularização.

## Correções locais

- source_persistence.py: somente o hostname HTTPS real, sem userinfo, porta
  diferente de 443, literal IP, query/fragment como domínio ou proveniência como
  substituto da autoridade. Normaliza caixa, IDNA e ponto final; comparação por
  igualdade ou limite de subdomínio. CDN terceiro exige fonte específica ativa
  e permissão registrada. Retorna AUTHORIZED, DENIED ou UNKNOWN com motivo.
- catalog_image_inventory.py: SQL materializa fontes da mesma marca em JSON.
  A mesma função Python decide elegibilidade no inventário e na transação. Não
  há segundo parser de URL em SQL. Metadados de quadro só são considerados
  padronizados com stored_url e assets do produtor correspondentes.
- process_catalog_images.py: preflight antes do download/Java, autorização de
  cada redirecionamento e da URL final, verificação DNS contra IPs não públicos,
  revalidação da fonte antes do upload e compensação após escrita/skip/falha.
  Logs JSONL usam hostname/hash em vez de URL completa/assinada. Amostras MySQL
  incluem todas as imagens de cada produto, para preservar os guardas SQL.
- category_frame_storage.py: compara bytes de origem com SHA-256 da análise,
  cria objeto de chave exclusiva com escrita condicional, lê bytes novamente
  para verificar SHA-256, e registra dimensões/versão do JPEG 900x1200.
  Limpeza remove apenas objeto criado nesta operação e sem referência confirmada
  no banco. Consulta considera stored_url e referências em assets_json. COMMIT
  incerto ou falha na confirmação impede exclusão e deixa pendência de auditoria.
  Objetos anteriores nunca são sobrescritos/excluídos por esta compensação.
- ingest.py: aceita somente booleano explícito; omissão preserva o valor existente,
  não reativa fonte automaticamente e normaliza domínio.
- CatalogImagePipelineService.java: proveniência não concede persistência de
  host terceiro; autoridade, protocolo, porta e ponto final são validados também
  na decisão de storage Java. Não foi alterado o desenho de análise de referência
  não persistente da API; as novas restrições antes do download aplicam-se ao
  lote de enquadramento com persistência.
- audit_catalog_persistence.py: verifica esquema real antes de consultar fontes,
  produtos e imagens; produz contagens, motivos e fila de revisão com IDs/hosts.
- audit_catalog_storage.py: lista candidatos a órfãos em catalog/framed/, considerando
  referências e backups em assets_json. Somente leitura, nenhuma exclusão.

FALSE legado é UNKNOWN: o esquema não distingue default, falta de autorização
ou negativa explícita. DENIED explícito só é representável quando houver
metadado inequívoco de negativa; não foi criada migração para inventar isso.
TRUE representa permissão configurada, não prova documental independente de
licença. A fila administrativa deve verificar evidência antes de conceder direitos.

## Validação realizada

- 159 testes Python passaram, sem testes ignorados, com PyMySQL instalado em
  /tmp para exercitar também recuperação de conexão/COMMIT.
- 11 testes CatalogImagePipelineServiceTest Java passaram, sem falhas/ignorados.
- Maven 3.9.11 foi obtido com SHA-512 verificado. Usou proxy da sessão, TLS normal
  e cache em /tmp. Como o JRE 21 disponível não inclui ct.sym, a execução usou
  source/target 21, em vez de --release 21; o pom não foi alterado.
- Auditoria sem --apply testada com inventário simulado: nenhum download, Java,
  upload ou atualização SQL. O teste específico de esquema usa transação READ ONLY.
- Regressões: query/fragment sem path, userinfo, porta/protocolo, subdomínio real,
  falso sufixo, proveniência em host terceiro, inatividade, direitos UNKNOWN/DENIED,
  redirecionamento indevido, DNS privado, fonte modificada, source SHA-256 alterado,
  amostra com produto completo e limpeza de objeto novo sem apagar referenciado.
- Integração com MySQL/S3 reais, relatório das 14.118 imagens e auditoria de órfãos
  de produção permanecem não executados, por acesso externo indisponível.
- A checagem DNS testa respostas atuais. Não foi demonstrada proteção completa
  contra DNS rebinding entre resolução local e conexão do proxy; não se afirma
  pinning de DNS nem segurança ponta a ponta além dos controles testados.

## Comandos controlados no Mac e Railway

Use checkout com este patch, Python/venv com requirements-images.txt e variáveis
corretas. No Mac, MYSQL_HOST/PORT devem ser os públicos do Railway; no job Railway
use o endereço privado disponível ao serviço. Não grave credenciais nos comandos.

Primeiro, auditoria do esquema e permissões, sem Java/S3/mutações:

```bash
python3 scripts/catalog/audit_catalog_persistence.py \
  --output data/catalog/auditoria-persistencia.json
```

O relatório contém fontes ativas/inativas, flags configuradas, fontes por marca,
produtos sem fontes, contagens por host, proveniência ausente/divergente,
stored_url presentes e fila individual por estado/motivo. Host diferente da
proveniência é diagnóstico, não concessão de autorização nem prova de fraude.

Auditoria de inventário e relatório de exibição, também sem gravação/upload:

```bash
python3 scripts/catalog/process_catalog_images.py --database \
  --output data/catalog/auditoria-sem-gravacao.xlsx
```

Opcional, após acesso S3 confirmado, listar candidatos a órfãos:

```bash
python3 scripts/catalog/audit_catalog_storage.py \
  --output data/catalog/auditoria-orfaos.json
```

Não exclua candidatos automaticamente: os snapshots do banco e S3 não são atômicos.
O relatório é limitado ao prefixo de assets enquadrados, não ao bucket inteiro.

Após análise humana da fila, regularização específica das fontes com evidência,
rebuild do JAR e aprovação explícita da amostra, usar:

```bash
mvn -DskipTests package
python3 scripts/catalog/process_catalog_images.py --database --apply \
  --category-frame --authorized-only --limit 20 \
  --workers 2 --java-threads 2 --output data/catalog/amostra-autorizada.xlsx
```

Este último comando modifica S3/MySQL e não foi executado nesta auditoria. O limite
seleciona produtos a partir de até 20 imagens elegíveis, incluindo seu inventário
completo; o número final de registros pode ser maior. Preserve os objetos anteriores
como backup e os relatórios da execução. Não execute o acervo completo antes da
aprovação humana dos resultados da amostra. Não elimine os guardas de qualidade,
revisão humana, imagens pequenas ou focos estimados de zíper/cadarço.

As mudanças serão publicadas em PR após autorização do usuário. Atualize o código
após terminar a execução já em andamento, para não trocar módulos no meio do lote.
Nenhuma gravação no banco ou no S3 de produção foi realizada nesta auditoria.
