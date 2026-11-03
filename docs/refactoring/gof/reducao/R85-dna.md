# Lote R85-dna — `DnaService` como Facade sobre colaboradores por caso de uso

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-afcdd0911b131383b`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/DnaService.java` (`java-service`, 250) | 1461 | 217 | 13 classes, tabela abaixo | **Facade** (estrutural) |

Colaboradores (todos `final`, package-private, sem Spring, no mesmo pacote; categoria `java-outro`, limite 250):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `DnaSynthesis` | 190 | cálculo do DNA (Camada 1): pré-requisitos e interações, `ensureDna`, `synthesize`, peça ícone, silhueta, ousadia em percentil, diversidade, snapshot de versão |
| `DnaIdentityPhrase` | 76 | Frase de Identidade pela IA (sem vazar campos privados) e frase local de fallback |
| `DnaOverview` | 80 | `overview` (recálculo por evolução, versões) e `socialProof` |
| `DnaLifeIdentity` | 111 | Identidade de Vida: `validateLife`, `generate`, `updateLife`, `setPrivateFields`, `setColorSeason` |
| `DnaCard` | 134 | card PNG com marca d'água (`shareCard`, `renderCard`, cores, quebra de texto) |
| `DnaSchemeWriter` | 191 | criar/editar/arquivar Esquema de DNA, `stamp`, `apply` (anatomia, alvo, narrativa, Studio), `replaceCells` |
| `DnaSchemeViews` | 175 | `getDnaScheme` (visibilidade), `myDnaSchemes`, `dnaSchemeView`, `groupItems`, Hype v2 das células |
| `DnaBuilderSteps` | 107 | construtor RF5: `builder` (etapas 1–2) e `preview` |
| `DnaCompositions` | 210 | modo IA: contexto, chamada à IA, `parseProposals`, `enumOr`, `strs`, `era`, `ownerScores` |
| `DnaLocalProposals` | 224 | regras puras do motor local: `localProposals`, títulos/justificativas, `matches`, `pickFor`, `spread` |
| `DnaNarratives` | 150 | regras puras da Seção B: `narrativeData`, `hypeScoreOf`, `harmony` |
| `DnaLogos` | 89 | regras puras de logos: `logoRanking`, `logoCut`, `dominantBrand`, `dominantColor` |
| `DnaViews` | 73 | rótulos dos arquétipos, `view` do DNA, `lifeFormSpec`, `pieceBrief` |

## Como foi dividido

- O código foi movido por faixas de linhas do original (script de extração), sem alterar os corpos. As únicas mudanças
  são a qualificação das chamadas que passaram a outro colaborador (`ensureDna(u)` → `synthesis.ensureDna(u)`,
  `view(d, true)` → `DnaViews.view(d, true)`, `dnaSchemeView(...)` → `schemeViews.dnaSchemeView(...)`,
  `ARCHETYPE_LABEL` → `DnaViews.ARCHETYPE_LABEL`, `LAYOUTS` → `DnaService.LAYOUTS`…), a retirada de `public` e de
  `@Transactional` das cópias movidas, e `static` em `view` e `narrativeData` (já não usavam estado). Um script de
  conferência confirmou que toda linha dos colaboradores, tirados os qualificadores, existe no original (só os
  construtores são novos).
- O serviço continua o único bean: as **15 anotações `@Transactional`** (com os mesmos `readOnly` em `socialProof` e
  `myDnaSchemes`) ficaram nos mesmos métodos públicos, e cada um delega numa instrução. Construtor de 16 argumentos,
  constantes públicas (`MIN_PIECES`, `MIN_POSITIVE`, `RECALC_INTERACTIONS`, `LAYOUTS`, `SOCIAL_PROOF_MIN`) e os records
  aninhados (`LifeForm`, `DnaCellForm`, `DnaSchemeForm`, `CellRef`, `DnaComposeRequest`, `DnaProposal`) não mudaram;
  `ServiceFakes.FakeDnaService` (fai-web) compila sem alteração. Os colaboradores são criados no construtor com as
  mesmas dependências (nulas inclusive, como em `DnaHypeFocusV2Test`).
- **Autorização**: `guard.requireCanCreate`, `requireOwner`, `requireView` e `deny` foram junto com o corpo do caso de
  uso, na mesma ordem, e rodam dentro da transação do método do bean. Não havia autochamada pública→pública no original.
