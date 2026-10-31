# Módulo 07 — feed, descoberta, rede social e interações: lote SOCIAL-COUNTERS-001

Base: `bcaee73` (main após PR #416). Branch: `gof/07-social`. `git status --short` limpo antes do lote.

## Mapeamento real do fluxo de interações

`components/interactions.tsx` (`CardActions`/`InteractionBar`, usados em `scheme-card`, `dna-card`, `expanded-card/*`)
→ API `/api/interactions/{type}/{id}/{reactions|comments|saves|saves/favorite|shares|remixes|counters}` e
`DELETE /api/comments/{commentId}`
→ `SocialController` (94 linhas) / `CommentController` (34) (`fai-web`)
→ `SocialService` (`@Transactional`: `react`, `comment`, `deleteComment`, `toggleSave`, `favoriteSaved`, `share`,
`remix`, `returnToOrigin`, `counters`)
→ `target()` (visibilidade efetiva, bloqueio via `Guard`, moderação da peça)
→ `ReactionRepository`, `CommentRepository`, `SavedItemRepository`, `ShareRepository`
→ `bump()` = espelho no `CounterStorePort` + **`InteractionCounters.apply`** (novo, puro) sobre `Scheme`,
`WardrobeItem` ou `DnaScheme`
→ notificações (`NotificationService`), eventos `InteractionReceived`/`HypeSignal` → `Map` de resposta.

Feed/busca (`DiscoveryController` 97, `HighlightsController` 125 → `SearchService` 877 linhas) foram lidos, mas não
alterados: a maior parte do arquivo é Hype v2 (domínio 08) e visibilidade/cursor do feed, que pedem caracterização própria.

## Problema concreto e decisão

`SocialService.bump` (38 linhas) misturava I/O (espelho no `CounterStorePort`) com uma regra pura e sensível: **qual
campo persistido cada interação move por tipo de alvo e o piso em zero** (normalização de contagens — nunca negativa).
Era um `switch` por tipo de entidade com `switch` aninhado por campo, sem teste direto: peça e DNA não têm contador de
salvos e ignoravam `saves` silenciosamente, o que só se via lendo o código.

Extraído para `InteractionCounters` (package-private, final, sem Spring/repositório): `apply(entity, field, delta)`
com um método por tipo e `floor(current, delta) = max(0, current + delta)`. `bump` continua no serviço, na mesma
transação, chamando primeiro o store (mesmo nome em minúsculas, mesmo campo e delta) e depois a regra pura.

**Padrão GoF não aplicado.** Função pura com despacho por `switch` de padrão (Java 21) é a forma mais simples.

### Padrões avaliados e não aplicados

- **Visitor (contadores por tipo de entidade):** três entidades JPA sem hierarquia comum; exigiria `accept()` no
  domínio (fai-domain) para uma única operação. O prompt pede funções comuns nesse caso.
- **Strategy (por campo/tipo):** cinco campos fixos e três tipos; um mapa de estratégias seria só indireção.
- **Facade (operações sociais):** `SocialService` já é a fachada transacional dos controllers.
- **Observer (notificações/Hype):** já existe via `ApplicationEventPublisher` (`InteractionReceived`, `HypeSignal`);
  mexer nisso afetaria Hype (domínio 08).
- **Strategy (ordenação do feed em `SearchService`):** candidato real, mas `relevance` mistura Hype v2 público
  (domínio 08); fica para lote com caracterização de ordem/cursor.
- **Singleton:** nenhum manual introduzido.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (`SocialCountersCharacterizationTest`, 4 testes: campos do look + espelho no store; piso em zero ao descurtir/dessalvar/excluir comentário; peça sem `saves` mas store recebe o delta; DNA) + `SocialServiceTest` | `mvn -B -q -pl fai-application -Dtest='Social*Test' test` | 10 testes, 0 falhas |
| Depois da extração + `InteractionCountersTest` (4 testes puros) + consumidores de `SocialService` | `mvn -B -q -pl fai-application '-Dtest=Social*Test,InteractionCountersTest,VisibilityRulesTest,FlairCollectionServiceTest,PieceRemixTest' test` | 30 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos do lote; `SocialService` 472 → 438 (APERTAR). 4 violações preexistentes de outros domínios (ver riscos) |

Logs: `evidence/07-social-counters-baseline.log`, `07-social-counters-after.log`, `07-line-ratchet.log`.
Sem banco, servidor, navegador, rede, GPU ou contas reais. Suíte completa não rodada (máquina compartilhada).

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `SocialService.java` (congelado, teto 472) | 472 | 438 (−34; −7,2 %) |
| `InteractionCounters.java` (novo) | — | 68 |
| Runtime combinado | 472 | 506 (+34: javadoc e assinaturas por tipo) |
| Testes novos | — | `SocialCountersCharacterizationTest` 149, `InteractionCountersTest` 60 |

## Contratos preservados

URLs, payloads e chaves das respostas, `@Transactional`, autorização (`target`/`Guard`), ordem store → entidade,
nomes `scheme`/`piece`/`dna` no store, piso em zero, campos ignorados (peça/DNA sem `saves`), entidade nula continua
falhando com NPE (como o `switch` original). Hype, notificações e eventos intocados. Sem DTO, schema, migration,
i18n ou frontend alterados.

## Riscos e pendências do domínio 07

- `SearchService` (877, congelado) segue PENDING: cursor, filtros (`Filters`, `matches`), visibilidade e relevância
  são extraíveis como funções puras, mas `relevance` depende de Hype v2 público (08) — coordenar.
- `SocialService.react/toggleSave` têm toggle por leitura-e-escrita sem lock; a idempotência sob corrida depende da
  constraint única no banco (não testável sem banco). Não alterado.
- `CardActions`/`InteractionBar` (frontend) não tocados neste lote.
- A catraca acusa 4 violações em `IdentityService`, `PreferencesService`, `SchemeService`, `WardrobeService`: a base
  `bcaee73` desta worktree é anterior aos lotes já integrados que reduziram esses arquivos (baseline da branch
  principal). Não são arquivos deste lote; somem na integração.
