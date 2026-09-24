# Evidência de índices — Dashboard gerencial, Minhas Fotos e Explorador

Rubrica obrigatória nº 7 (dashboard com filtros e gráficos) e critério A de SQL avançado (consultas agrupadas, índices e procedures).
Os planos abaixo são saídas reais de `EXPLAIN` / `EXPLAIN ANALYZE` no MySQL 8.0 local, com a base de demonstração
(27 usuários, 546 linhas em `ai_inference_log`, 140 fotos). Para reproduzir: suba o backend (Flyway aplica V1–V10) e rode
os comandos em `mysql fashionai_app`.

## Onde cada objeto de banco é usado

| Objeto | Migração | Quem chama | Tela |
|---|---|---|---|
| `sp_admin_kpis(from, to, country, profile)` | V6 | `MysqlAnalyticsAdapter.kpis` | Dashboard → Indicadores do período |
| `sp_timeseries(metric, from, to, country, profile)` | V6 | `MysqlAnalyticsAdapter.series` (6 métricas) | Dashboard → séries de linha/barra |
| `sp_ai_cost_by_country(from, to, profile)` | V10 | `MysqlAnalyticsAdapter.aiCostByCountry` | Dashboard → "Em qual país a IA custa mais por usuário?" |
| `sp_purge_notifications(days)` | V6 | job de expurgo (RF3.CA18) | — |
| `vw_country_insights` | V6 | `countries()` | Dashboard → mapa por país · Explorador |
| `vw_brand_usage` | V6 | `brandUsage()` | Dashboard → marcas · Insights globais |
| `idx_ai_log_created_user_cost (created_at, user_id, estimated_cost_usd, fallback_used)` | V10 | custo de IA por país | Dashboard |
| `idx_users_type_created (profile_type, created_at)` | V6 | `sp_timeseries('users')`, `sp_admin_kpis` | Dashboard com filtro de perfil |
| `idx_photos_user_origin_created (user_id, origin, created_at)` | V1 | `PhotoRepository.findByUserIdAndOriginAndDeletedAtIsNull` | Minhas Fotos (RF12.CA01/CA06) |
| `idx_wardrobe_items_visibility` | V2 | `countPublicByBrandName` | Busca → aba Marcas (RF8) |

## 1. Custo de IA por país (procedure `sp_ai_cost_by_country`, V10)

```sql
EXPLAIN SELECT u.country, COUNT(DISTINCT a.user_id), COUNT(*), SUM(a.estimated_cost_usd)
FROM ai_inference_log a JOIN users u ON u.id = a.user_id
WHERE a.created_at BETWEEN '2026-09-21' AND '2026-09-24 23:59:59' AND u.country IS NOT NULL
GROUP BY u.country;
```

| table | type | key | rows | Extra |
|---|---|---|---|---|
| a | **range** | **idx_ai_log_created_user_cost** | 307 | Using where; **Using index** |
| u | eq_ref | PRIMARY | 1 | Using where |

O índice de cobertura resolve o recorte por período e já entrega `user_id`, custo e fallback sem ler a linha da tabela.
`EXPLAIN ANALYZE` do período de 30 dias:

```
-> Group aggregate: count(distinct user_id), count(0), sum(estimated_cost_usd)  (actual time=1.6..1.88 rows=9)
    -> Sort: u.country  (actual time=1.57..1.6 rows=546)
        -> Nested loop inner join  (actual time=0.0949..1.28 rows=546)
            -> Covering index scan on a using idx_ai_log_created_user_cost  (actual time=0.0308..0.204 rows=546)
            -> Single-row index lookup on u using PRIMARY (id=a.user_id)  (actual time=0.00102..0.00105 rows=1 loops=546)
```

## 2. Série de novos usuários com filtro de perfil (`sp_timeseries('users', …)`)

```sql
EXPLAIN SELECT DATE(u.created_at), COUNT(*) FROM users u
WHERE u.created_at BETWEEN '2026-08-25' AND '2026-09-24 23:59:59' AND u.profile_type = 'PESSOAL'
GROUP BY DATE(u.created_at);
```

| table | type | key | rows | Extra |
|---|---|---|---|---|
| u | **range** | **idx_users_type_created** | 20 | Using where; Using index; Using temporary |

## 3. Minhas Fotos por origem (RF12.CA01/CA06)

```sql
EXPLAIN SELECT * FROM photos
WHERE user_id = '8c6ad50f-…' AND origin = 'TRY_ON' AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 60;
```

| cenário | type | key | rows | Extra |
|---|---|---|---|---|
| com índice | **ref** | **idx_photos_user_origin_created** | 14 | Using where; **Backward index scan** (sem filesort) |
| `IGNORE INDEX` (sem índice) | ALL | — | 140 | Using where; **Using filesort** |

Com o índice, a página já sai na ordem de data lida de trás para frente. Sem o índice, o MySQL lê a tabela inteira e
ordena em memória. A página (60 fotos) respondeu em 14 ms no servidor e 37 ms no cliente (RNF7: até 3 s).

## 4. Peças públicas de uma marca do catálogo (RF8, aba Marcas)

| table | type | key | rows | Extra |
|---|---|---|---|---|
| w | ref | idx_wardrobe_items_visibility | 57 | Using where |

## 5. Observação sobre volume

Em `ai_inference_log` (uso por capacidade) e `fai_points_ledger` (pontos por ação), o otimizador escolheu `ALL` mesmo
com `idx_ai_log_created_cap` e `idx_points_created` disponíveis (`possible_keys`). O motivo é o volume da base de
demonstração: 531 e 98 linhas, e o período cobre mais da metade delas. Nesse tamanho, varrer a tabela custa menos
que percorrer o índice. Com volume de produção e um período curto, o plano passa a `range` nesses índices, como
aconteceu na consulta 1 ao estreitar o período.

## 6. Perfis de acesso validados (rubrica nº 6)

| Chamada | ADMIN | MARCA (atelier_lume3) | PESSOAL (ny_ava) | anônimo |
|---|---|---|---|---|
| `GET /api/admin/dashboard` | 200 | 403 `ACESSO_NEGADO` (JSON) | 403 `ACESSO_NEGADO` (JSON) | 401 `NAO_AUTENTICADO` |
| `GET /api/me/issuer-dashboard` | 200 | 200 | 403 "Painel exclusivo de marcas e celebridades." | 401 |

No frontend, o item "Dashboard" (admin) só aparece para o papel ADMIN, e "Painel do emissor" só aparece para marca
ou celebridade. As rotas `/admin/*` mostram uma tela 403 para os outros perfis, mesmo quando o endereço é digitado direto.