- Mantidos no serviço como delegação por terem chamador nos testes: `dnaSchemeView(viewer, d, items)`,
  `parseProposals`, `enumOr`, `localProposals` (4 args), `pickFor` (5 args), `spread`, `harmony`.
- Saíram do serviço sem delegação (sem chamador fora da classe, inclusive testes e `fai-web`; agora nos
  colaboradores): `positiveFeedbacks`, `activePieces`, `interactions`, `ensureDna`, `lifeFormSpec`, `validateLife`,
  `synthesize`, `iconPiece`, `silhouette`, `boldnessPercentile`, `diversity`, `phrase`, `localPhrase`, `snapshot`, `view`,
  `renderCard`, `color`, `darken`, `drawWrapped`, `stamp`, `apply`, `replaceCells`, `dnaSchemeView(viewer, d)`,
  `groupItems`, `hypeV2Of`, `cellHype`, `hypeScoreOf`, `ownerScores`, `pieceBrief`, `strs`, `era`, `matches`,
  `logoRanking`, `logoCut`, `dominantBrand`, `dominantColor`, `narrativeData`, as constantes package-private
  `LIFE_LIMITS`, `BASIC_ACCESSORIES`, `ARCHETYPE_LABEL`, `BUILDER_STEPS`, `ERA`, `TITLES`, `RATIONALE` e as sobrecargas
  `localProposals(own, itemsBy, r)` e `pickFor(nt, pool, itemsBy, season)`. Nada foi apagado: `dominantBrand` e as duas
  sobrecargas já não tinham chamador no original e foram movidas como estavam.

## Por que Facade

`DnaController` e `ServiceFakes` continuam falando só com `DnaService`, que esconde oito colaboradores por caso de uso e
quatro classes de regras puras, e coordena transação e dependências. A estrutura extraída é de fato uma fachada; não foi
criada interface. **Strategy** para as 12 narrativas (em `pickFor`, `narrativeData`, `logoCut`) foi descartado: cada
narrativa é um ramo curto de `switch` sobre os mesmos dados, sem variação escolhida em tempo de execução fora do enum, e
classes por narrativa espalhariam regras que hoje se leem lado a lado. **Template Method** para criar/prévia também não:
`preview` reaproveita `stamp`/`apply` por chamada direta.

## Testes e equivalência

Caracterização antes (commit `5c8cc5e`, no código original): novo `DnaServiceCharacterizationTest` (349 linhas) com
valores fixos (ids `UUID(0xD0A, n)`, datas de 2025, 3 pessoas, 7 looks com estações/ocasiões/marcas variadas, 5 Looks do
Dia). Monta um retrato canônico (chaves ordenadas; ids e instantes gerados na hora viram marcadores) de: `overview` (2×),
`socialProof`, `generate` (com/sem vida, erros), `updateLife`, `setPrivateFields`, `setColorSeason`, `shareCard` (com o
**SHA-256 do PNG**), `createDnaScheme` em todas as narrativas e anatomias, `getDnaScheme` por visitante, `updateDnaScheme`,
`deleteDnaScheme`, `myDnaSchemes`, cinco erros de validação, `builder`, `preview` (2), `compositions` (6 pedidos, motor
local), `pickFor` (12 narrativas × 2 estações), `localProposals`, `harmony`, `spread`, `enumOr`, `parseProposals`. O
retrato (`src/test/resources/dna/dna-service-portrait.txt`, 112 linhas, ~280 KB) foi gravado no original e saiu idêntico
em 3 execuções seguidas antes de ser versionado.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='DnaServiceCharacterizationTest,DnaServiceTest,DnaHypeFocusV2Test' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -am -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: `DnaServiceTest` + `DnaHypeFocusV2Test` + caracterização | 12 testes, 0 falhas |
| Após o Facade (mesmo retrato, mesmo SHA-256 do PNG) | **12 testes, 0 falhas, 0 erros** |
| `install` de `fai-web` com dependências (`ServiceFakes` sem alteração) | sucesso |
| Suíte completa de `fai-application` (depois) | 2030 testes, 0 falhas, 0 erros, 27 skipped |
| `fai-web` `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 698 testes, 0 falhas |
| Catraca | `DnaService.java` só como `APERTAR` (1461 → 217); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
- Sugestão futura: apontar `DnaServiceTest`/`DnaHypeFocusV2Test` direto para `DnaLocalProposals`, `DnaNarratives`,
  `DnaCompositions` e `DnaSchemeViews`, o que tiraria as sete delegações package-private do serviço.
