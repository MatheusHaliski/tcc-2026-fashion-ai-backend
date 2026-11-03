# Lote R86-copilot — `CopilotService` como Facade e `CopilotLexicon` por família de vocabulário

Base: `claude/relaxed-pasteur-5b5466` (`3c82992`). Branch: `worktree-agent-a11169b68b30dd414`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `CopilotService.java` (`java-service`, 250) | 1419 | 217 | 13 arquivos, tabela abaixo | **Facade** (estrutural) |
| `CopilotLexicon.java` (`java-outro`, 250) | 317 | 217 | `CopilotBackgroundLexicon` (96), `CopilotPieceVocabulary` (167) | NENHUM (tabelas de dados) |

Arquivos novos (todos package-private, sem Spring; nenhum é bean):

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---:|---|---|
| `CopilotContext` | 80 | as 20 dependências injetadas + `LookScorer`, o histórico `shown` (looks já mostrados) e `moments` (setter: único estado mutável) | NENHUM (objeto de parâmetros) |
| `CopilotTools` | 178 | base dos colaboradores (mesmos nomes de campo do serviço) e ferramentas do servidor: `searchPieces` (buscar_pecas), `nameMatch`, `chip`, `activeMoments`, `scoreLooks`, fundo pedido nos looks | NENHUM |
| `CopilotText` | 27 | `normalized`, `mentions`, `startsWithWord` (funções puras) | NENHUM |
| `CopilotIntents` | 62 | `HYPE_QUESTION`, `BUILD_REQUEST`, `intent`, `hasPieceConstraints` | NENHUM (ver abaixo) |
| `CopilotLookPrompt` | 67 | `lookPrompt` (ocasiões, estilos, humor, estação, clima) | NENHUM (função pura) |
| `CopilotBackgroundPrompt` | 198 | `catalogEntries`, `namedEntry`, `orientation`, `backgroundPrompt` (Background Studio) | NENHUM |
| `CopilotPanel` | 133 | `promptsFor`, `context`, `suggestions` | NENHUM |
| `CopilotClosetAnswers` | 120 | `whereIs` (CA09), `forgotten` (CA11), `improveInventory` (CA13) | NENHUM |
| `CopilotHypeAnswer` | 143 | `hypeAnswer`, `potential`, `comeback`, `similarGrowth`, `dim` | NENHUM |
| `CopilotLooks` | 193 | `different` (CA12), `draft`, `looks` (CA02/CA03/CA05), `lookSummary` | NENHUM |
| `CopilotMoments` | 91 | `strings`, `detectMoment`, `withMomentMatch`, `momentNotice` (§17–§18) | NENHUM |
| `CopilotDiagnosis` | 106 | `diagnosis` (§3.3/CA14), `purchaseSuggestions` | NENHUM |
| `CopilotConversation` | 188 | `REF`, `general`, `ANSWER_FIELDS`, `plainAnswer`, `compactSummary` | NENHUM |
| `CopilotBackgroundLexicon` | 96 | família de fundo: AURA (presets e variações), materiais de fundo, gradientes, cartela sazonal e as pistas (`MATERIAL_CUES`, `SEASONAL_CUES`) | NENHUM (dados) |
| `CopilotPieceVocabulary` | 167 | família de peça: termos de base `COLOR_WORDS`/`TYPE_WORDS`/`MATERIAL_WORDS` (vindos do serviço) e prefixos ampliados `COLOR_PREFIXES`/`TYPE_PREFIXES`/`PIECE_MATERIALS` (vindos do léxico), com a mesma fusão `putIfAbsent` | NENHUM (dados) |

Testes novos: `CopilotServiceRetratoTest` (113), `CopilotRetratoFixture` (220), `CopilotRetrato` (126) e o retrato
`fai-application/src/test/resources/copilot/copilot-service-retrato.txt` (351 linhas).

## Como foi dividido

