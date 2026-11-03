# Lote R89-scheme — `SchemeService` como Facade; card e compositor local por responsabilidade

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-ac62afc2020844b7c`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/SchemeService.java` (`java-service`, 250) | 1271 | 249 | 12 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `imaging/SchemeCardRenderer.java` (`java-outro`, 250) | 357 | 201 | `SchemeCardBackground` (135), `SchemeCardItems` (64) | NENHUM |
| `ai/local/LocalSchemeComposer.java` (`java-outro`, 250) | 346 | 200 | `LocalSchemeScoring` (115), `LocalSchemeLabels` (68) | NENHUM |

Colaboradores do `SchemeService` (todos `final`, package-private, sem Spring, no mesmo pacote; `java-outro`, 250):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `SchemeHype` | 59 | HypeScore v2 gravado (consulta em lote, faixa do estado) e rótulo do Hype no PNG |
| `SchemeLookFilters` | 111 | regras puras de Meus looks: `lookSort`, `hypeMinimum`, `byHype`, `stateMatches`, `kindOf` |
| `SchemeAiPayloads` | 101 | contexto extra da IA (`pieceAnalysis`, `dnaContext`) e leitura da resposta (`parseCompositions`) |
| `SchemeComposeSteps` | 208 | etapas 1–3: `builder` e `compose` (catálogo, fotos, prompt, alternativa local) |
| `SchemeFormWriter` | 157 | `applyForm`, `replaceItems`, `publishInternal` (snapshot RF7.CA03) |
| `SchemeLookPhoto` | 82 | foto do look: `uploadLookPhoto` (pipeline) e `applyLookPhoto` |
| `SchemeReads` | 183 | `get`, `requireView`, `canView`, `moreRestrictive`, `view`, `mine`, `owned` |
| `SchemeCreateFlow` | 171 | `create` (remix, Look do Dia, eventos), `suggestSealsAfterSave`, `remix` (prefill) |
| `SchemeEditFlow` | 148 | `publish`, `update` (revalidação/revogação de selos), `toggles`, `archive` |
| `SchemeAiEdit` | 131 | "melhorar com IA": `improve`, `parseDiff`, `validChange`, `applyDiff` |
| `SchemeCards` | 158 | `renderCard`, `card`, `placeholder`, `preview` |
| `SchemeLayout` | 103 | RF15: `updateLayout`, `layoutPreview`, `applyLayout` |

## Como foi dividido

- Código movido por faixas de linhas do original (`sed -n a,bp`), sem alterar corpos. Mudanças: qualificação das
  chamadas que passaram a outro colaborador (`owned(...)` → `reads.owned(...)`, `view(...)` → `reads.view(...)`,
  `applyForm` → `writer.applyForm`, `currentHype` → `hypeState.currentHype`, `stateMatches` → `SchemeLookFilters.stateMatches`…),
  retirada de `public`/`@Transactional` das cópias, `private` → package-private onde outro colaborador chama, e `static`
  em `parseCompositions` e `parseDiff` (não usavam estado). Três linhas longas foram quebradas depois da qualificação.
- O serviço continua o único bean: as **16 anotações `@Transactional`** (mesmos `readOnly`) estão nos mesmos métodos
  públicos, cada um delegando numa instrução. Construtor de 22 argumentos (mesma ordem; o `Kit` dos testes o usa por
  reflexão), records públicos `ComposeRequest`, `ComposeResult` (construtores e `with*`), `ItemForm`, `SchemeForm`,
  e os estáticos públicos `combinationKey`, `moreRestrictive`, `kindOf` não mudaram. `ServiceFakes.FakeSchemeService`
  (fai-web) compila sem alteração. As sobrecargas `mine(5)`/`mine(6)` continuam chamando `mine(8)` no próprio serviço.
- **Autorização**: `guard.requireCanCreate`, `requireOwner` (via `owned`), `requireView` foram junto com o corpo, na
  mesma ordem, e rodam dentro da transação do método do bean.
- Saíram do serviço sem delegação (para caber no limite; chamadores apontados para o colaborador, mesma assinatura):
  `pieceAnalysis` (`DnaCompositions` → `SchemeAiPayloads`), `parseDiff` (`SchemeAiEdit`), `lookSort`, `hypeMinimum`,
  `byHype`, `stateMatches` (`SchemeLookFilters`), `cardHypeLabel` (2 sobrecargas, `SchemeHype`), `placeholder`
  (`SchemeCards`) — chamadores em `SchemeServiceTest`, `SchemeFiltersTest` e no novo teste de caracterização; nenhuma
  asserção mudou. Sem chamador externo, também saíram: `dnaContext`, `parseCompositions`, `MAX_COMPOSE_PHOTOS`,
  `PHOTO_PIPELINE`, `applyLookPhoto`, `LOOK_HYPE_SORTS`, `currentHype`, `validChange`, `card` (2), `applyLayout`.
