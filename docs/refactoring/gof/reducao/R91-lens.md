# Lote R91-lens — `LensService` como Facade; ΔE00 fora da `LensSimilarity`; `LensServiceTest` por tema

Base: `claude/relaxed-pasteur-5b5466` (merge `--ff-only` antes de começar e merge antes do commit final).
Pacote: `fai-application/src/main/java/br/com/fashionai/application/lens/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `LensService.java` (`java-service`, 250) | 1363 | 250 | 13 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `LensSimilarity.java` (`java-outro`, 250) | 259 | 200 | `LensColorDistance` (79) | NENHUM |
| `src/test/.../lens/LensServiceTest.java` (`teste`, 400) | 721 | 217 | `LensServiceFixture` (320), `LensServiceCorrectionTest` (83), `LensServiceRetentionTest` (78), `LensServiceLiveLayerTest` (96) | NENHUM |

Colaboradores do `LensService` (todos `final`, package-private, sem Spring; criados uma vez no construtor do serviço):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `LensScanIntake` | 137 | entrada do scan: foto enviada (origem, intenção, imagem aceita/reduzida, rostos, confirmação) e "Ver no Lens" (peça/look visível para quem pede, URLs da foto, 422 sem imagem) |
| `LensScanRecorder` | 121 | cota diária (429 `QUOTA`), detecção, gravação do scan e da imagem limpa em `restricted/`, linhas de peça e devolução da cota em falha |
| `LensScanAccess` | 84 | scan do dono (404 para os outros), peça do scan, peças ativas/alvos, imagem gravada, `requireUser` |
| `LensRequestContext` | 189 | o antigo `LensService.Ctx`: guarda-roupa, embeddings, DNA, pares vistos, grupo público e candidatas da comunidade, carregados uma vez por pedido; `Sources` reúne os repositórios |
| `LensMatcher` | 94 | correspondências MY_CLOSET/COMMUNITY, lista de `matches`, `features` (detecção/peça), `hexOf`, `pieceView` |
| `LensViewAssembler` | 114 | `ScanView`, `DetectionView` (melhor correspondência), `ReadingView` (estilo, paleta, DNA, Hype do grupo, impacto) |
| `LensHistory` | 70 | histórico e inspirações paginados (filtros salvos/"Quero") |
| `LensCorrections` | 221 | correção de atributos/"não é roupa" e peça marcada pela pessoa (`PATTERNS`, imagem gravada) |
| `LensFeedbackLog` | 57 | `lens_feedback` (antes/depois, consentimento de treino) e `snapshot` |
| `LensOwnership` | 88 | "Quero", "Eu tenho" e o link `/pieces/new` pré-preenchido |
| `LensRecreatePlanner` | 216 | plano "Recriar" (slots, modo, fixados, `SLOTS`), seis números da peça e do look, Hype das peças próprias |
| `LensRetention` | 93 | salvar/desfazer (prazo de 30 dias), vencidos, conta inteira, `purge` |
| `LensDetectionFields` | 114 | campos puros da detecção: caixa (gravada e marcada, `MIN_BOX_PCT`), cores, cor principal corrigida, rótulo padrão, embedding, `round4`, peça da leitura |
| `LensInputs` | 36 | `parseEnum`, `invalid`, `blankToNull`, `eq` |

## Como foi dividido

- **LensService**: código movido por caso de uso sem alterar corpos; as únicas mudanças são a qualificação das chamadas
  que passaram a outro colaborador (`closetMatches(ctx, d)` → `matcher.closetMatches(ctx, d)`, `detectionView(new
  Ctx(user), d)` → `views.detectionView(live.open(user), d)`, `recordFeedback(…)` → `feedbackLog.recordFeedback(…)`,
  `hypeScores` → `src.hypeScores()` no contexto…) e imports estáticos de `LensInputs`/`LensDetectionFields` nos
  colaboradores para manter os corpos iguais. O contexto continua preguiçoso, então criar o contexto dentro do
  colaborador (e não no método público) não muda consultas nem resultados.
- O serviço continua o único bean: as **16 anotações `@Transactional`** (6 `readOnly`) ficaram nos mesmos métodos
  públicos; construtor de 19 argumentos, os 6 records públicos (`CreateCommand`, `FromAppCommand`, `BoxInput`,
  `AddDetectionCommand`, `CorrectionCommand`, `RecreateCommand`) e `QUOTA_BUCKET` (usado por testes) não mudaram, e a
  javadoc dos públicos é a original. O construtor só guarda referências (sem chamar dependências), então o
  `ServiceFakes.FakeLensService` de `fai-web` (argumentos de `Fk.arg`) compila e constrói sem alteração.
- **Autorização**: `guard.requireCanCreate` (criar/"Ver no Lens") e o dono do scan (`access.owned` → 404, e
  `access.ownedDetection`) ficam no método público, na mesma ordem do original (ex.: em `matches`, dono → escopo → alvos;
  em `correct`, dono → peça → comando nulo). A visibilidade da peça/look de "Ver no Lens" e o filtro da comunidade
  (`guard.canView`) foram junto com o corpo, dentro da mesma transação.
- Os loggers dos colaboradores continuam com a categoria `LensService` (mesmas mensagens nos mesmos lugares).
- Saíram do `LensService` sem delegação (package-private, agora no colaborador): `acquireQuota`, `process`,
  `prefillHref`, `PATTERNS`, `SLOTS`, `MIN_BOX_PCT`, `features` (2), `hexOf`, `readingPiece`, `box` (2), `colors`,
  `withMainColor`, `defaultLabel`, `embedding`, `round4` e a classe interna `Ctx`. Consumidores ajustados:
  `LensScanProvenance` (`defaultLabel`, `round4`, javadoc de `process`) e `LensScanProvenanceCharacterizationTest`
  (`defaultLabel`). Nenhum método público foi removido.
- **LensSimilarity**: o bloco CIEDE2000 (`deltaE00` ×2, `hue`, `cosDeg`) foi movido sem alteração para
  `LensColorDistance`; os dois `public static deltaE00` continuam na `LensSimilarity` delegando (API pública e testes).
- **LensServiceTest**: o estado em memória, o `setUp` e os construtores de dados foram para `LensServiceFixture`
  (abstrata, herdada pelos testes); os 18 testes foram distribuídos sem alteração por tema — scan/privacidade/cota/
  origem/nunca gera Hype (9, `LensServiceTest`), correções e "Eu tenho"/"Quero" (3), retenção e inspirações (3),
  camada viva: comunidade, Hype do grupo e Recriar (3). A fixture ganhou só `dnaRow` (vazio por padrão, igual ao
  `Optional.empty()` anterior) para o retrato com DNA.

## Por que Facade (LensService) e NENHUM (LensSimilarity, testes)

- **Facade**: `LensController`, `AccountService` (`deleteAllFor`), `LensRetentionJob` (`purgeExpired`) e os fakes de
  `fai-web` continuam falando só com `LensService`, que esconde 13 subsistemas coesos e coordena transação, permissão e
  dono do scan. A estrutura extraída é de fato uma fachada; nenhuma interface artificial foi criada.
- **NENHUM (LensSimilarity)**: o ΔE00 é um único algoritmo puro; não há família de distâncias intercambiáveis (Strategy)
  — o arquivo novo só isola a fórmula de referência do cálculo de semelhança.
- **NENHUM (testes)**: herança de fixture de teste não é padrão GoF; Template Method não se aplica (não há esqueleto com
  passos variáveis, só estado compartilhado).

## Testes e equivalência

Caracterização antes (commit `c5e6757`, sobre o código original): `LensServiceRetratoTest` passa o mesmo cenário
(guarda-roupa com 6 peças, 6 peças públicas com Hype, DNA) por todos os públicos — `create`, `fromApp`, `get`,
`matches` (closet/comunidade, peça/look), `reading`, `recreate` (SAFE/DISCOVERY/EXPERIMENTAL, fixados, padrão),
`correct` (subtipo, atributos, categoria, nulo), `add`, `want`, `own` (link e cadastro), `setSaved`, `history`
(três filtros) e o `lens_feedback` gravado — e compara o retrato JSON (UUIDs → rótulos, instantes → `<t>`) por SHA-256
(`3a00d5f0…29aa`, idêntico em JVMs separadas) e por números exatos de semelhança (ex.: blazer 80 → 78 após a correção,
tênis 67, jaqueta 100 com componentes 100/100, DNA 85, Hype do grupo 63 HOT UP com 6 itens).
`LensSimilarityRetratoTest` fixa a grade 6×6 de semelhanças (similaridade/visual/atributos/cor/motivos), um `rank`,
49 ΔE00 com 10 casas, `combine`, `color` e `visual`.

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='Lens*Test,AccountService*Test' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -q -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,LensAccessTest' test
mvn -B -o -pl fai-application -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, 5 classes do Lens + `AccountServiceTest` | 46 + 6 testes, 0 falhas |
| Original com o teste dividido em 4 classes + fixture + 2 retratos | 48 testes do Lens, 0 falhas (retratos gravados) |
| Após `LensColorDistance` e o Facade do `LensService` | **48 testes do Lens + 6 `AccountServiceTest`, 0 falhas; os dois retratos idênticos** |
| `fai-web` (install compila tudo; `ServiceFakes` sem alteração) | `ControllerDelegacaoTest` 697 e `LensAccessTest` 4, 0 falhas |
| Suíte completa de `fai-application` (depois) | 2047 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | os 3 arquivos do lote só como `APERTAR` (1363 → 250, 259 → 200, 721 → 217); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- `LensService.java` ficou exatamente no limite (250): o que sobra é contrato (javadoc da classe e dos públicos,
  construtor de 19 argumentos, 6 records, 16 métodos `@Transactional`). Qualquer método novo exige antes levar os records
  para tipos de topo (com ajuste de `LensController`, `ServiceFakes` e testes).
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
