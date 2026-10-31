# Módulo 16 — controllers, services, DTO e erros Java (transversal): lote DASHBOARD-PURE-BLOCKS-001

Base: `bcaee73` (main após PR #416). Branch: `gof/16-java-transversal`. `git status --short` limpo antes do lote.
A worktree parte de um commit anterior aos lotes temáticos já integrados; as violações da catraca em arquivos de outros
lotes (IdentityService, WardrobeService, SealService…) vêm daí e não foram tocadas.

## Escolha do alvo transversal

Triagem dos candidatos sugeridos no brief:

- **Controllers do `fai-web`:** nenhum está congelado no `line_baseline.json` (o maior, `WardrobeController`, tem 246
  linhas). O parse que existe (`HypeController.type/ids`) é pequeno, coeso e do domínio 08. Sem lote justificável.
- **`GlobalExceptionHandler` (123 linhas) / `ErrorWriter` / `ApiError`:** já é uma tabela exceção → (status, código,
  mensagem i18n) com um único `respond`; não há duplicação nem política variante. **Não alterado** (refatorar seria
  só por estética, e qualquer deslize muda status/código observados pela UI).
- **`DashboardService` (414 linhas, congelado):** dashboard gerencial (ADMIN) + painel do emissor (MARCA/CELEBRIDADE).
  É transversal por natureza — agrega analytics, IA, selos, backups e HypeScore — e não pertence a nenhum lote temático
  em curso nem aos arquivos proibidos. **Escolhido.**

## Mapeamento real

`app/(site)/(app)/dashboard` (admin) e painel do emissor → BFF `/bff/api/**` → `DashboardController`
(`GET /api/admin/dashboard`, `GET /api/me/issuer-dashboard`, `PUT /api/me/dashboard-layout`) → `DashboardService.admin|issuer|saveLayout`
(`@Transactional`) → `AnalyticsQueryPort` (procedures/views MySQL), `SealService.issuerMetrics`, `AiEngine`,
`BackupRecordRepository`, `UserPreferencesRepository` (layout JSON) → `Map<String,Object>` serializado pelo Jackson.
`AdminService` (Admin › Sistema, P3-14) reutiliza `hypeJob`/`hypeV2Block` do mesmo pacote.

## Problema concreto e decisão

O service misturava três coisas: (1) orquestração com I/O e transação (`admin`, `issuer`, `system`, `layout`,
`saveLayout`, `filter`); (2) **regras puras de alerta** (limiares que transformam KPIs em decisão + picos de segurança,
~85 linhas); (3) **montagem pura dos blocos HypeScore v2** (faixas, cobertura, estado do job, Hype dos looks do emissor,
~140 linhas), que inclusive já era consumida por outro bean (`AdminService`) através de `DashboardService.hypeJob` —
acoplamento de um service ao outro só para chegar a uma função pura.

Extração (sem mudança de comportamento, mesmo pacote, package-private, sem Spring):

- `DashboardAlerts` (78 linhas): `alerts`, `securityAlerts`, `alert`, `num`.
- `DashboardHypeBlocks` (163 linhas): `ISSUER_TOP`, `hypeV2Block`, `hypeJob`, `issuerHype` (+ `topLook` extraído da
  lambda do top 3), `truthy`, `round1`.
- `DashboardService` mantém guarda (`requireAdmin`, `guard.deny` do emissor), `@Transactional`, portas, relógio
  (`Instant.now()` continua sendo lido no service e injetado no bloco), layout e saúde do sistema.
- `AdminService` passa a chamar `DashboardHypeBlocks` diretamente (2 linhas trocadas, mesma contagem).

### Padrões avaliados e não aplicados

- **Strategy (alertas):** os 7 alertas são limiares fixos sem variação por perfil/tenant/config; uma interface por regra
  só espalharia a ordem (observável na UI). Funções puras em sequência bastam.
- **Chain of Responsibility (alertas):** diferente do cadastro (domínio 02), não há aplicabilidade por tipo nem `details`
  acumulado — a lista é concatenação simples. Padrão não justificado.
- **Builder/Adapter (blocos de resposta):** a resposta é `Map` com chaves estáveis consumidas pelo frontend; trocar por
  DTO tipado mudaria serialização (ordem/nulos). Fora do escopo de um lote seguro.
- **Facade:** `DashboardService` já é a fachada transacional do controller.
- **Template Method no `GlobalExceptionHandler`:** só há um passo comum (`respond`), já fatorado.
- **Singleton:** só beans Spring; classes extraídas são utilitárias estáticas com construtor privado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (novo `DashboardServiceCharacterizationTest`, 7 testes pelas portas públicas: ordem exata das 26 chaves de `admin`, ordem das 6 séries, limiares nos valores-limite (20 / 21 / >0 / custo 0 ignorado / texto "3.5" / lixo = 0), concatenação negócio → segurança com títulos pt-BR exatos, `PERIODO_INVALIDO`/`PERIODO_LONGO`, normalização de país/tipo, recusa do emissor PESSOAL, mescla e filtragem do layout) + existentes | `mvn -B -pl fai-application -Dtest='Dashboard*Test,Block7RulesTest,AdminService*Test' -Dsurefire.failIfNoSpecifiedTests=false test` | 22 testes, 0 falhas |
| Depois da extração + `DashboardAlertsTest` (5) + `DashboardHypeBlocksTest` (3: `truthy`/`round1`, top limitado/desempate por título/nível ausente, timestamp ilegível) | mesmo comando | 30 testes, 0 falhas |
| Delegação HTTP de todos os controllers, incluindo `DashboardController` (dublês de serviço) | `mvn -B -q -pl fai-web -am -Dtest='ControllerDelegacaoTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 697 testes, 0 falhas/erros |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | `APERTAR DashboardService 414 -> 217`; 0 violações nos arquivos deste lote (14 preexistentes de outros lotes, por a worktree ser antiga) |

`DashboardHypeV2Test` e `Block7RulesTest` só tiveram o alvo das chamadas estáticas trocado
(`DashboardService.x` → `DashboardHypeBlocks.x` / `DashboardAlerts.alerts`); asserções intactas.

Logs: `evidence/16-dashboard-baseline.log`, `evidence/16-dashboard-after.log`.
Sem banco, servidor, rede, IA paga ou deploy.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `DashboardService.java` (congelado 414) | 414 | 217 (−197; −47,6 %) |
| `DashboardAlerts.java` (novo) | — | 78 |
| `DashboardHypeBlocks.java` (novo) | — | 163 |
| `AdminService.java` (congelado 314) | 314 | 314 (2 linhas trocadas) |
| Runtime combinado | 414 | 458 (+44: cabeçalhos, javadoc de classe, imports, construtores privados) |
| Testes novos | — | 154 + 51 + 60 |

## Contratos preservados

URLs, métodos, autorização (`requireAdmin`, `guard.deny("dashboard:issuer")`), códigos `PERIODO_INVALIDO`/
`PERIODO_LONGO`, chaves e ordem do `Map` de resposta, ordem dos alertas, textos i18n e formatação decimal por locale,
"sem dados" = nulo no HypeScore v2, `@Transactional` (readOnly em `admin`/`issuer`), layout de widgets.
Sem DTO, schema, migration ou configuração alterados. `GlobalExceptionHandler`/`ApiError` intocados.

Mudança de API Java interna: `DashboardService.hypeJob` era `public static`; agora é `DashboardHypeBlocks.hypeJob`
package-private. Único consumidor era `AdminService` (mesmo pacote); `fai-web` não o referencia.

## Riscos e pendências

- `DashboardService.admin` ainda monta ~30 chaves em sequência; um DTO tipado exigiria contrato com o frontend
  (`app/(site)/(app)/dashboard`) e teste de serialização — fora deste lote.
- `system()` lê `Runtime`/`ManagementFactory` diretamente (não determinístico); deixado no service por ser I/O.
- Não há MockMvc dedicado ao `DashboardController` (só o teste de delegação genérico); candidato a lote 21.
- `GlobalExceptionHandler`: sem teste unitário dedicado por exceção (coberto indiretamente por testes de segurança);
  candidato a lote de testes, sem refatoração necessária.
