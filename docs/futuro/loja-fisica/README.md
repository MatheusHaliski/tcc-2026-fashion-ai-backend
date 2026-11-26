# Loja física (resgate de produtos físicos com FAI Points) — projeto futuro

**Retirada do app em 26/11/2026.** Pedido da dona do projeto: "Retire totalmente esta modalidade de loja e retorne a
anterior, já que esta modalidade ficará como uma opção de projeto futuro". A loja de FAI Points volta a vender só
itens do próprio app (ver `docs/loja/LOJA_FAI_POINTS.md`).

## O que existia

| Parte | Origem | O que fazia |
|---|---|---|
| Resgate com entrega | #308 (V72) | Marca/celebridade aprovada publicava uma oferta de produto do catálogo com preço em FAI Points e nível mínimo; a pessoa resgatava informando o endereço; a equipe FAI controlava estoque e envio (`/points/physical-store`, `/admin/physical-store`, aba "Loja física" da marca). |
| Variantes por SKU (RF-PESQ-01) | V86 | Estoque por cor e tamanho; o pedido escolhia a variante. |
| Troca, devolução e estorno (RF-PESQ-02) | V87 | Caso de devolução com comprovantes, inspeção, reposição de estoque e estorno de pontos. |
| Garment Delivery | V103 | Encomenda de peça do Atelier à Fábrica FashionAI (fictícia) — ver `../garment-delivery/`. |

## O que saiu

- Telas: `/points/physical-store`, `/admin/physical-store`, a gestão de ofertas e a caixa de devoluções da aba da marca,
  o atalho do painel do admin; componentes `components/points/physical-store.tsx`, `store-orders.tsx`,
  `store-returns*.tsx`, `store-variants.tsx` e `lib/store/api.ts`/`types.ts`.
- API: `GET /api/physical-store`, `/api/physical-store/mine`, `POST/PUT/DELETE /api/physical-store/listings…`,
  `POST /api/physical-store/listings/{id}/redeem`, `/api/me/physical-store/orders…`, `/api/physical-store/returns…`,
  `/api/physical-store/listings/{id}/variants|checkout` e `/api/admin/physical-store/…`.
- Código: `PhysicalStoreService`, `PhysicalStoreReturnService`, `PhysicalStoreVariantService`, o pacote
  `application/physicalstore`, as entidades `PhysicalStoreOrder` e `store/PhysicalStoreReturn*` e seus repositórios.
- Textos `physicalStore.*` e `storeReturn.*` (pt/en/es, front e back).

## O que fica (e por quê)

- `physical_store_listings` e `physical_store_variants` (entidades `PhysicalStoreListing`/`PhysicalStoreVariant`):
  a prova física agendada do provador (`FittingAppointmentService`), as grades de tamanho (`SizeOptionsService`) e o
  passaporte digital ainda leem o estoque por variante cadastrado. Sem a gestão de ofertas, novas variantes não são
  cadastradas pelo app; as existentes continuam valendo.
- `GET /api/physical-store/products` (mesma URL, agora `BrandCatalogProductsController`): a declaração de
  acessibilidade da marca escolhe o produto por aqui.
- `GET /api/physical-store/demand` e `/api/physical-store/fitting-appointments`: painel de demanda e provas agendadas,
  agora na aba "Provas e demanda" da marca. O motivo de caimento vindo das devoluções deixou de alimentar o painel.

## Banco

`physical_store_orders`, `physical_store_return_cases`, `physical_store_return_events` e
`physical_store_return_evidence` ficam **órfãs** e reservadas ao projeto futuro. Nenhuma migração é apagada e não há
`DROP TABLE` (ver `../README.md`).
