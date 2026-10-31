# Módulo 03 — perfil, usuário, preferências, LGPD e notificações: lote PREFS-VALUE-RULES-001

Base: `04bf53f` (lote 02), rebaseado sobre `claude/serene-thompson-yetcg5` (`05db23b`) antes do commit. Branch:
`gof/03-perfil`. `git status --short` limpo antes do lote. Primeiro lote temático do domínio 03.

## Mapeamento real do fluxo de preferências

`app/(site)/(app)/settings/page.tsx` e `app/(site)/providers.tsx` (client, `/api/me/preferences`)
→ `PreferencesController` (`fai-web`, 80 linhas: GET/PUT `/api/me/preferences`, GET `/api/preferences/options`,
PATCH `/api/me/profile`, PUT `/api/me/username`, GET `/api/usernames/{username}/availability`, POST `/api/me/avatar`,
`/api/me/avatar/rotate`, `/api/me/cover`)
→ `PreferencesService` (`@Transactional` em `get`, `update`, `updateProfile`, `changeUsername`, uploads)
→ **`PreferenceValueRules`** (novo, puro) → `UserPreferencesRepository` / `UserRepository` (entidades `UserPreferences`,
`User`) → `AssetCatalogService` (fundo do chrome, skins), `AuraPermissionsService`, `MediaService`, `Audit`, `HypeCache`
(invalidação pós-commit) → `Map` de resposta (`get`) / `Views.UserCard`.

Outros serviços do domínio lidos e **não alterados** neste lote: `AccountService` (746 linhas: `me`, dados sensíveis,
privacidade, consentimentos LGPD, exportação/download, exclusão agendada), `ProfileService` (296), `NotificationService`
(190), `MeController` (112).

## Problema concreto e decisão

`PreferencesService.update()` (~115 linhas) e `updateProfile()` (~48) misturavam, campo a campo, a normalização/validação
de valores livres do cliente (moeda, ordem do menu, fonte, core, cor dos containers, tom de pele, país, links, rosto do
manequim) e a regra de conflito entre aparelhos com I/O (repositórios, catálogo de assets, permissões AURA, auditoria,
cache). Essas regras são funções puras sem teste isolado; a única forma de testá-las era montar o serviço inteiro.

Extraí `PreferenceValueRules` (package-private, `final`, só métodos estáticos): `isStale`, `currency`, `fontScale`,
`coreAesthetic`, `containerColor`, `skinTone`, `country`, `navOrder` (+ `navList`/`invalidNav`), `links`,
`mannequinFace` (+ `clampNum`), as constantes `CORES`, `NAV_GROUP`, `NAV_HREF`. O serviço mantém **a mesma sequência de
`if`s** — então o primeiro erro continua sendo o mesmo quando há vários campos inválidos — e só delega o cálculo do valor.

Permanecem no serviço: fundo do chrome e skin de card (dependem de `AssetCatalogService`), gates AURA (503/permissão),
gravação em `User`/`UserPreferences`, `clientUpdatedAt`, auditoria, invalidação do `HypeCache` após commit, mídia de
avatar/capa (`requireOwnedMedia`), troca/checagem do @ (usa `IdentityService`, domínio 02 intocado).
`PreferencesService.CORES` (público) passa a apontar para a mesma lista; `validLinks` fica como delegação de uma linha
para os testes existentes.

**Padrão GoF: nenhum aplicado** — o problema era mistura de regra pura com I/O num método longo; extração de funções
puras resolve sem indireção.

### Padrões avaliados e não aplicados

- **Facade (atualizar preferências):** `PreferencesService` já é a fachada transacional do controller; outra camada só
  repetiria a assinatura de `update`.
- **Strategy (regra por campo / visibilidade por contexto):** as regras de valor são fixas e não variam por contexto;
  um mapa de estratégias por campo esconderia a ordem observável do primeiro erro. Visibilidade de perfil
  (`AccountService.defaultVisibility`, `ProfileService`) não foi tocada neste lote.
- **Builder (DTO de `get`):** o `LinkedHashMap` de `get()` é linear, sem parâmetros opcionais combinatórios; o construtor
  telescópico de `Update` é contrato de desserialização Jackson e dos testes — mudar exigiria tocar consumidores.
