# Projetos futuros

Modalidades que saíram do app e ficam guardadas como proposta para uma edição futura. O código foi retirado; a
documentação, as capturas e as tabelas do banco ficam.

## Tabelas órfãs reservadas

As migrações abaixo já rodaram em produção. Elas **não** são apagadas (o Flyway validaria o checksum) e **não** há
`DROP TABLE`: as tabelas ficam no banco, sem entidade nem serviço que as leia ou grave, reservadas ao projeto futuro.

| Projeto | Migração | Tabelas / colunas | Observação |
|---|---|---|---|
| Garment Delivery (encomenda à Fábrica FashionAI) — `garment-delivery/` | `V103__garment_delivery.sql` | `garment_orders`, `garment_order_events`, coluna `garment_passports.manufacturing_json` | As FKs de `garment_orders` têm `ON DELETE CASCADE`, então excluir a conta continua limpando as encomendas antigas. `manufacturing_json` segue mapeada em `GarmentPassport` só para a limpeza da conta zerá-la. O tipo de notificação `GARMENT_DELIVERY` fica no enum para ler notificações antigas; eventos de passaporte `FACTORY_*` continuam aparecendo como "registrado pelo sistema". Os tipos de lavagem semeados (`MAQUINA_40` etc.) continuam valendo para todas as peças. |
| Loja física (resgate de produtos físicos com FAI Points) — `loja-fisica/` | `V72__physical_store_points_redemptions.sql`, `V86__rf_pesq_01_loja_variantes_por_sku.sql`, `V87__rf_pesq_02_troca_devolucao_estorno.sql` | `physical_store_orders`, `physical_store_return_cases`, `physical_store_return_events`, `physical_store_return_evidence` | Ver `loja-fisica/README.md`. `physical_store_listings` e `physical_store_variants` **não** ficam órfãs: a prova física agendada (provador), as grades de tamanho e o passaporte digital ainda as leem. |

Se um projeto futuro voltar, ele recomeça destas tabelas (ou as remove com uma migração nova e revisada).