- **Facade.** `CopilotService` continua o único bean e mantém: o construtor (mesma assinatura — Spring, `ServiceFakes.FakeCopilotService`, `StubCopilot` de `SealCopilotRoutesTest` e `SealPolicyChatTest` dependem dela), `setSealPolicyService`, `setMoments`, `MIN_PIECES`, o record público `AskRequest`, os tipos internos (`Intent`, `LookPrompt`, `BackgroundPrompt`, `Answer`, usados pelos testes), as 6 assinaturas públicas (`context`, `suggestions`, `orientation`, `ask`, `accept`, `purchaseSuggestions`) com as mesmas anotações `@Transactional` (`context`/`suggestions` readOnly, `ask`/`accept` de escrita; `orientation` continua sem transação) e o roteamento do `ask` (desenho de selo, sanitização, `switch` por intenção, campos comuns e aviso de desafio).
- **Colaboradores criados por chamada** (`new CopilotLooks(ctx).looks(...)`), como no R81: leem `moments` do `CopilotContext` na criação e não guardam estado; o histórico `shown` vive no contexto (um por serviço, como antes). As chamadas que eram auto-invocação (`diagnosis → forgotten`, `looks → detectMoment/withMomentMatch/momentNotice`) viraram chamada direta ao colaborador; como nunca passavam pelo proxy, tudo segue na transação do método público.
- **Corpos movidos sem alteração**, por script (faixas de linhas do original → colaborador): `CopilotTools` expõe os mesmos nomes de campo (`pieces`, `room`, `hype`…) e as funções estáticas entram por `import static`. Conferido por script: as únicas linhas do original ausentes no código novo são campos/atribuições do construtor (agora em `CopilotContext`/`CopilotTools`), o campo e o setter de `moments` (agora `ctx.moments`), os 3 separadores de seção, as 8 linhas do `switch` do `ask`, as 3 de fusão do vocabulário (`CopilotLexicon.COLOR_PREFIXES.forEach` → `COLOR_PREFIXES.forEach`, mesmo arquivo agora), `backgroundPrompt` de 3 argumentos, `restrictionNotice`/`accept` (`challenges`/`autopilot`/`dailyLookService` → `ctx.…`) e as chamadas entre colaboradores listadas acima. No léxico, só mudaram as referências `CopilotService.mentions/normalized` → `CopilotText` (código e javadoc).
- **Reexportação.** O serviço mantém delegações estáticas finas com os nomes de antes para o que testes e o léxico usam (`intent`, `lookPrompt`, `hasPieceConstraints`, `normalized`, `mentions`, `startsWithWord`, `plainAnswer`, `lookSummary`, `promptsFor`, `draft`, `purchaseSuggestions`), além de `searchPieces(UUID, String)`, `backgroundPrompt` de 3 argumentos e os aliases `COLOR_WORDS`/`TYPE_WORDS`/`MATERIAL_WORDS` (mesmos objetos). `CopilotLexicon` reexporta os mapas de fundo e de peça (mesmos objetos) — nenhum teste ou consumidor mudou de import.
- **Background Studio também como campo do serviço**: `CopilotLexiconTest` cria o serviço com `Mockito.mock(..., CALLS_REAL_METHODS)` (construtor não roda, `ctx` fica nulo) e injeta `backgroundStudio` por reflexão; `orientation` e `backgroundPrompt` do serviço usam esse campo, então o teste continua igual.
- **Package-private sem chamadores fora do serviço** saíram sem delegação (os donos estão na tabela): `searchPieces(UUID, String, boolean)`, `backgroundPrompt` de 4 argumentos, `catalogEntries`, `namedEntry`, `nameMatch`, `chip`, `whereIs`, `forgotten`, `improveInventory`, `different`, `diagnosis`, `looks`, `activeMoments`, `strings`, `detectMoment`, `withMomentMatch`, `momentNotice`, `scoreLooks`, `hypeAnswer`, `potential`, `comeback`, `similarGrowth`, `dim`, `general`, `compactSummary`, `REF`, `ANSWER_FIELDS`, `HYPE_QUESTION`, `BUILD_REQUEST`. O único texto externo que citava um deles (javadoc de `LensService` sobre `CopilotService.scoreLooks`) passou a citar `CopilotTools.scoreLooks`.
- **Léxico por família de vocabulário**: `CopilotLexicon` fica com moda e clima (ocasião, estilo, humor, estação, faixa de clima) e com as consultas (`matches`, `first`, `weatherBand`, `seasonOfBand`, `variantSuffix`, `signalsLook`, `keywords`); fundo foi para `CopilotBackgroundLexicon` e peça para `CopilotPieceVocabulary`, que também recebeu as palavras de base de cor/tipo/material que estavam no serviço (mesma família). Ordem de inserção preservada: os prefixos ampliados são preenchidos antes das palavras de base, e a fusão `putIfAbsent` roda depois das duas, como antes. As linhas já compactas desses blocos de dados (vários `put`/`color(...)` por linha) foram movidas no estilo que tinham.