- **Observer (notificações pós-evento):** a invalidação do Hype já usa `TransactionSynchronization.afterCommit`; não há
  segunda projeção para justificar um publicador.
- **Adapter (fontes de perfil heterogêneas):** fora do escopo deste lote (`ProfileService`).
- **Singleton:** nenhum manual; a classe nova é utilitária estática sem estado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (novo `PreferencesServiceCharacterizationTest`, 6 testes: código de cada recusa, ordem do primeiro erro, normalização, limites do menu, conflito por `clientUpdatedAt` incluindo instante igual/anterior com valor inválido, país/links/rosto) + testes existentes | `mvn -B -q -pl fai-application -Dtest=PreferencesServiceTest,PreferencesServiceCharacterizationTest,CreatorOptOutPreferencesTest -Dsurefire.failIfNoSpecifiedTests=false test` | 21 testes, 0 falhas |
| Depois da extração + `PreferenceValueRulesTest` (5 testes) + `WardrobePrefillTest` (consumidor de preferências) | `mvn -B -q -pl fai-application -Dtest=PreferencesServiceTest,PreferencesServiceCharacterizationTest,CreatorOptOutPreferencesTest,PreferenceValueRulesTest,WardrobePrefillTest -Dsurefire.failIfNoSpecifiedTests=false test` | 30 testes, 0 falhas |
| Controller (delegação HTTP, fai-web) | `mvn -B -q -pl fai-web -am -Dtest=ControllerDelegacaoTest -Dsurefire.failIfNoSpecifiedTests=false test` | 697 testes, 0 falhas |
| Catraca de linhas | `python scripts/refactoring/line_ratchet.py` (da raiz da worktree) | ver "Métricas" |

Logs: `evidence/03-preferences-baseline.log`, `evidence/03-preferences-after.log`.
Sem banco, servidor, navegador, rede, IA paga ou dados pessoais reais (só o `World` sintético e `example.com`).

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `PreferencesService.java` (congelado no baseline em 540) | 540 linhas | 451 (−89; −16,5 %) |
| `update()` | ~115 linhas | ~95 |
| `updateProfile()` | ~48 linhas | ~41 |
| `PreferenceValueRules.java` (novo, limite 250) | — | 169 |
| Runtime combinado | 540 | 620 (+80: javadoc por regra, imports, delegação `validLinks`) |
| Testes novos | — | `PreferencesServiceCharacterizationTest` 182, `PreferenceValueRulesTest` 87 (limite 400) |

## Contratos preservados

URLs e métodos dos 9 endpoints de `PreferencesController`, record `Update` (todos os construtores), `ProfileUpdate`, chaves e ordem do mapa de
`get()`, códigos `MOEDA_INVALIDA`, `ORDEM_DO_MENU_INVALIDA`, `FONTE_INVALIDA`, `CORE_INVALIDO`, `FUNDO_INVALIDO`,
`COR_INVALIDA`, `TOM_INVALIDO`, `SKIN_INVALIDA`, `PAIS_INVALIDO`, `LINKS_DEMAIS`, `LINK_INVALIDO` e chaves i18n, ordem de
avaliação, regra "a mais recente vence" (RF23.CA02), privacidade/opt-out, `@Transactional`, auditoria, invalidação do Hype
pós-commit, contraste/redução de movimento. Sem mudança de DTO, schema, migration, frontend ou configuração.

## Riscos e pendências do domínio 03

- `AccountService` (746, congelado) é o maior arquivo do domínio: exportação LGPD (montagem do pacote) e exclusão
  agendada são os próximos candidatos, com caracterização de isolamento multiusuário e TTL de exportação.
- `ProfileService`/visibilidade pública × seguidores × privado: sem alteração; candidato a Strategy só se surgir uma
  terceira política real.
- Páginas `/settings`, `/notifications`, `/u/[username]`: não alteradas (lote só backend).
- COVERAGE*/INDEX não editados (consolidação do orquestrador). `PreferencesService.java` deve ter o teto apertado para
  451 no `--update` da integração.
