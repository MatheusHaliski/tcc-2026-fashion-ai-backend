# Módulo 08 — Hype, score, points, rankings, auditoria: lote INVENTORY-SCORE-COMBOS-001

Base: `bcaee73` (main após PR #416). Branch: `gof/08-hype`. `git status --short` limpo antes do lote.
Escopo deste lote: **FAI Inventory Score** (`InventoryScoreService`, RF34). Hype (`HypeQueryService`, `HypeCalculator`,
`HypeSnapshotService`) e FAI Points (`FaiPointsService`) não foram alterados.

## Mapeamento real

`app/(site)/(app)/highlights/page.tsx` (Destaques, Álbum, Retrospectiva, Rankings, Points)
→ `HighlightsController` (`fai-web`; `GET /api/me/highlights`, `/api/me/inventory-score/dimensions/{code}`,
`/api/me/inventory-score/hints`, `/api/inventory-score/method`, `/api/me/album`, `/api/me/retrospective/{year}`,
`PUT /api/me/rankings/opt-in`, `GET /api/me/rankings`, …)
→ `InventoryScoreService.compute` (`@Transactional`, cache 1 h) → `WardrobeItemRepository`, `SchemeRepository`,
`PieceUsageDiaryEntryRepository`, `WardrobeAvailabilityChangeRepository`, `StyleDnaRepository`,
`InventoryScoreSnapshotRepository`, `RankingOptInRepository`/`RankingPositionRepository`
→ **`InventoryComboCounter.count`** (novo, puro) → `Result.metrics` (`validCombos`, `combosEnumerated`,
`perPieceCombos`, `undiscoveredSample`) e dimensões V (versatilidade/cobertura) e R (descoberta)
→ `highlightsTab`, `album`, `improvementHints`, `recomputeRankings`.

Consumidor externo da mesma regra: `CopilotService.purchaseSuggestions` (`InventoryScoreService.combos(a, 0, null).total()`).

## Problema concreto e decisão

`InventoryScoreService` (1295 linhas, congelado) misturava I/O transacional, cache, rankings e eventos com a regra pura
de **contagem de combinações válidas** (§3.4/§7): `combos` (80 linhas, dois algoritmos — enumeração exata até 400.000
de trabalho e limite inferior por ocasião acima disso), `markCoverage`, `occ`, `shared`, `shareOccasion`, o record
`Combos` e a tabela `OCCASION_GROUPS`. Essa regra não depende de repositório, relógio nem Spring, é usada por dois
serviços e não tinha teste direto (a enumeração só era exercida indiretamente por `compute`; o ramo §7 acima de 400.000
e a amostra de combinações não descobertas não eram cobertos).

Decisão: extrair a regra para `InventoryComboCounter` (package-private, `final`, construtor privado, só métodos
estáticos), no mesmo pacote. O corpo de `combos` foi dividido em `enumerate` e `lowerBoundByOccasion` (mesmas
instruções, mesma ordem de iteração e de inserção na amostra) e o teste da amostra virou `sampleIfUndiscovered`
(mesma condição com curto-circuito). `InventoryScoreService.combos(...)` permanece como porta de 3 linhas que delega,
para que `CopilotService` (domínio de outro lote) não precise mudar.

Permanecem no serviço, sem alteração: pesos `WEIGHTS`, faixas `BANDS`, `COMBO_CATEGORIES`, completude/antifraude (§3.1/§5),
entropia/cosseno (usados por `DnaService`), uso/exposição, `compute` e sua transação/cache, rankings, snapshots e eventos.

### Padrões avaliados e não aplicados neste lote

- **Strategy (enumeração exata × limite por ocasião):** são dois algoritmos escolhidos por um único limiar fixo, sem
  configuração nem terceira variante; duas funções privadas são mais claras que uma hierarquia. Padrão não aplicado.
- **Strategy (regras de pontuação versionadas do FAI Points):** `FaiPointsService` não foi tocado; mudar a representação
  das regras exige caracterização de idempotência/concorrência do ledger que não cabe num lote pequeno.
- **Facade (API de consulta de score):** `InventoryScoreService`/`HypeQueryService` já são a fachada do controller.
- **Observer:** a invalidação do cache já é feita por `@EventListener` sobre `DomainEvents`; nada a mudar.
- **Decorator (cache):** o cache em memória do `compute` está acoplado ao `useCache` e ao `computeIsolated`
  (`REQUIRES_NEW`); separá-lo mudaria fronteiras transacionais — fora do escopo.
- **Singleton:** nenhum; a classe nova é utilitária estática, sem estado mutável além da tabela constante.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (6 testes novos em `InventoryCombosCharacterizationTest`: total/por peça/cobertura ordenada na enumeração, amostra com chave já descoberta e limite, amostra sem limite com vestidos, acervo vazio e sem ocasiões, limiar 400.000 inclusivo × 400.040, ramo §7 com 235 peças e total 336.000) + consumidores | `mvn -B -pl fai-application -Dtest=InventoryCombosCharacterizationTest,InventoryScoreServiceTest,Copilot*Test -Dsurefire.failIfNoSpecifiedTests=false test` | 34 testes, 0 falhas |
| Depois da extração + `InventoryComboCounterTest` (4: tabela de grupos/limite, ocasiões compartilhadas, porta do serviço ≡ chamada direta, entrada não mutada) + `ScoreBandsTest`, `Dna*Test` | `mvn -B -pl fai-application -Dtest=InventoryCombosCharacterizationTest,InventoryComboCounterTest,InventoryScoreServiceTest,ScoreBandsTest,Copilot*Test,Dna*Test -Dsurefire.failIfNoSpecifiedTests=false test` | 51 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `InventoryScoreService` APERTAR 1295 → 1178. 6 violações preexistentes em arquivos de outros lotes (base `bcaee73` anterior às reduções da branch principal) |

Os mesmos 6 testes de caracterização passaram sem mudança antes e depois. Logs: `evidence/08-inventory-combos-baseline.log`,
`evidence/08-inventory-combos-after.log`. Sem banco, servidor, rede, GPU ou dados reais; suíte completa não executada
(máquina compartilhada com outros lotes).

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `InventoryScoreService.java` | 1295 linhas | 1178 (−117; −9,0 %) |
| `InventoryComboCounter.java` (novo) | — | 160 |
| Runtime combinado | 1295 | 1338 (+43: javadoc, assinaturas dos dois algoritmos, construtor privado) |
| Testes novos | — | `InventoryCombosCharacterizationTest` 180, `InventoryComboCounterTest` 68 |

## Contratos preservados

Fórmulas, pesos, faixas, janelas (90 dias), saturação, antifraude, limiar de enumeração (400.000), grupos de ocasião e sua
ordem (chaves de `coverage` e da dica "uncovered"), ordem da amostra `undiscoveredSample`, chaves de `metrics`, DTOs,
URLs, `@Transactional`/`REQUIRES_NEW`, cache, eventos, rankings e snapshots. Nenhuma migration, schema, configuração ou
texto i18n alterado. Assinatura `InventoryScoreService.combos(List, int, Set)` mantida (tipo de retorno agora
`InventoryComboCounter.Combos`, mesmo record; o único chamador externo usa só `.total()`).

## Riscos e pendências do domínio 08

- `InventoryScoreService` continua PARTIAL (1178): `compute` (~280 linhas) mistura leitura de repositórios com o cálculo
  das 7 dimensões. Próximo candidato: extrair o cálculo puro das dimensões a partir de um "contexto" já carregado, com
  fixtures de regressão do `Result` inteiro.
- `HypeQueryService` (1512) e `HypeSnapshotService` (530) seguem congelados; `FaiPointsService` (411) exige, antes de
  qualquer mudança, testes de idempotência sob requisições concorrentes e atomicidade ledger/projeção.
- `CopilotService.purchaseSuggestions` não tem teste direto; protegido indiretamente pela caracterização de `combos(a, 0, null)`.
- COVERAGE.csv não editado (consolidação pelo orquestrador).
