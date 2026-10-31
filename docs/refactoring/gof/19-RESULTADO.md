# Módulo 19 — ports, adapters, S3, Redis, Cassandra, eventos externos: lote ADAPTER-OCR-POSTPROC-001

Base: `bcaee73` (main após PR #416). Branch: `gof/19-adapters`. `git status --short` limpo antes do lote.
Escopo: `fai-infrastructure` (adapters) e `fai-application/ports`. Lote 17 (JPA/repositórios, `MysqlAnalyticsAdapter`)
em curso em outra branch: não tocado. Nenhum service de `fai-application` alterado.

## Mapeamento real (adapters e ports)

Inventário de `fai-infrastructure/*/src/main` (linhas): `MysqlDemoDataAdminAdapter` 437 (congelado; persistência, área
do lote 17), **`OnnxTextReader` 357 (congelado)**, `MysqlAnalyticsAdapter` 348 (lote 17), `MysqlDumpBackupAdapter` 225,
`JdkWebFetchAdapter` 178, `OpenSearchTls` 175, `ClaudeProvider` 163, `OpenSearchIndexAdapter` 161,
`ReplicateImageGenerationAdapter` 160, `LocalFileMediaStorage` 155, `S3MediaStorageAdapter` 139, `CassandraCloudConfig`
137, `RedisAdapters` 123, `InMemoryRateLimit` 113, `CassandraProjectionAdapter` 103; os demais adapters < 100.
Ports: 22 interfaces em `fai-application/ports` + `TextReaderPort` em `fai-application/imaging`.

Fluxo do adapter deste lote (OCR local da marca, RF4):
upload/edição de peça (`WardrobeService`, `MultiPieceService`, `PhotoEditService`, `fai-application`)
→ `BrandReader` (`application/imaging`, regra de marca e catálogo) → **`TextReaderPort`** (`read`, `recognize`,
`available`) → **`OnnxTextReader`** (`@Component`, `ai-providers`) → ONNX Runtime com PP-OCRv4 do classpath
(`/models/ocr/ppocrv4_det.onnx`, `ppocrv4_rec.onnx`). Sem rede, sem custo, sem segredo.

## Problema concreto e decisão

`OnnxTextReader` (357 linhas, congelado no baseline) misturava num único adapter: ciclo de vida preguiçoso e
sincronizado das sessões ONNX, conversão imagem → tensor, **e** todo o pós-processamento numérico das duas redes —
tamanho de entrada do DBNet, binarização, dilatação 2x2, componentes conexos por pilha, unclip, junção de letras da
mesma linha (`mergeLine`), corte em 60 caixas e ordenação; dicionário do CTC a partir do metadado do modelo e
decodificação gulosa. Esse pós-processamento é puro (arrays → caixas/texto), mas só era exercitável carregando os
modelos (~15 MB) e renderizando fontes, o que torna as regras (limiares, ordem, colapso do CTC) impossíveis de testar
isoladamente.

Extração (funções puras, package-private, mesmo pacote):

- **`DbNetBoxes`** (146): `inputSize(w, h)` e `boxes(prob, rw, rh, w, h)` (+ `mergeLine`, movido sem mudança). Mesmos
  limiares (0,3 / 0,5), unclip 1,6, lado mínimo 736, teto 2000, máximo 60 caixas, mesma ordem de saída.
- **`CtcGreedyDecoder`** (65): `dictionary(chars)` (branco no índice 0, linhas na ordem, espaço no fim, mesma
  exceção/mensagem quando ausente — continua capturada pelo `init()` e vira porta indisponível) e
  `decode(scores, steps, classes, dict)` → `Decoded(text.trim(), confiança média)` ou `null`.
- **`OnnxTextReader`** (220) fica com: `init()` (lock, `failed`, sessões, threads), `read`/`recognize` (filtro de caixa
  vertical/minúscula, coordenadas relativas, `catch` que devolve vazio), conversão em tensor (`chw`, preenchimento do
  CRNN), `onWhite`/`scale` e montagem das `Line`.

### Padrões avaliados e não aplicados

- **Strategy (detector/decodificador intercambiáveis):** há um único modelo (PP-OCRv4) e uma única decodificação; uma
  interface sem segunda implementação seria abstração artificial. Funções puras bastam.
- **Template Method (pipeline OCR):** só existe um pipeline; herança não traria variação real.
- **Proxy (carga preguiçosa do modelo):** o `init()` com double-checked locking já é o proxy de lazy-loading de fato;
  movê-lo para outro objeto mudaria o ciclo de vida do bean sem ganho. Mantido.
- **Decorator (métricas/log):** o adapter registra só `warn/error` sem PII; não há telemetria a decorar neste lote.
- **Adapter:** `OnnxTextReader` já é o Adapter de `TextReaderPort`; o lote o deixa mais fino, sem nova camada.
- **Singleton:** bean Spring; nenhum Singleton manual.
- **Outros candidatos do domínio não escolhidos neste lote:** `S3MediaStorageAdapter` (resolução de base pública/
  `restricted/` e `keyOf` duplicando a validação de chave do `LocalFileMediaStorage`) — bom candidato, mas o módulo
  `storage-s3` não tem dependência de teste; exige mudar o `pom.xml` e fica como próximo lote. `RedisAdapters` (chaves
  `rate:`/`counter:`/`render:`/`jobs:` e TTL) — 123 linhas coesas, sem duplicação relevante; não mexido para não
  arriscar chave/TTL. `MysqlDemoDataAdminAdapter` (437, congelado) — persistência, área do lote 17.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (código original): `OnnxTextReaderCharacterizationTest` novo (4: duas linhas em ordem vertical com caixa relativa válida, `recognize` com caixa nula, recorte minúsculo/página em branco vazios, `onWhite`), `OnnxTextReaderTest` (5), `BrandReaderFoldedOcrTest` (4) + dump golden temporário (6 imagens, 13 linhas: texto, confiança em double completo, caixa) | `mvn -B -pl fai-infrastructure/ai-providers -am -Dtest=OnnxTextReader*Test,TmpOcrGoldenDumpTest,BrandReaderFoldedOcrTest -Dsurefire.failIfNoSpecifiedTests=false test` | 14 testes, 0 falhas, 1 skipped (preexistente: `FAI_OCR_DIR`) |
| Depois da extração + `DbNetBoxesTest` (6: tamanho de entrada, caixa exata com unclip/escala, descarte fraco/fino, ordem, `mergeLine` junta/não junta) + `CtcGreedyDecoderTest` (5: dicionário, ausência, colapso/branco/média, trim e índice fora, só branco) + sondas de marca | mesmo comando + `DbNetBoxesTest,CtcGreedyDecoderTest,BrandOcrProbeTest,BrandRobustProbeTest,MultiPieceLocalProbeTest` | 28 testes, 0 falhas, 4 skipped (sondas que exigem pasta local de fotos) |
| Saída golden antes × depois | `diff` das 13 linhas `GOLDEN` | **idêntica** (texto, confiança e caixas bit a bit) |
| Módulo `ai-providers` inteiro (dump temporário removido) | `mvn -B -pl fai-infrastructure/ai-providers -am -Dtest=br/com/fashionai/infrastructure/ai/**/*Test -Dsurefire.failIfNoSpecifiedTests=false test` | 100 testes, 0 falhas, 6 skipped preexistentes; BUILD SUCCESS |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `OnnxTextReader` APERTAR 357 → 220 (sai do baseline na próxima `--update`). As 17 violações listadas são de arquivos de outros lotes (worktree em `bcaee73`) |

Logs: `evidence/19-ocr-baseline.log`, `evidence/19-ocr-after.log`.
O teste golden foi temporário e não versionado (valores dependem da renderização de fontes da máquina); o contrato
estável fica nos testes de caracterização e nos testes puros, que não dependem de fonte.

Sem S3, Redis, Cassandra, SMTP, IA remota, banco, rede ou segredos. Os modelos ONNX já estão no repositório e rodam
localmente na CPU.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `OnnxTextReader.java` | 357 | 220 (−137; −38,4 %) — abaixo do limite de 250 |
| `DbNetBoxes.java` (novo) | — | 146 |
| `CtcGreedyDecoder.java` (novo) | — | 65 |
| Runtime combinado | 357 | 431 (+74: javadoc das unidades, assinaturas, `record Decoded`) |
| Testes novos | — | `DbNetBoxesTest` 83, `CtcGreedyDecoderTest` 64, `OnnxTextReaderCharacterizationTest` 83 |
| `OnnxTextReaderTest.java` | 86 | 86 (só a referência `mergeLine` passou a `DbNetBoxes`) |

O ganho é testabilidade isolada do pós-processamento e a saída do arquivo do baseline, não redução global de código.

## Contratos preservados

`TextReaderPort` (assinaturas, semântica de `available`, caixa nula em `recognize`, vazio em falha), bean
`@Component OnnxTextReader`, caminhos dos modelos, parâmetros do PP-OCRv4/RapidOCR (limiares, unclip, tamanhos,
máximo de caixas, ordem), dicionário do CTC e mensagem de erro, logs. Nenhum DTO, URL, schema, migration, chave Redis,
TTL, projeção Cassandra ou configuração alterados.

## Riscos e pendências do domínio 19

- `S3MediaStorageAdapter`: extrair a resolução de URLs (`publicBase`/`apiBase`, roteamento de `restricted/`) e o
  `keyOf` para um objeto puro, e compartilhar a validação de chave com `LocalFileMediaStorage`; requer adicionar
  `spring-boot-starter-test` (escopo test) ao `storage-s3/pom.xml` e caracterizar construindo o adapter com endpoint
  fictício (o SDK não conecta na construção nem na pré-assinatura).
- `RedisAdapters`/`InMemoryRateLimit`: caracterizar as chaves `rate:{bucket}:{user}`, `counter:{tipo}:{id}`,
  `render:{key}` (TTL padrão 10 min) e `jobs:{stream}` com `StringRedisTemplate` fake antes de qualquer mudança.
- `CassandraProjectionAdapter`/eventos (`LoggingDomainEventPublisher`): sem outbox; publicação pós-commit não
  avaliada neste lote.
- `MysqlDemoDataAdminAdapter` (437, congelado) aguarda o fim do lote 17.
