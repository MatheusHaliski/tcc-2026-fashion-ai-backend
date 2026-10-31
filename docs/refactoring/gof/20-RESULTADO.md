# Módulo 20 — admin, governança, segurança e qualidade: lote ADMIN-VIEWS-001

Base: `d8107c6` (`claude/serene-thompson-yetcg5`, após o lote 16). Branch: `gof/20-admin`. `git status --short` limpo
antes do lote. O lote 16 já tinha trocado duas chamadas em `AdminService.hypeV2State()` para `DashboardHypeBlocks`;
este lote não toca esse método nem `DashboardService`/`DashboardAlerts`/`DashboardHypeBlocks`.

## Mapeamento real (só o necessário ao lote)

`app/(site)/(app)/admin/moderation|system|dashboard/page.tsx` → `lib/api` → `AdminController` (`/api/admin`, `fai-web`)
→ `AdminService` (`@Transactional(readOnly = true)` + `guard.requireAdmin`) → repositórios
(`ModerationQueueRepository.findByStatusOrderByCreatedAtAsc`, `WardrobeItemRepository.findById`,
`AuditLogRepository.findTop200…/findTop100ByActor…`, `AiInferenceLogRepository.findTop300…` + `limit(100)`,
`BackupRecordRepository.findTop50…`) → entidades `ModerationQueueItem`, `AuditLog`, `AiInferenceLog`, `BackupRecord`
→ **`AdminViews`** (novo, puro) → `Map<String,Object>` serializado pelo controller.

Endpoints afetados (somente leitura, sem mudança de contrato): `GET /api/admin/moderation`, `GET /api/admin/audit`,
`GET /api/admin/ai`, `GET /api/admin/backups`.

## Problema concreto e decisão

`AdminService` (314 linhas, congelado no baseline) misturava, nos quatro métodos de leitura, autorização + consulta
limitada com a montagem campo a campo das views — incluindo a regra de **minimização** da foto retida (sai só o
endpoint autenticado `/api/admin/moderation/{id}/image`, nunca a chave em `restricted/`, e só os metadados
`kind/engine/signals`) e as conversões para texto de campos opcionais. Essa montagem não era testável sem montar o
service inteiro.

Extraído `AdminViews` (package-private, `final`, só funções estáticas): `moderationItem(q, pieces)`, `auditEntry`,
`aiCapability`, `aiCall`, `backup`. A busca da peça entra como `Function<UUID, Optional<WardrobeItem>>`
(`pieces::findById`), consultada só para itens `PIECE` com alvo — mesma semântica de antes, inclusive `imageUrl`
presente com valor `null` quando a peça existe sem imagem.

Permanecem no service, sem alteração: `guard.requireAdmin`, `@Transactional`, as consultas e seus limites
(200/100/300→100/50), `moderate` (transição, motivo sanitizado com `InputSanitizer.clean(…, 300)`, autor, auditoria),
`moderationImage`, contas, backups/jobs e `hypeV2State`.

### Padrões avaliados e não aplicados

- **State (moderação):** a fila tem só `PENDING_REVIEW → APPROVED|REJECTED`, decidida por um booleano; uma máquina de
  estados acrescentaria classes sem regra nova. Observação (não alterada, ver riscos): `moderate` hoje aceita redecidir
  um item já decidido.
- **Command (ações auditáveis/idempotência):** `runJob` é um `switch` de 6 jobs que só delegam; idempotência pertence
  a cada job. Introduzir Command mudaria a superfície sem problema concreto neste lote.
- **Facade:** `AdminService` já é a fachada do controller.
- **Strategy/Adapter/Observer:** sem variação de política ou integração externa nas views.
- Resultado: **padrão não aplicado**; extração de função pura (mapeamento de views) com testes.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (8 testes novos em `AdminViewsCharacterizationTest`: chaves/ordem do item PIECE, peça inexistente, COMMENT, foto retida com/sem metadados e sem vazar a chave restrita, auditoria com ip nulo e metadados, IA com limite 100 e textos, backups com opcionais, RBAC com `Guard` real: comum e anônimo negados, admin autorizado) + `AdminServiceTest` | `mvn -B -q -o -pl fai-application -Dtest='AdminViewsCharacterizationTest,AdminServiceTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 12 testes, 0 falhas |
| Depois + `AdminViewsTest` (5, unidade pura) + `AdminBootstrapTest` + `BackupJobTest` | `mvn -B -q -o -pl fai-application -Dtest='AdminViewsCharacterizationTest,AdminViewsTest,AdminServiceTest,AdminBootstrapTest,BackupJobTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 27 testes, 0 falhas |
| Delegação dos controllers (`fai-web`, inclui `AdminController`) | `mvn -B -q -o -pl fai-web -am -Dtest='ControllerDelegacaoTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 697 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | `AdminService` apto a apertar 314 → 286; 0 violações nos arquivos do lote (1 preexistente fora do lote: `scripts/catalog/canonical_full_frame.py`) |

Logs: `evidence/20-admin-views-baseline.log`, `evidence/20-admin-views-after.log`. Sem banco, servidor, rede, IA paga
ou dados reais; nenhum seed administrativo.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `AdminService.java` (congelado) | 314 | 286 (−28) |
| `AdminViews.java` (novo) | — | 79 |
| Runtime combinado | 314 | 365 (+51: javadoc, assinaturas e imports) |
| `AdminViewsCharacterizationTest.java` / `AdminViewsTest.java` (novos) | — | 184 / 85 |

## Contratos preservados

URLs, verbos, RBAC (`requireAdmin` antes de qualquer consulta), limites/paginação, chaves e valores dos mapas
(inclusive `"null"` textual de opcionais e ordem do `LinkedHashMap` da fila), minimização da foto retida, auditoria das
ações, transações. Sem mudança de DTO, schema, migration, i18n ou configuração.

## Riscos e pendências

- `moderate` permite redecidir item já `APPROVED/REJECTED` (sem guarda de transição nem verificação de revisão
  simultânea além do `@Version` da entidade). Mudar isso altera política efetiva; fica para lote com decisão de produto.
- `auditEntry`/`aiCall`/`backup` usam `Map.of` (como antes): um campo obrigatório nulo (ex.: `actor`) lança NPE —
  comportamento herdado, documentado aqui, não alterado.
- `runJob` e `setStatus/setRole` seguem no service; candidatos a lote próprio (motivo obrigatório no papel, trilha
  antes/depois do papel anterior).
