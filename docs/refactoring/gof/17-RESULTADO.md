# Módulo 17 — entidades JPA, repositórios e Flyway: lote PERSIST-ANALYTICS-SQL-CATALOG-001

Base: `bcaee73` (main após PR #416). Branch: `gof/17-jpa`. `git status --short` limpo antes do lote.

## Varredura do domínio (código real, não índices históricos)

| Artefato | Quantidade | Observação |
|---|---|---|
| `@Entity` em `fai-domain` | 133 | só `WardrobeItem.java` está congelado no `line_baseline.json` (330 linhas) |
| `@Embeddable` / `@MappedSuperclass` | 2 / 2 | `VersionedAuditableEntity` (base com `@Version`/auditoria) |
| `@Converter` | 1 | |
| repositórios Spring Data (`extends JpaRepository/CrudRepository`) | 149 | |
| migrations Flyway | 82 | intocadas |
| arquivos congelados em `fai-domain`/`fai-infrastructure` | 4 | `WardrobeItem` 330, `MysqlAnalyticsAdapter` 348, `MysqlDemoDataAdminAdapter` 437, `OnnxTextReader` 357 |

Exclusões deste lote, com motivo:
- **`WardrobeItem`** (330): é só mapeamento (≈80 colunas + `markAvailable`). Não há regra de domínio nem conversão
  JSON a extrair; reduzi-la exigiria agrupar colunas em `@Embeddable`/`@AttributeOverride`, o que é mudança de
  mapeamento (proibida neste lote) e mexe nos acessores usados por dezenas de services. Fica PENDING.
- **`MysqlDemoDataAdminAdapter`** (437): escreve/apaga dados de demonstração; um lote seguro pede caracterização das
  ordens de DELETE/INSERT — fora do escopo de um lote pequeno.
- **`OnnxTextReader`** (357): OCR (domínio de IA), não persistência.

## Mapeamento real do fluxo escolhido

`app/(site)/(app)/admin/dashboard/page.tsx` → `GET /api/admin/dashboard` / `GET /api/me/issuer-dashboard`
(`DashboardController`), `AdminController`, `DiscoveryController` (`fai-web`)
→ `DashboardService` / `AdminService` / `ExplorerService` (`fai-application`, consumidores de `AnalyticsQueryPort`)
→ **`MysqlAnalyticsAdapter`** (`fai-infrastructure/persistence-mysql`, `NamedParameterJdbcTemplate`)
→ tabelas/views/procedures `users`, `wardrobe_items`, `schemes`, `audit_log`, `hype_scores`, `seal_bonds`,
`vw_brand_usage`, `sp_admin_kpis`, `sp_timeseries`… → `List<Map<String,Object>>` devolvida sem transformação.

## Problema concreto e decisão

`MysqlAnalyticsAdapter` (348 linhas, congelado) misturava duas responsabilidades: **o texto SQL** de 35 consultas
(text blocks longos, fragmentos compartilhados `USER_SCOPE`/`FAILURE_RESULTS`, montagem por `.formatted`/concatenação
a cada chamada) e **o binding JDBC** (`Filter`/`GlobalFilter` → `MapSqlParameterSource`, primeira linha ou vazio).
Ler o contrato do port exigia rolar por SQL; revisar uma consulta exigia achar o método.

Decisão: **extração de catálogo de consultas** (constantes puras), sem padrão GoF.
- `AnalyticsInsightsSql` (novo, package-private, 104 linhas): KPIs, séries, uso/custo de IA, marcas, países, cores,
  estações, faixas do inventário, selos, desafios, pontos, perfis, vínculos e filtros globais do mapa.
- `AnalyticsDashboardSql` (novo, package-private, 120 linhas): abas do dashboard administrativo + HypeScore v2;
  `USER_SCOPE`, `FAILURE_RESULTS`, a coorte do funil e as colunas de cobertura do hype ficam aqui. As montagens com
  `.formatted(...)` passam a rodar **uma vez** na carga da classe em vez de a cada requisição (mesmo texto).
- `MysqlAnalyticsAdapter` (227 linhas): só binding de parâmetros, `firstOrEmpty` (unifica `kpis`/`hypeJobV2`),
  `purgeNotifications` e `dbLatencyMs`. Sai do limite congelado (≤ 250).

### Padrões avaliados e não aplicados

- **Builder (SQL dinâmico):** nenhuma consulta muda de forma em runtime — os filtros opcionais já são resolvidos no SQL
  (`:x IS NULL OR …`). Um builder trocaria texto revisável por código e arriscaria mudar o SQL.
- **Strategy / Template Method por aba:** cada método é “SQL + parâmetros + `queryForList`”; não há algoritmo variável.
- **Adapter:** `MysqlAnalyticsAdapter` já é o Adapter (hexagonal) de `AnalyticsQueryPort`; não foi criada outra camada.
- **Iterator:** as consultas são agregações pequenas, sem paginação/cursor.
- **Repository Spring Data / `@Query`:** o resultado são mapas genéricos de agregação, não entidades; migrar para JPA
  mudaria tipos devolvidos.
- **Singleton:** constantes estáticas; nenhum Singleton manual; bean Spring inalterado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Golden gravado **no código original**: SQL exato + parâmetros nomeados (ordenados, `Timestamp` como Instant UTC) das 35 consultas | `mvn -pl fai-infrastructure/persistence-mysql -Dtest=MysqlAnalyticsSqlCharacterizationTest -Danalytics.golden.write=… test` | `analytics-sql-golden.txt`, 295 linhas |
| Caracterização **antes** da extração | `mvn -pl fai-infrastructure/persistence-mysql -Dtest='MysqlAnalytics*Test' test` | 13 testes (12 existentes + 1 golden), 0 falhas |
| Depois da extração + `AnalyticsSqlCatalogTest` (4: nenhum `%1$s`/`%2$s` sobrando, coorte nas 6 etapas do funil, recorte/falhas compartilhados, datas ISO do hype no SQL) | `mvn -pl fai-infrastructure/persistence-mysql -Dtest='MysqlAnalytics*Test,AnalyticsSqlCatalogTest' test` | 17 testes, 0 falhas; golden idêntico byte a byte |
| Suíte completa do módulo (sem banco) | `mvn -pl fai-infrastructure/persistence-mysql test` | 58 testes em 11 classes, 0 falhas/erros/skipped (inclui `AppliedMigrationChecksumsTest`, `MigrationVersionsTest`) |
| Catraca de linhas | `python …/scripts/refactoring/line_ratchet.py` | `MysqlAnalyticsAdapter` 348 → 227 (APERTAR); 0 violações nos arquivos do lote. 13 violações preexistentes em services de `fai-application` não tocados (worktree em `bcaee73`, anterior às reduções de outros lotes) |

Logs: `evidence/17-analytics-sql-baseline.log`, `evidence/17-analytics-sql-after.log`.
Sem banco, servidor, rede de produção, Flyway ou migrations.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `MysqlAnalyticsAdapter.java` | 348 | 227 (−121; −34,8 %) — sai do baseline congelado |
| `AnalyticsInsightsSql.java` (novo) | — | 104 |
| `AnalyticsDashboardSql.java` (novo) | — | 120 |
| Runtime combinado | 348 | 451 (+103: cabeçalhos/javadoc, declarações de constantes, imports) |
| Testes novos | — | `MysqlAnalyticsSqlCharacterizationTest` 114, `AnalyticsSqlCatalogTest` 58, golden 295 (dado) |

O ganho é separação SQL × binding e revisão isolada do texto SQL, não redução global de linhas.

## Contratos preservados

`AnalyticsQueryPort` (assinaturas e tipos de retorno), nome e bean `@Component` do adapter, cada string SQL enviada
ao banco (golden byte a byte, inclusive o `:profile)HAVING`/`:profile)GROUP BY` sem espaço que a concatenação original
produz), nomes e valores dos parâmetros, `Map.of()` para resultado vazio, `0` no expurgo sem linha, `SELECT 1` da
latência. Nenhuma entidade, coluna, nullable, FK, índice, cascade, fetch, `@Version`, migration ou configuração alterada.

## Riscos e pendências do domínio 17

- Observação (não corrigida, para não mudar SQL): `TOP_USERS` e `HYPE_LEVELS_V2` concatenam `USER_SCOPE` com o text
  block seguinte sem espaço (`…:profile)HAVING`, `…:profile)GROUP BY`). O MySQL aceita; fica registrado.
- `WardrobeItem` (330) continua congelado: reduzir exige decisão de mapeamento (`@Embeddable` para lineage/estúdio/
  contadores sociais) com teste de schema em banco isolado — lote próprio.
- `MysqlDemoDataAdminAdapter` (437): candidato a catálogo de SQL análogo, após caracterizar ordem de DELETE/INSERT.
- Auditoria completa de N+1/race nas 133 entidades e 149 repositórios não foi feita neste lote.
- COVERAGE.csv/COVERAGE_FINAL.csv não editados (consolidação do orquestrador): `MysqlAnalyticsAdapter.java` PARTIAL;
  `AnalyticsInsightsSql.java` e `AnalyticsDashboardSql.java` DONE.
