# Lote R90-mirror — `MirrorService` como Facade sobre colaboradores por caso de uso

Base: `claude/relaxed-pasteur-5b5466`. Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/MirrorService.java` (`java-service`, 250) | 1254 | 210 | 11 classes, tabela abaixo | **Facade** (estrutural) |

Colaboradores (todos `final`, package-private, sem Spring, no mesmo pacote; categoria `java-outro`, limite 250):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `MirrorSlots` | 149 | regras puras dos slots: `slotOf`, `schemeSlot`, leitura do `slots_json` (`accessories`, `single`, `allIds`), lista do espelho (`rack`, `putRack`, `addToRack`, `MAX_RACK`), `available`, `complete`, `missing`, `key` |
| `MirrorStore` | 77 | acesso ao estado e ao acervo: `stateEntity`, `slots`, `load` (só peças do dono), `restriction`, `eligible` |
| `MirrorStateView` | 225 | resposta do estado: `state`, `render` (limpeza de peças apagadas/de terceiros, ações, luz, restrição), `pieceView`, `silhouette`, `lookScores` |
| `MirrorAssembly` | 190 | montagem manual: `updateTipoLook`, `place`, `bring`, `unbring`, `remove`, `clear` |
| `MirrorSlotSuggestions` | 173 | sugestão por slot com IA validada (`suggest`), escolha manual do guarda-roupa (`wardrobe`) e o fallback `localAlternatives` |
| `MirrorInterpretation` | 138 | Vista-me — `KEYWORDS` (pt/en/es), `hasWord`, `localInterpretation` e `interpret` pela IA |
| `MirrorComposer` | 153 | Vista-me — `compose` (IA validada contra o acervo elegível, CA09), `localCompose`, `concat` |
| `MirrorVistaMe` | 158 | Vista-me — `vistaMe` (âncoras, gravação, sequência no quarto) e `another` |
| `MirrorTakeOneOff` | 115 | "Tira uma coisa": `takeOneOff` e `localTakeOneOff` |
| `MirrorHandoff` | 165 | usar/salvar/entregar ao RF5: `findExistingScheme`, `materialize`, `useLook`, `save`, `draft` |
| `MirrorStoryboard` | 60 | `grwmStoryboard` (Arrume-se Comigo) |

## Como foi dividido

- O código foi movido por faixas de linhas do original com um script de extração, sem mudar os corpos. As únicas
  mudanças são: a qualificação das chamadas de instância que passaram a outro colaborador (`stateEntity(…)` →
  `store.stateEntity(…)`, `slots(s)` → `store.slots(s)`, `load`, `restriction`, `eligible` → `store.…`; `render`,
  `pieceView` → `view.…`; `interpret` → `interpretation.interpret`; `compose(user…)` → `composer.compose(user…)`;
  `remove(user…)` em "Tira uma coisa" → `assembly.remove(user…)`), `import static` das regras puras de `MirrorSlots`
  e das constantes do serviço (os corpos continuam chamando `slotOf(w)`, `MAX_ACCESSORIES`…), e a retirada de
  `public`/`@Transactional` das cópias. Um script de conferência confirmou que toda linha dos colaboradores, tirados os
  qualificadores, existe no original (só os construtores são novos). Em `MirrorSlotSuggestions` o campo da visão se
  chama `stateView` porque `suggest` já tem uma variável local `view`.
- O serviço continua o único bean: as **17 anotações `@Transactional`** (com `readOnly` em `wardrobe` e `draft`) ficaram
  nos mesmos métodos públicos, e cada um delega numa instrução; `swap` continua chamando `suggest` do próprio serviço.
  Construtor de 15 argumentos, constantes públicas (`SLOTS`, `MAX_ACCESSORIES`, `MAX_SHOWN`), `DAY`, a interface
  `PieceRestrictionProvider` (implementada por `ChallengeService`) e o record `Interpretation` não mudaram;
  `ServiceFakes.FakeMirrorService` (fai-web) compila sem alteração. `LookScorer` é criado no construtor como antes.
- Mantidos no serviço como delegação por terem chamador fora da classe: `slotOf` (público; `CopilotLooks`,
  `ChallengeRuleEvaluator`, `ShowcaseService`, testes), `KEYWORDS` (mesmo objeto; `AutopilotService`),
  `localInterpretation` (`CopilotLooks`, testes), `localCompose`, `missing`, `complete` (testes).
- Saíram do serviço sem delegação (sem chamador fora da classe, inclusive testes e `fai-web`; agora nos colaboradores):
  `schemeSlot`, `stateEntity`, `slots`, `accessories`, `single`, `MAX_RACK`, `rack`, `putRack`, `addToRack`, `allIds`,
  `load`, `available`, `silhouette`, `pieceView`, `render`, `lookScores`, `restriction`, `key`, `localAlternatives`,
  `hasWord`, `interpret`, `compose`, `concat`, `localTakeOneOff`, `findExistingScheme`, `materialize`. Nada foi apagado.
- Chamadas internas que antes passavam por métodos públicos do próprio objeto (`eligible` dentro de `suggest`/`wardrobe`/
  `vistaMe`, `vistaMe` dentro de `another`, `remove` dentro de `takeOneOff`) agora vão direto ao colaborador. Como eram
  autochamadas, já não passavam pelo proxy do Spring; a única diferença seria uma subclasse que sobrescrevesse só o
  método interno — não há (o `FakeMirrorService` sobrescreve todos os públicos).

## Por que Facade (e não State)

`MirrorController`, `CopilotService`/`CopilotLooks`, `ChallengeService`, `AutopilotService`, `ShowcaseService` e
`ServiceFakes` continuam falando só com `MirrorService`, que esconde dez colaboradores por caso de uso e uma classe de
regras puras e coordena transação e dependências. A estrutura extraída é de fato uma fachada; não foi criada interface.
**State** foi avaliado e descartado: o "estado" da sessão do espelho é só a origem gravada no `slots_json`
(`manual` / `smart_mirror` / `vista_me`) com dois `if` em `place` e a leitura em `materialize`/`draft`; não há
transições explícitas nem comportamento que mude por estado além disso, então classes de estado seriam artificiais.
**Strategy** para IA × motor local também não: cada caso já usa o `AiEngine` com o fallback local como `Supplier`.

## Testes e equivalência

Caracterização antes (commit `384dbea`, no código original): novo `MirrorServiceCharacterizationTest` (284 linhas),
com ids fixos (`UUID(0x3A1A, n)`), datas de 2025, 18 peças da Ana (uma indisponível, uma à venda), 6 da Bia e 3 looks.
Usa o `CopilotRetrato` do pacote (chaves ordenadas, UUIDs como fichas, instantes e datas relativos a hoje). Dois retratos:

- `mirror/mirror-service-retrato-local.txt` (115 linhas, ~210 KB) — motor local real: `state`, `updateTipoLook`
  (ok/nulo/inexistente), `place` em todos os slots e 6 acessórios (teto de 4), `bring`/`unbring`/`remove`/`clear`,
  `eligible`, `suggest` e `wardrobe` em todos os slots e slot inválido, `swap`, `takeOneOff`, `draft` (com e sem
  origem), `grwmStoryboard`, `save` (e reaproveitamento), `useLook`, erros de look incompleto/vazio, três `vistaMe`,
  dois `another`, acervo sem peça de cima; regras puras (`localInterpretation` em pt/en/es, `localCompose`,
  `localAlternatives`, `localTakeOneOff`, `silhouette`, `missing`, `complete`, rack com teto, `key`, constantes).
- `mirror/mirror-service-retrato-ia.txt` — `AiEngine` mock com respostas roteirizadas passadas pelo parser de cada
  chamada: alternativa válida, ref inventada (auditada) e texto sem JSON em `suggest`; interpretação válida e inválida;
  composição com id fora do conjunto elegível, válida e com âncora ausente (as duas descartadas e auditadas); "Tira uma
  coisa" com ref válida e inválida. Retrata capacidade, `maxTokens`, `inputsUsed` de cada chamada e as chamadas ao `Audit`.

Os prompts com várias palavras-chave foram evitados de propósito: `KEYWORDS` é um `Map.ofEntries` e a ordem das
ocasiões nesses casos varia de uma JVM para outra (comportamento original, registrado em Pendências). O retrato saiu
idêntico em 4 execuções seguidas no original antes de ser versionado.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='MirrorServiceCharacterizationTest,MirrorServiceTest,MirrorScoresTest,MirrorWardrobePickerTest,CopilotServiceRetratoTest,CopilotAnswerTest,ChallengeServicesContractTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -am -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: `MirrorServiceTest` + `MirrorScoresTest` + `MirrorWardrobePickerTest` + caracterização | 19 testes, 0 falhas |
| Após o Facade (mesmos dois retratos) + testes do Copilot e contrato de desafios | **28 testes, 0 falhas, 0 erros** |
| `install` de `fai-web` com dependências (`ServiceFakes` sem alteração) | sucesso (sem erros de compilação) |
| Suíte completa de `fai-application` (depois) | 2042 testes, 0 falhas, 0 erros, 27 skipped — BUILD SUCCESS |
| `fai-web` `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 698 testes, 0 falhas — BUILD SUCCESS |
| Catraca | `MirrorService.java` só como `APERTAR` (1254 → 210); 0 violações; nenhum arquivo novo acima do limite |

Na caracterização, as chamadas às regras puras que saíram do serviço passaram a apontar para o colaborador
(`MirrorSlots.rack`, `MirrorStateView.silhouette`…); o retrato continuou byte a byte igual.

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
- Comportamento original preservado e anotado: em `localInterpretation`, quando o pedido casa várias palavras-chave, a
  ordem (e o corte em 3) das ocasiões depende da ordem de iteração do `Map.ofEntries`, que muda entre JVMs. Corrigir
  (ex.: `LinkedHashMap`) seria mudança de comportamento, fora deste lote.
