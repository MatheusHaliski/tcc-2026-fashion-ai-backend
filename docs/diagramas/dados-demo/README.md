# Diagramas — dados demo e de teste e integridade por domínio (transversal)

> Estado em 2026-10-05: V34 (política de ON DELETE por domínio, 131 FKs) e V35 (`account_origin`, `fixture_key`,
> `catalog_origin`) aplicadas; `DemoFixtures`, `DemoEnvironmentGuard`, `DemoModels`, `DemoDataAdminPort`,
> `MysqlDemoDataAdminAdapter` e `purgeUser` das projeções no código. Ainda faltam (`<<planejado>>`) o
> `DemoDataService`, a rota `/api/admin/demo` e os CLIs em `scripts/demo/`. O processo da V34/V35 e a visão geral
> de segurança estão em [`../seguranca/`](../seguranca/) (que absorveu a antiga pasta `RF49/`).

Acompanham [`docs/banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md`](../../banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md).

| Tipo | Diagrama |
|---|---|
| Atividades | `DEMO-atividades-reset.puml` — reset com dry-run, `planHash`, trava de contas reais, desconto de contadores, cascatas |
| Sequência | `DEMO-sequencia-seed.puml` — seed idempotente por `fixture_key` (transação + projeções depois do commit) |
| Máquina de estados | `DEMO-maquinadeestados-fixture.puml` — ciclo de uma fixture e do plano de reset |
| Classes | `DEMO-classes.puml` — `AccountOrigin`, `CatalogOrigin`, trava, fixtures, `DemoDataAdminPort` e o que é planejado |
| Classes (tabelas) | `DB-classes-dominios.puml` — OWNERSHIP → CASCADE · GLOBAL → RESTRICT · SET NULL só onde o filho sobrevive |
