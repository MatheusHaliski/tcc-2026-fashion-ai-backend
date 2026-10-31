# Onda temática 02–20 — um lote seguro por domínio

Branch `claude/serene-thompson-yetcg5`, base `bcaee73` (main após PR #416). Cada lote foi executado numa worktree
isolada a partir do prompt do domínio, com o mesmo protocolo: código real lido, teste de caracterização escrito e
aprovado **no código original** antes da extração, extração de uma responsabilidade, testes do domínio e dos
consumidores, relatório `NN-RESULTADO.md` e logs em `evidence/NN-*`. O orquestrador integrou por cherry-pick,
atualizou `COVERAGE*.csv` e apertou a catraca de linhas (`scripts/refactoring/line_ratchet.py`, ver
`../LINE_RULES.md`). Nenhum deploy, banco real, IA paga, GPU, bucket ou conta real.

## Lotes

| Dom. | Fluxo | Extração (novo arquivo) | Padrão GoF | Arquivo original (linhas) | Caracterização antes → testes depois |
|---|---|---|---|---|---|
| 02 | FLOW-AUTH-REGISTER-FORM-005 | `RegistrationFormChain` | Chain of Responsibility (pipeline) | IdentityService 1079 → 1007 | 35 → 57 |
| 03 | FLOW-PROFILE-PREFS-008 | `PreferenceValueRules` | nenhum (funções puras) | PreferencesService 540 → 451 | 21 → 30 (+697 web) |
| 04 | FLOW-WARDROBE-CLOSET-007 | `ClosetQuery` | Strategy (Comparator) | WardrobeService 2792 → 2730 | 64 → 161 |
| 05 | FLOW-CATALOG-PHOTO-009 | `CatalogPhotoChoice` | nenhum | CatalogService 847 → 811 | 20 → 96 |
| 06 | FLOW-LOOKS-REMIX-006 | `SchemeRemixPrototype` | Prototype | SchemeService 1311 → 1271 | 16 → 43 |
| 07 | FLOW-SOCIAL-COUNTERS-010 | `InteractionCounters` | nenhum | SocialService 472 → 438 | 10 → 30 |
| 08 | FLOW-HYPE-INVENTORY-COMBOS-011 | `InventoryComboCounter` | nenhum | InventoryScoreService 1295 → 1178 | 34 → 51 |
| 09 | FLOW-FLAIR-CHALLENGE-REWARD-012 | `ChallengeRewardSplit` | Strategy (enum por modo) | ChallengeService 1888 → 1852 | 33 → 63 |
| 10 | FLOW-SEAL-PROMOTION-014 | `PromotionRules` | nenhum | SealService 2150 → 2097 | 154 → 161 |
| 11 | FLOW-ROOM-PLACEMENT-013 | `RoomPlacementRules` | nenhum | RoomService 1533 → 1436 | 48 → 65 (+48 consumidores) |
| 12 | FLOW-AVATAR-RULES-015 | `Avatar3dModelRules`, `Avatar3dBodyRules` | nenhum | Avatar3dService 889 → 600 | 36 → 47 (+697 web) |
| 13 | FLOW-AI-LENS-PROVENANCE-016 | `LensScanProvenance` | nenhum | LensService 1427 → 1363 | 26 → 46 (+4 web) |
| 14 | FLOW-AURA-ARTWORK-017 | `StudioArtworkRules` | nenhum | BackgroundStudioService 812 → 736 | 48 → 80 |
| 15 | FLOW-NEXT-EXPLORER-018 | `components/explorer/global-insights.tsx`, `lib/explorer/rank-bars.ts` | nenhum | explorer/page.tsx 352 → 214 | 10 → 14 (tsc ok) |
| 16 | FLOW-JAVA-DASHBOARD-020 | `DashboardAlerts`, `DashboardHypeBlocks` | nenhum | DashboardService 414 → 217 | 22 → 30 (+697 web) |
| 17 | FLOW-JPA-ANALYTICS-SQL-019 | `AnalyticsInsightsSql`, `AnalyticsDashboardSql` | nenhum | MysqlAnalyticsAdapter 348 → 227 | 13 → 17 (golden SQL byte a byte) |
| 18 | FLOW-PY-CANONICAL-GLB-021 | `scripts/catalog/canonical_glb.py` | nenhum | canonical_full_frame.py 345 → 259 | 15 → 22 (hash de pixels idêntico) |
| 19 | FLOW-ADAPTER-OCR-023 | `DbNetBoxes`, `CtcGreedyDecoder` | nenhum | OnnxTextReader 357 → 220 | 14 → 28 (saída OCR idêntica) |
| 20 | FLOW-ADMIN-VIEWS-022 | `AdminViews` | nenhum | AdminService 314 → 286 | 12 → 27 (+697 web) |

Padrões efetivamente aplicados: Chain of Responsibility, Strategy (2×), Prototype. Nos outros 16 lotes a decisão
registrada foi **não aplicar padrão** — o problema era regra pura misturada com I/O, resolvido por função/classe pura.
Cada `NN-RESULTADO.md` lista os padrões candidatos do prompt e o motivo de não aplicá-los.

## Tamanho de arquivo

- Arquivos congelados (acima do limite): 264 → 260; soma dos tetos 146.441 → 143.863 linhas (−2.578), além de
  IdentityService (−72) reduzido antes da criação do baseline. Saíram do baseline: `explorer/page.tsx`,
  `DashboardService`, `MysqlAnalyticsAdapter`, `OnnxTextReader`.
- Todos os arquivos novos de produção ≤ 250 linhas (maior: `Avatar3dModelRules`, 215) e testes novos ≤ 400.
- O runtime combinado (original + extraídos) cresce em todos os lotes (+43 a +100 linhas: javadoc, delegações
  mantidas por compatibilidade). O ganho é coesão e testabilidade isolada, não redução global de código.

## Achados registrados e NÃO corrigidos (mudariam comportamento)

Ver `RISK_REGISTER.md`. Exigem lote próprio com decisão do produto.

## O que esta onda não é

Um lote por domínio não refatora o domínio inteiro: todos os arquivos originais continuam PARTIAL, e cada relatório
lista o próximo candidato. Ver `RESIDUAL_FINDINGS.md` para as pendências contadas.
