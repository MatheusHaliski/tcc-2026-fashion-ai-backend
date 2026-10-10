# Reproduzir as métricas da auditoria

Os dois arquivos `.txt` são o harness usado na auditoria (vitest). Eles não fazem parte do build: na fase F0 viram
`lib/avatar3d/qa/metrics.ts` e testes de verdade.

```bash
cp docs/avatar3d/auditoria-roupas-3d/reproduzir/audit-garments.test.ts.txt lib/avatar3d/human/zz-audit-garments.test.ts
AUDIT_OUT=/tmp/metricas.json npx vitest run lib/avatar3d/human/zz-audit-garments.test.ts
rm lib/avatar3d/human/zz-audit-garments.test.ts
```

O `audit-detail` (faixa da gola por anel e setor; interseção na pose por região) roda do mesmo jeito.
