# Plano de Reestruturação — RF5, RF6 e RF7

> Escopo restrito: **apenas** RF5 (Criar Look), RF6 (Gerenciar Guarda-Roupa
> Virtual) e RF7 (Acessar item de peça em um esquema salvo). Baseado no
> Memorial Descritivo *DOCUMENTACAO_FASHION_AI_V1_2_1*.
>
> Tema central das três histórias: **gerenciar o status de cada peça do
> guarda-roupa** de forma persistente e propagar esse status para a criação de
> looks (RF5) e para o consumo de peças em esquemas salvos (RF7).

---

## 1. Diagnóstico do estado atual

### 1.1 Status da peça é efêmero (bloqueador principal)
Em `app/views/MyWardrobeView.tsx` o status de cada peça é mantido **somente em
estado de React**, perdido a cada recarga:

| Status | Onde vive hoje | Persistido? |
|---|---|---|
| Disponível / Indisponível | `availability` (`useState<Record<id,...>>`) | ❌ Não |
| Favorito | `favorites` (`useState`) | ❌ Não (coluna `is_favorite` existe, mas não é lida/escrita) |
| Para vender / preço | `item.for_sale`, `item.listing_price` | ❌ Não há coluna em `db/schema.sql` |
| Esquecida | derivado de `usage` (`/api/scheme-items/usage`) | ➖ Derivado (ok) |
| Mais combinada | derivado de `usage` | ➖ Derivado (ok) |

Handlers `onAvailable`, `onUnavailable`, `onToggleFavorite` em
`WardrobeItemCard` apenas atualizam `setState` local — não há chamada de API.

### 1.2 Esquema de dados (`db/schema.sql`)
`wardrobe_items` tem `is_favorite BOOLEAN` e `model_status ENUM(...)`, mas **não
tem**: status de disponibilidade da peça, `for_sale`, `listing_price`. As tabelas
`schemes`, `scheme_items` e `user_saved_schemes` já existem e sustentam RF5/RF7.

### 1.3 Acoplamento RF6 ↔ RF7 ainda não existe
RF7 — Critério 2 ("Item indisponível") exige saber se a peça foi **removida ou
está indisponível no guarda-roupa do criador**. Como a disponibilidade não é
persistida, hoje é impossível atender esse critério de forma correta. **O status
da peça (RF6) é a fonte de verdade que RF7 precisa consumir.**

### 1.4 Componentes-chave existentes (reaproveitar, não recriar)
- RF5: `app/views/CreateMySchemeView.tsx` (view ativa via `ContentRouter`,
  `case 'create-my-scheme'`), `app/components/create-scheme/OutfitBackgroundStudioModal.tsx` (etapa de arte de background).
- RF6: `app/views/MyWardrobeView.tsx`, `WardrobeItemCard.tsx`,
  `WardrobeItemViewerModal.tsx` (modal único — CA4/CA7), `EditPieceModal.tsx`.
- RF7: `app/views/ProfileView.tsx` (aba "Looks Salvos"),
  `PieceCardModal.tsx`, tabelas `scheme_items` / `user_saved_schemes`.

---

## 2. Modelo de dados proposto (fundação para os 3 RFs)

Migração aditiva em `wardrobe_items` (nada destrutivo):

```sql
ALTER TABLE wardrobe_items
  ADD COLUMN availability_status ENUM('available','unavailable') NOT NULL DEFAULT 'available',
  ADD COLUMN for_sale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN listing_price DECIMAL(10,2) NULL,
  ADD COLUMN last_used_at DATETIME NULL,            -- cache de "esquecida/mais combinada"
  ADD INDEX idx_wardrobe_items_availability (user_id, availability_status);
```

`is_favorite` já existe — passa a ser efetivamente lido/escrito.

**Status canônico da peça** = combinação de:
`availability_status` + `is_favorite` + `for_sale` + (derivados `forgotten` /
`mostused` calculados de `usage`). Um único endpoint de mutação atualiza esses
campos.

---

## 3. RF5 — Criar Look (aba "Criar Look")