## Por que Facade (e não outros)

- **Facade:** controllers (`AutopilotController`, `SchemeController`), `PersonalInsights`, o fake de `fai-web` e os stubs de teste continuam vendo uma interface única e estável; o subsistema fica em colaboradores coesos por caso de uso (painel, intenções, respostas, ferramentas, contexto).
- **Chain of Responsibility (roteamento de intenções):** avaliado e não aplicado. `CopilotIntents.intent` é uma sequência de 7 regras (regex/vocabulário) dentro de uma única função, sem objetos tratadores; transformar cada `if` em classe seria criar estrutura artificial, e a ordem fixa já é legível e testada (`CopilotHypeIntentTest`, `CopilotLexiconTest`, retrato).
- **Strategy (respostas por intenção):** avaliado e não aplicado. O `switch` do `ask` chama métodos com assinaturas diferentes (`whereIs(user, message, view)`, `forgotten(user)`, `looks(user, req, message)`…), não uma família intercambiável sob uma interface; uniformizar exigiria inventar um contrato. O `switch` sobre o enum continua exaustivo (o compilador cobra intenção nova).
- **Template Method (base `CopilotTools`):** a base só compartilha dependências e ferramentas; não há esqueleto com passos sobrescritos.
- **Léxico:** tabelas de dados com funções de consulta; nenhum padrão se aplica (NENHUM).

## Testes e equivalência

Caracterização antes da extração (commit `c876862`, no código original): `CopilotServiceRetratoTest` passa 25 frases fixas
(PT/EN/ES) por `intent`, `lookPrompt` (com e sem ocasião/humor pedidos), `hasPieceConstraints`, `backgroundPrompt`,
`orientation` e `searchPieces`, mais casos de fundo (hex, container, AURA com gif, AURA desconhecida/recomendada,
cartela sazonal), `plainAnswer`, `lookSummary`, `purchaseSuggestions`, `draft`, `context`, `suggestions`, `ask` com as
25 frases (todas as 8 intenções, Momento citado, filtro sem peça, rodada repetida que exclui as chaves anteriores,
mensagem vazia, acervo arquivado e com poucas peças) e `accept`, e grava o retrato textual (mapas com chaves ordenadas,
UUIDs por fichas, datas relativas a hoje, entidades por id, erros por classe/código) com as chamadas a `AiEngine.text`
(prompt e resposta local), `AutopilotService`, `Audit` (ref descartada `p99`), `SchemeService.view` e `DailyLookService`.
Rodado 3× no original (mesmo MD5). Registra como comportamento atual um `UnsupportedOperationException` em
`backgroundPrompt("aura animada gif com material veludo")` (ver Pendências).

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original), testes do lote | `mvn -B -o -pl fai-application -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false "-Dtest=Copilot*Test,SealPolicyChatTest,PersonalInsights*Test,LensService*Test,SchemeService*Test" test` | 55 testes, 0 falhas (com o retrato) |
| Depois, mesma lista | idem | **55 testes, 0 falhas** (retrato idêntico) |
| Suíte completa `fai-application`, depois | `mvn -B -o -pl fai-application -Djacoco.skip=true test` | ver relatório do integrador abaixo |
| `fai-web` (compila tudo que depende) | `mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install` | ver abaixo |
| `fai-web` | `mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false "-Dtest=ControllerDelegacaoTest,SealCopilotRoutesTest" test` | ver abaixo |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | `APERTAR CopilotService.java 1419 -> 217`, `APERTAR CopilotLexicon.java 317 -> 217`; 0 violações |

Sem banco, servidor, rede, IA paga, migration ou mudança de DTO/URL/i18n/autorização/transação.

## Pendências

- `python -m scripts.refactoring.line_ratchet --update` fica para o integrador (o baseline não foi tocado).
- Comportamento pré-existente, preservado e só registrado: em `CopilotBackgroundPrompt.backgroundPrompt`, quando a AURA
  vem da recomendação do Background Studio (`scheme.put("aura", Map.of("variantId", id))`, imutável) e a mensagem pede
  material e "gif/animado/dinâmico", o `put("format", "IMAGEM_UNICA")` final lança `UnsupportedOperationException`.
  Corrigir é mudança de comportamento, fora deste lote.
