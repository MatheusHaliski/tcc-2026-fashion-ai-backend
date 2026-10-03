# Diagramas — Demo/Test Data Pipeline e integridade por domínio (PROPOSTA)

Acompanham [`docs/banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md`](../../banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md);
nada disso está aplicado ao schema até a aprovação do diff.

| Tipo | Diagrama |
|---|---|
| Atividades | `DEMO-atividades-reset.puml` — reset com dry-run, `planHash`, trava de contas reais, cascatas |
| Sequência | `DEMO-sequencia-seed.puml` — seed idempotente pela API (transação + projeções depois do commit) |
| Máquina de estados | `DEMO-maquinadeestados-fixture.puml` — ciclo de uma fixture e do plano de reset |
| Classes | `DEMO-classes.puml` — `AccountOrigin`, `DemoDataService`, `ResetPlan`, migration V29 |
| Classes (dados) | `DB-classes-dominios.puml` — OWNERSHIP → CASCADE · GLOBAL → RESTRICT · SET NULL só onde o filho sobrevive |
