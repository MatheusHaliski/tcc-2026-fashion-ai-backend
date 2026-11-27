# Módulo 66 — Novos RF-PESQ (loja, lavanderia, Atelier, passaporte, provador): decisões GoF

## Problema concreto e decisões

- `PhysicalStoreService` (congelado em 370 linhas) precisava de variantes no checkout. Extração por responsabilidade:
  `PhysicalStoreViews` (projeções), `PhysicalStoreForms` (validação pura) e `PhysicalStoreVariantStock` (escolha e débito
  travado da variante). O serviço continua dono de `@Transactional` e autorização. Padrão: **NENHUM** (extração de
  colaboradores, sem variação de política).
- `PhysicalStoreReturnService` nasceu acima de 250 linhas e foi dividido por responsabilidade: `PhysicalStoreReturnSettlement`
  (estorno único, troca e reposição), `PhysicalStoreReturnAccess` (quem pode agir) e `PhysicalStoreReturnPolicy` (política
  congelada por pedido, `record` puro). Padrão: **NENHUM**; a política é um valor imutável, não uma Strategy.
- `LaundryService` delega o cálculo de conflitos com looks planejados a `LaundryConflicts` e as transições/agrupamentos a
  `LaundryRules` (puro). Padrão: **NENHUM**.
- `AccountService` (congelado) precisava de uma finalidade nova de consentimento: o bloco estático foi extraído para
  `ConsentPurposes` (catálogo imutável), reduzindo o arquivo em 24 linhas. Padrão: **NENHUM**.
- `GarmentPassportService` (congelado) cedeu `safeImage` para `common/SafeImage`, reutilizado por devoluções e reparos.
  Padrão: **NENHUM** (utilitário compartilhado).
- `DemandAggregation` é uma função pura de agregação com limiar e supressão complementar, testável sem Spring.
- O editor 3D da peça reutiliza `AtelierViewport`, `SceneInspector` e `lib/atelier3d/history` sem copiar código; a
  personalização é um documento serializado validado em `CustomizationDocument`. Padrão: **NENHUM**.
