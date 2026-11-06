# Lote R86 — modelo 3D de vitrine do produto (etapa 3)

Extrações feitas antes de acrescentar o `model3dUrl` do produto, para os arquivos congelados não crescerem.
Caracterização antes da extração: `CatalogServiceModel3dTest.cardKeepsItsKeysAndOrder` (chaves e ordem do card),
rodado contra o código antigo e verde; depois, os mesmos testes e o `CatalogServiceTest` (15) seguem verdes.

| Arquivo | Antes | Depois | Extraído para | Padrão GoF |
|---|---:|---:|---|---|
| `fai-application/.../catalog/CatalogService.java` | 811 | 774 | `CatalogCards.java` (card, variantMap, applyVariant) | NENHUM |
| `fai-application/.../service/WardrobeService.java` | 1001 | 995 | `CatalogPick.java` (record, com o campo novo `model3dUrl`) | NENHUM |
| `components/catalog/catalog-search.tsx` | 567 | 489 | `catalog-result-card.tsx` (card do resultado + `reasonLabel`) | NENHUM |

Motivo do NENHUM: são funções puras e um record movidos de arquivo, sem nova hierarquia nem indireção.
`CatalogProductModels.decorate` acrescenta um campo a uma lista de mapas numa consulta só; não é o Decorator do GoF
(não embrulha um objeto com a mesma interface).

Contrato mantido: o JSON do card tem as mesmas chaves na mesma ordem e ganha `model3dUrl` só quando o bean
`CatalogProductModels` existe (no app, sempre); `CatalogResultCard` continua exportado por `catalog-search.tsx`;
os construtores antigos de `CatalogPick` continuam (3 e 5 argumentos).