- Os separadores `// ====` e as javadocs de uma linha do serviço não foram repetidos na fachada: as javadocs originais
  foram junto com o código para os colaboradores.
- **SchemeCardRenderer**: `paintBackground`, camadas AURA/material, `read`, `drawCover`, `averageBackground` →
  `SchemeCardBackground` (guarda o `AssetCatalogService`; o renderer o cria no construtor); `drawItem` e
  `defaultPosition` → `SchemeCardItems` (estáticos). Métodos públicos (`render`, `renderImage`, `containerColor`,
  `luminance`, `contrast`, `hypeFitsBeside`) e records/enum aninhados intactos.
- **LocalSchemeComposer**: `score`, `seasonFit`, `comboScore`, `harmony`, `words`, `normalize` → `LocalSchemeScoring`;
  `seals`, `mood`, `title`, `cap` → `LocalSchemeLabels` (`LocalAdvisors` passou a chamar `LocalSchemeLabels.title/mood`).
  API pública (`compose`, `toComposition`, `onePerType`, `slotOf`, `synthesize`, records) intacta.

## Por que Facade (SchemeService) e NENHUM (renderer, compositor)

`SchemeController`, `ServiceFakes` e os demais serviços continuam falando só com `SchemeService`, que esconde doze
colaboradores por caso de uso e coordena transações e dependências — uma fachada de fato, sem interface criada.
Strategy para os critérios de ordenação de Meus looks foi descartado: são ramos curtos de `switch` sobre os mesmos dados.
No renderer e no compositor a extração é por responsabilidade (fundo × peças; pontuação × rótulos) sem variação
escolhida em tempo de execução, então nenhum padrão se aplica.

## Testes e equivalência

Caracterização antes (commit `6b4ba55`, no código original), com o helper novo `testkit/Portrait` (chaves ordenadas,
records por campo, entidades `Tipo#id`, bytes/imagens por SHA-256, ids/instantes novos como marcadores):

- `SchemeServiceCharacterizationTest` + `SchemeServiceCharacterizationFixture`: mundo fixo (ids `UUID(0x5CE, n)`,
  datas de 2025, Hype v2 gravado); retrato de todas as saídas públicas (incl. erros), dos **SHA-256 dos PNGs** de
  `renderCard`/`preview`/`layoutPreview`, das regras puras e de **todas as chamadas** aos mocks (auditoria,
  notificações, eventos, contadores, projeções, selos, Look do Dia, mídia, guarda) — `scheme/scheme-service-portrait.txt` (721 linhas).
- `SchemeCardRendererCharacterizationTest`: SHA-256 dos pixels de 34 cards (12 fundos × 2 tamanhos, textos, Hype,
  slots) e do PNG — `imaging/scheme-card-portrait.txt`.
- `LocalSchemeComposerCharacterizationTest`: 16 composições, `toComposition`, `onePerType`, `slotOf`, `synthesize` —
  `ai/local-scheme-composer-portrait.txt`.

Os três retratos saíram idênticos em execuções repetidas no original e depois da refatoração.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='SchemeCardRendererCharacterizationTest,LocalSchemeComposerCharacterizationTest,SchemeServiceCharacterizationTest,SchemeServiceTest,SchemeFiltersTest,SchemeRulesTest,SchemeRemixCharacterizationTest,SchemeRemixPrototypeTest,LookPreviewServiceTest,DnaServiceCharacterizationTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest,SchemeFormPayloadTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: testes do lote + caracterização | 43 testes, 0 falhas |
| Depois (mesmos retratos, mesmos SHA-256) | 43 testes, 0 falhas, 0 erros |
| `install` de `fai-web` com dependências | sucesso (`ServiceFakes` sem alteração) |
| Suíte completa de `fai-application` | 2043 testes, 0 falhas, 0 erros, 27 skipped |
| `fai-web` delegação/contrato | 700 testes, 0 falhas |
| Catraca | os 3 arquivos só como `APERTAR` (1271 → 249, 357 → 201, 346 → 200); 0 violações |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
- `SchemeService` ficou a 1 linha do teto: novos métodos públicos exigem extrair antes (ex.: mover os records de
  composição não é possível sem mudar o contrato `SchemeService.ComposeResult`).
