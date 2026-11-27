# Loja FAI Points

Data: 26/11/2026. Pedido da dona do projeto: "Retire totalmente esta modalidade de loja e retorne a anterior, já que
esta modalidade ficará como uma opção de projeto futuro". A loja física e o Garment Delivery saíram
(`docs/futuro/`); `/points/loja` volta a ser uma loja **de itens do próprio app**, como era a loja do quarto antes da
loja física, agora com os itens que existem hoje.

## Regras

- Itens comprados **somente com FAI Points** e usados **somente dentro do app**. Sem endereço, sem pagamento em
  dinheiro, sem entrega.
- Cada item é comprado uma vez por pessoa. Repetir a compra é recusado (`409 ITEM_JA_POSSUIDO`) sem cobrar.
- Saldo menor que o preço é recusado (`409 SALDO_INSUFICIENTE`) sem cobrar; a tela já bloqueia o botão e mostra
  quanto falta.
- A compra é atômica: trava a linha da dona do saldo (`SELECT … FOR UPDATE`, a mesma trava das outras lojas), confere
  posse e saldo e grava o débito na mesma transação. O débito não conta para o acumulado de nível.

## Itens e de onde vêm

| Tipo (filtro) | Origem | O que a compra dá |
|---|---|---|
| Presets de Aura (`AURA_PRESET`) | `aura_art_offers` ativos (cadastrados em `/admin/aura-store`) | Débito + licença em `aura_issuer_licenses`; presets da família Metamorfose entram no inventário de artes (Background Studio). Licença comprada antes pela loja de artes já conta como posse. |
| Guarda-roupas do Acervo (`WARDROBE`) | Curado em `fai-application/src/main/resources/store/fai-store-catalog.json` (material, tom, porta e puxador do Acervo) | Posse registrada |
| Itens do Acervo (`ACERVO_ITEM`) | Curado | Posse registrada |
| Cards de peça (`PIECE_CARD`) e de look (`LOOK_CARD`) | Curado (molduras) | Posse registrada |
| Auras de marcas e celebs (`BRAND_AURA`) | Curado, com criadores **de demonstração** marcados como tal na tela | Posse registrada |
| Peças digitais de marcas (`BRAND_PIECE`) | Catálogo oficial das marcas no app (primeiros 24 produtos visíveis com foto); preço por categoria | Posse registrada |

Nomes e descrições dos itens curados ficam em `messages*.properties` (`faiStore.item.<id>.name|desc`, pt/en/es).

## Sem schema novo

A posse é o próprio lançamento do ledger: `fai_points_ledger` com `ref_type = 'FAI_STORE'`, `ref_id = <id do item>`,
`action_code = 'FAI_STORE_PURCHASE'` e `idempotency_key = '<usuário>:FAI_STORE:<item>'` (única), que também barra a
corrida de duas compras simultâneas. Nenhuma migração foi criada.

## API

| Método | Caminho | Resposta |
|---|---|---|
| GET | `/api/fai-store` | `{ balance, types, items: [{ id, type, name, description, pricePoints, visual, creator, product, owned, affordable }] }` |
| GET | `/api/fai-store/mine` | Itens da pessoa |
| POST | `/api/fai-store/items/{id}/purchase` | `{ itemId, owned: true, balance }` |

## Tela

`/points/loja` (`components/fai-store/`): grade de cards (foto ou amostra desenhada com as cores do item, tipo, nome,
descrição, preço em FAI Points), filtros por tipo, e o card de loja expandido (diálogo) com detalhes, saldo depois da
compra e o botão de comprar. Estilos em `app/(site)/_styles/57-loja-fai-points.css`.

## Limites conhecidos

- Guarda-roupas, itens do Acervo, molduras de card e peças digitais ficam registrados como posse ("Meus itens" pela
  API), mas ainda não são aplicados automaticamente no Acervo nem nos cards: a ligação com essas telas é o próximo passo.
- Os itens curados não têm tela de administração; mudam por este JSON (com revisão de código).