| Critério de Aceite | Mecanismo esperado | Ação no plano |
|---|---|---|
| **CA1** Escolher esquema de geração (manual × IA) | backend se ajusta à opção | Garantir que `CreateMySchemeView` envie `creation_mode` (`manual`/`ai`) à API de criação (`schemes.creation_mode` já existe no schema). |
| **CA2** Seleção insuficiente/inválida | impedir salvar + indicar ajustes | Validação no submit: nº mínimo de peças por slot e compatibilidade; **só permitir peças com `availability_status='available'`** (consome RF6). Mensagens de erro por campo. |
| **CA3** Configurar arte de background (etapa 5) | pré-visualização automática | Reaproveitar `OutfitBackgroundStudioModal`; gerar preview ao alterar cor/gradiente/imagem/display antes de salvar. |
| **CA4** Montar look via assistente de IA (etapa 3) | IA seleciona peças/cores/arte/marcas | Endpoint de IA recebe descrição e retorna seleção; **restringir candidatos às peças disponíveis** do guarda-roupa do usuário. |
| **CA5** Criação bem-sucedida com arte preenchida | salvar esquema + lista de peças | Persistir em `schemes` + `scheme_items` (slots/sort_order) + config de background do esquema. |

Pontos de atenção RF5:
- A seleção de peças deve **ler o status persistido** (Seção 2). Peça marcada
  como "indisponível" não aparece como selecionável.
- Etapas 1→5 (modo de geração → peças → AI Assist → arte de background → salvar)
  já existem na view; o trabalho é de validação (CA2) e integração de status.

---

## 4. RF6 — Gerenciar Guarda-Roupa Virtual (centro da reestruturação)

| Critério de Aceite | Mecanismo esperado | Ação no plano |
|---|---|---|
| **CA1** Visualização | exibe imagem, nome, tipo, cor e categoria | `WardrobeItemCard` já exibe; garantir campos `color`/`piece_type` sempre presentes na resposta de `/api/wardrobe-items/user/[userId]`. |
| **CA2** Organização | filtros/categorias/ordenações reorganizam | Mover o agrupamento (Disponíveis/Indisponíveis/Favoritos/Para vender/Esquecidas/Mais combinadas) para **consultar o status persistido**. Filtro server-side por `availability_status`/`is_favorite`/`for_sale`. |
| **CA3** Gerenciamento (editar/remover) | aplica e atualiza exibição | `EditPieceModal` → `PUT /api/wardrobe-items/[id]`; remoção → `DELETE`; refletir na lista sem recarregar. |
| **CA4** Modal único e padronizado | esquema de peça como **modal único**, não foto dentro do modal | `WardrobeItemViewerModal` é o modal único — manter padronizado; não renderizar o esquema como fotografia embutida. |
| **CA5** Edição | salvar alteração válida e atualizar exibição | Igual CA3, com validação de campos. |
| **CA6** Arte de background por esquema | exibir arte atualizada | Consumir a config de background corrigida (tokens `--element-surface` para estrutura; `--piece-scheme-*` estável para o card — ver Seção 6). |
| **CA7** Fotografia do esquema | clicar para exibir foto em modal apropriado | Separar claramente: **modal único** (esquema) × **modal de fotografia** (CA7), sem misturar (alinha com CA4). |

### 4.1 Núcleo: gerenciamento de status (a entrega central)
1. **Endpoint de mutação de status** — `PATCH /api/wardrobe-items/[id]/status`
   com corpo `{ availability_status?, is_favorite?, for_sale?, listing_price? }`.
   Valida posse (peça pertence ao usuário autenticado) e persiste.
2. **`WardrobeItemCard`** — `onAvailable/onUnavailable/onToggleFavorite` deixam de
   ser apenas `setState`; passam a chamar o endpoint com **atualização otimista**
   e rollback em erro.
3. **`MyWardrobeView`** — remover os mapas `availability`/`favorites` efêmeros;
   ler o status diretamente dos itens carregados; reagrupar a partir dele.
