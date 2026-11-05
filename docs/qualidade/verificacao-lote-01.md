# Verificação do lote 01

## Resultados locais

- 44 testes frontend passaram (4 arquivos): diálogo genérico existente, tabela por produto, regras/persistência e fallback fotográfico.
- 51 testes Java passaram (6 classes): passaporte, cópia segura, catálogo de assets, motor/serviço de tamanho e limpeza de dados de conta.
- Caracterização Java na base `origin/main`: 20 testes de `GarmentPassportServiceTest` passaram em worktree isolado. Após a extração, os mesmos 20 passaram.
- Caracterização frontend anterior: os 4 testes existentes de `ProductFitDialog.test.tsx` passaram antes e após a mudança.
- TypeScript (`npm run typecheck`), stylelint, design check, i18n check/scan, `git diff --check` e line ratchet passaram. i18n apresentou 10 avisos, zero erros.
- Testes direcionados com mocks; `PassportPersistenceTest` teve apenas atualização de construtor e não foi executado. Não houve navegador integrado, build Next de produção, banco real ou teste de carga neste lote.

## Comandos reproduzíveis

```sh
npx vitest run components/fit/ProductFitDialog.test.tsx components/fit/ProductChartSizes.test.tsx lib/fit/product-chart.test.ts components/catalog/catalog-photo.test.tsx
mvn -pl fai-application -am -Dtest=GarmentPassportServiceTest,ReceivedPassportPieceTest,AssetCatalogServiceTest,FitServiceTest,FitEngineTest,FitAccountDataCleanupTest -Dsurefire.failIfNoSpecifiedTests=false test
npm run typecheck
npm run lint:styles
node scripts/ux/check-design.cjs
node scripts/i18n/check.js --fail
node scripts/i18n/scan.js --fail
python -m scripts.refactoring.line_ratchet
git diff --check
```

Java 21, Maven 3.9.11 e Mockito 5.23.0. Neste ambiente, Mockito usa `-DargLine=-javaagent:/workspace/.tooling/m2/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar`. O truststore da sessão foi usado para resolver dependências Maven; TLS não foi desabilitado.

## Linhas de produção antes/depois

| Arquivo | Base | Depois |
|---|---:|---:|
| `components/fit/ProductFitDialog.tsx` | 31 | 39 |
| `components/fit/ProductChartSizes.tsx` | 0 | 55 |
| `lib/fit/product-chart.ts` | 0 | 67 |
| `components/catalog/catalog-photo.tsx` | 102 | 102 |
| `components/catalog/default-garment-photo.tsx` | 11 | 13 |
| `fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java` | 411 | 402 |
| `fai-application/src/main/java/br/com/fashionai/application/passport/ReceivedPassportPiece.java` | 0 | 46 |
| **Total destes arquivos** | **555** | **724** |

A redução do serviço original não é uma redução total de código: a extração e as novas regras/UI aumentam o total, como mostra a tabela. O baseline congelado do serviço foi reduzido; não houve aumento artificial dos limites.

## Fronteiras verificadas

| Fronteira | Evidência | Limite |
|---|---|---|
| Diálogo → endpoint de tabela | Teste autenticado valida URL, resposta e exibição de medidas | API simulada no frontend |
| Backend de tamanho → regras | FitServiceTest e FitEngineTest | Não mede acerto com compradores |
| Transferência → nova peça | GarmentPassportServiceTest e ReceivedPassportPieceTest | Persistência real não executada |
| Imagens indisponíveis → fallback | catalog-photo.test.tsx | Não valida segmentação ou fidelidade 3D |
| UI → escolha local | Testa produto/revisão e troca de produto | Não altera o asset/rig |

## Pendências para concluir a meta

A [matriz por RF](evolucao-2026-11-05.md) mantém todas as notas históricas e os aceites pendentes. Este lote remove defeitos demonstráveis; não certifica 39 notas acima de 9. Recomendação de tamanho/feedback no diálogo, graduação física dos GLBs, integridade de SKU, TipoLook manual, escala da busca/feed e avaliações de usabilidade continuam exigindo lotes próprios.