4. **Esquecida / Mais combinada** — manter derivado de `/api/scheme-items/usage`,
   opcionalmente persistindo `last_used_at` para ordenação eficiente.

---

## 5. RF7 — Acessar item de peça em um esquema salvo (aba "Looks Salvos")

| Critério de Aceite | Mecanismo esperado | Ação no plano |
|---|---|---|
| **CA1** Acesso bem-sucedido ao item | abre detalhes completos da peça | A partir da lista de peças do esquema (`scheme_items`), abrir `PieceCardModal` com dados completos. |
| **CA2** Item indisponível | informar que o item não está mais disponível | **Consome RF6**: se a peça foi removida (sem registro) **ou** `availability_status='unavailable'` no guarda-roupa do criador, exibir estado "indisponível para visualização". |
| **CA3** Retorno ao esquema de origem | reexibir o esquema com lista completa | Navegação de volta preservando o `scheme_id` de origem. |
| **CA4** Arte de background por esquema | exibir arte atualizada | Mesma config de background de RF6 CA6. |
| **CA5** Fotografia do esquema | clicar para exibir foto em modal apropriado | Reusar o modal de fotografia (igual RF6 CA7). |
| **CA6** Remixar | redireciona para "Criar Look" com itens usados | Botão remix → abre RF5 (`create-my-scheme`) pré-carregando os `scheme_items` (apenas os ainda **disponíveis**). |
| **CA7** Modal único e padronizado | esquema de peça como modal único | Mesmo padrão de RF6 CA4 (`PieceCardModal` único). |

**Dependência crítica:** RF7 CA2 e CA6 só funcionam corretamente depois que o
status da peça for persistido (Seção 2/4). Implementar RF6 antes de RF7.

---

## 6. Camada de aparência (já corrigida) — base para CA de background

A correção de *Cor dos Elementos* introduziu tokens que estes RFs devem respeitar:
- `--piece-scheme-surface` / `--piece-scheme-gradient`: superfície **estável** dos
  cards de esquema de peça (RF6 CA1/CA4, RF7 CA1/CA7) — não muda com a config.
- `--element-surface` / `--element-surface-border`: superfície **estrutural**
  (menu contextual "Guarda-Roupa", container "Peças Disponíveis") — recolorida
  por *Cor dos Elementos*.

A "arte de background do esquema" (RF5 CA3, RF6 CA6, RF7 CA4) é um conceito
distinto, por esquema, configurado em `OutfitBackgroundStudioModal` — não
confundir com a cor estrutural global.

---

## 7. Sequência de implementação

1. **Fase 0 — Dados:** migração da Seção 2 (`db/schema.sql` + arquivo de
   migração) e ajuste da query de `/api/wardrobe-items/user/[userId]` para
   retornar os novos campos.
2. **Fase 1 — RF6 status:** endpoint `PATCH .../status`, fiação de
   `WardrobeItemCard` (otimista) e remoção do estado efêmero em `MyWardrobeView`.
3. **Fase 2 — RF6 restante:** filtros/ordenação server-side (CA2), editar/remover
   (CA3/CA5), separação modal-único × modal-foto (CA4/CA7).
4. **Fase 3 — RF5:** validação de seleção (CA2) lendo status persistido; integrar
   AI Assist e arte de background (CA3/CA4); salvar (CA5).
5. **Fase 4 — RF7:** consumir status para "indisponível" (CA2), retorno (CA3),
   remix (CA6) e modal único (CA7).

Ordem obrigatória: **Fase 0 → 1** habilitam tudo; RF6 precede RF7.

---

## 8. Critérios de verificação (testes de aceite)

- Marcar peça como indisponível, **recarregar** → permanece indisponível (persistência).
- Peça indisponível **não aparece** como selecionável em "Criar Look" (RF5 CA2).
- Abrir esquema salvo cujo item ficou indisponível → mensagem "item indisponível" (RF7 CA2).
- Esquema de peça abre como **modal único**, sem foto embutida (RF6 CA4 / RF7 CA7).
- *Cor dos Elementos* recolore apenas estrutura, nunca os cards de esquema
  (regressão da correção da Seção 6).
