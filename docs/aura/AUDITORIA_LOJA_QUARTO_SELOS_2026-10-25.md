# Auditoria de IHC/UX — Loja FAI, Meu Quarto, selos de marcas/celebridades e selos Hype (2026-10-25)

Auditoria feita pelo código (base: commit `0b1ee4a`), seguida das correções deste branch. Cada pergunta recebe
**Aprovado**, **Parcial**, **Reprovado** ou **Sem evidência**. Os itens marcados como **Corrigido** foram reprovados
na leitura e corrigidos neste branch, com teste. "Sem evidência" significa que o comportamento não foi encontrado no
código nem testado; não significa que ele falha. Nenhum teste E2E com o app em execução foi rodado.

## 0. Resumo

O ciclo completo existe para **móveis do quarto** e para **selos**. Não há sistemas desconectados:
- **Móveis do quarto:** criação pela marca → loja → compra com ledger idempotente → inventário → aplicação no quarto
  3D → persistência.
- **Selos:** política → vínculo → revisão do emissor → emissão → card/vitrine → expiração/revogação.

Lacunas que continuam abertas (funcionalidades que não existem, não bugs):
1. **Item de marca é publicado sem revisão.** `WardrobeCreatorService.save` grava `active=true` por padrão e o item já
   aparece na loja. O que existe hoje é a aprovação do perfil emissor (`requireApprovedInstitutional` + `sellerActive`).
2. **Marcas não enviam modelo 3D.** O guarda-roupa da marca é uma combinação de moldes da fábrica com material, cor,
   logo e arte. A "instalação" troca o acabamento dos módulos do guarda-roupa modular. Não existe posicionamento
   livre, rotação nem colisão. O pipeline de modelos 3D (`RoomAssetService`, Meshy, com revisão e publicação) é
   exclusivo do admin.
3. **A loja só vende itens do quarto.** Não há produto digital vestível ou acessório criado por marcas, nem
   "coleção".
4. **Faltam três conceitos nos selos:**
   - classificação do selo (conquista, certificação, promoção, decorativo);
   - versão do selo;
   - opção de ocultar um card da vitrine sem revogar o selo.

### Correções aplicadas neste branch

| Problema encontrado | Correção | Teste |
|---|---|---|
| Validade do selo concedido = fim da campanha (`SealService.issue`): um resgate no último minuto nascia expirado | Nova coluna `seals.grant_validity_days` (migração `V81`). A validade conta da emissão (padrão 365 dias, configurável entre 1 e 3650) e não depende mais de `availableUntil`. O campo aparece no assistente de selo, que passou a chamar a outra data de "Fim do resgate" em vez de "Expira em" | `SealGrantValidityTest` |
| Selo de look vencido continuava no card (`approvedBadges` não filtrava `expiresAt`; o de peça já filtrava) | Filtro de vigência; o medalhão passa a expor `expiresAt` | `SealGrantValidityTest` |
| Resgate de promoção sem trava: requisições simultâneas passavam do limite por pessoa e da cota | `PromotionRepository.findForRedeem` com `PESSIMISTIC_WRITE` | suíte existente |
| Aplicar um item num módulo ocupado deixava o item anterior marcado como "aplicado" (dois itens "instalados" no mesmo lugar) | `FaiPointsService.releaseDisplaced`: a unidade deslocada volta para a caixa e continua no inventário | `RoomInventoryApplyTest` |
| Não havia como retirar um móvel do quarto sem trocar por outro | `DELETE /api/me/room-inventory/{id}/apply`: o módulo volta ao acabamento de fábrica e o item fica no inventário. Botão "Retirar do quarto" na loja do quarto | `RoomInventoryApplyTest`, `room-store.test.tsx` |

---

## Parte I — Produtos na Loja FAI

### 2. Criação e publicação

| # | Status | Evidência / correção necessária |
|---|---|---|
| 1 | Aprovado | `POST /api/room-creator/items` (`WardrobeCreatorService.save`), só para itens do quarto. |
| 2 | Aprovado | `guard.requireApprovedInstitutional` (marca/celebridade aprovada). Editar ou excluir item de outra marca → `deny`. |
| 3 | Parcial | `kind` COMPONENT (bloco) ou WARDROBE (guarda-roupa inteiro) e `slotType` (porta, gaveta, espelho, cama, tapete…). Não há vestíveis ou acessórios digitais. |
| 4 | Parcial | Nome, descrição, preço (0–20.000) e nível. A raridade é automática (MARCA/CELEBRIDADE). Não existe coleção. |
| 5 | Aprovado | `creatorUserId` + `finish.creator`. |
| 6 | Aprovado | `stockLimit`, `perUserLimit`, `availableFrom`/`availableUntil`. |
| 7 | Parcial | Upload de logo e arte da porta (`uploadArt`). Modelo 3D só pelo admin. |
| 8 | Parcial | `ImageOps.requireAcceptedImage` + redimensionamento. Material e bloco validados contra o catálogo. |
| 9 | Sem evidência | Itens do quarto não representam peças reais. |
| 10–11 | Reprovado | Não há rascunho nem revisão; `active` é `true` por padrão. Correção proposta: estado `PENDING_REVIEW` + fila do admin (como em `RoomAssetService.review/publish`). |
| 12 | Aprovado | Publicação sem operação manual no banco. |
| 13 | Reprovado | Sem coleção. O item fica associado ao criador (filtro "marca ou celebridade" na loja). |
| 14 | Parcial | `availability`: DISPONIVEL, EM_BREVE, EXPIRADO, ESGOTADO, INATIVO. Não há estados de revisão. |
| 15 | Aprovado | Excluir item com vendas apenas desativa (`delete`). O quarto guarda uma cópia do acabamento aplicado. |

### 3. Catálogo

| # | Status | Evidência |
|---|---|---|
| 1 | Aprovado | `FaiPointsService.shop`: itens ativos de vendedor ativo; um item expirado continua aparecendo para quem o possui. |
| 2 | Aprovado | Busca por nome/cor (`FilterBar`). |
| 3 | Parcial | Filtros por tipo, bloco, material, origem e marca/celebridade. Não há filtro por coleção. |
| 4 | Aprovado | Badges de raridade, selo, "exige selo" e link do criador. |
| 5 | Aprovado | `pricePoints` vem do backend. |
| 6 | Aprovado | Só FAI Points, com o aviso "FAI Points não são vendidos". |
| 7 | Parcial | Item com preço 0 mostra "0 pts" e o botão "Comprar". Não há rótulo "Resgatar". |
| 8 | Aprovado | `blocker` + validações em `buy`. |
| 9 | Parcial | `requiresSeal` bloqueia a compra, mas não esconde o item da vitrine. |
| 10 | Aprovado | Diálogo "Mais informações" e prévia 3D. |
| 11 | Parcial | `ModelViewer` com `finish.model3dUrl` (assets do admin); itens de marca mostram amostra de material. |
| 12 | Parcial | Recarrega após a compra; sem atualização em tempo real. |
| 13 | Aprovado | Item desativado ou expirado continua no inventário. |
| 14 | Aprovado | Botão de prévia 3D só aparece quando há modelo. |

### 4. Compra e inventário

| # | Status | Evidência |
|---|---|---|
| 1–2 | Aprovado | `blocker`/`levelOk` no card; diálogo de confirmação com preço. |
| 3–4 | Aprovado | Transação com trava das carteiras (ordem por UUID) e do item. |
| 5–7 | Aprovado | `RoomInventoryItem` salvo; toast com número de série; diálogo "Montar"; "Você tem N" no card. |
| 8 | Aprovado | Inventário do quarto separado do guarda-roupa de peças. |
| 9–10 | Aprovado | Ledger persistente; extrato em notificações FAI_POINTS e `recent` em `/api/me/points`. |
| 11 | Aprovado | `Idempotency-Key` → `repeatedPurchase`. |
| 12–13 | Aprovado | Débito, entrega e crédito ao vendedor na mesma transação. |
| 14 | Aprovado | `tryOn` não grava nada. |
| 15 | Aprovado | `NIVEL_INSUFICIENTE`. |

## Parte II — Meu Quarto 3D

### 5. Guarda-roupa exclusivo

| # | Status | Evidência |
|---|---|---|
| 1 | Aprovado | `kind=WARDROBE`. |
| 2 | Parcial | Largura (240 cm) e blocos na loja; sem dimensões detalhadas. |
| 3–4 | Parcial | "Provar no meu quarto" (`tryOn`) não altera saldo, mas devolve só o módulo e uma nota (toast). |
| 5–6 | Aprovado | Vai para o inventário; botão "Montar no quarto". |
| 7–8 | Parcial | Troca acabamento, material, logo e arte dos módulos reais do guarda-roupa 3D. Não carrega um modelo próprio da marca. |
| 9 | Aprovado | `compatibleModules` (por tipo de bloco, largura e nível). |
| 10–12 | Reprovado (por projeto) | Layout modular fixo: sem posicionamento livre, rotação nem checagem de colisão. |
| 13–14 | Aprovado | Módulos dependem do nível; `ENCAIXE_INCOMPATIVEL` com a lista do que cabe. |
| 15 | Aprovado | Substitui o acabamento do módulo. |
| 16 | **Corrigido** | A unidade substituída volta para a caixa (antes continuava marcada como aplicada). |
| 17 | Aprovado | Gravado em `room_layouts.modules_json`. |
| 18 | Aprovado | `finish.creator`, `rarity`. |
| 19 | Sem evidência | — |
| 20 | **Corrigido** | Uma unidade por módulo (`releaseDisplaced`). |

### 6. Funcionamento após instalar

Sem execução visual nesta auditoria. Pelo código: as peças ficam em módulos com endereço real (`RoomService`, rotas
`room-address`/`room-location`); o Smart Mirror é um módulo do quarto; a capacidade é de 4 por porta ou gaveta.
- 6.6: **Aprovado**.
- 6.14: **Corrigido** (retirar sem excluir).
- 6.1–6.5 e 6.7–6.13: **Sem evidência** sem o app em execução.

### MQ-001 — guarda-roupa de marca (previsão pelo código)

| Etapa | Status |
|---|---|
| Produto visível na Loja FAI | Aprovado (aparece na hora, sem revisão) |
| Compra confirmada | Aprovado |
| Item no inventário | Aprovado |
| Selecionável no Meu Quarto | Aprovado |
| Modelo 3D instalado e visível | Parcial (acabamento da marca no guarda-roupa modular, não um modelo próprio) |
| Persistência após novo login | Aprovado |

## Parte III — Selos comuns

### 7. Criação

| # | Status | Evidência |
|---|---|---|
| 1–2 | Aprovado | `createSeal` (`requireIssuer`) + `components/seal-wizard.tsx`. |
| 3 | Aprovado | Medalhão com upload restrito à mídia do próprio emissor (`ownMedia.require`). |
| 4 | Parcial | Nome + texto gerado da política (`SealPolicies.describe`); sem campo livre de "significado". |
| 5 | Reprovado | Não há tipo conquista/certificação/promoção/decorativo; só `tier` (PERFIL, PEÇA, LOOK) e Premium por tipo de perfil. |
| 6–7 | Aprovado | `tier` por selo; avaliação por tipo de entidade. |
| 8 | Aprovado | Políticas via Copilot, manual ou Hype (`SealPolicies`). |
| 9–10 | Aprovado | `usageLimit`, `availableFrom`/`availableUntil`. |
| 11 | Parcial | ID + emissor; sem versão. |
| 12 | Parcial | O emissor é aprovado; o selo em si não passa por revisão. Os vínculos podem exigir revisão do emissor. |
| 13 | Parcial | Prévia no assistente (passo "Arte"/"Revisão"). |
| 14 | Sem evidência | — |

### 8. Resgate

| # | Status | Evidência |
|---|---|---|
| 1 | Parcial | O resgate é um **vínculo**: sugestões no look/peça e ofertas no painel Hype; não há "área de resgate" separada. |
| 2–4 | Aprovado | Janela exibida; `available()` bloqueia fora do período ou com cota esgotada. |
| 5 | Aprovado | `requireReferenceMatch` / `requireHypeMatch` no servidor, também na aprovação. |
| 6, 15 | Aprovado | `requireUnique` e `activeBond`. |
| 7, 14 | Aprovado | `Instant.now()` no servidor. |
| 8–9 | Aprovado | Notificação `SEAL_GRANTED`; `GET /api/me/seals`. |
| 10–13 | Parcial | Peça e look são escolhidos no próprio card; PERFIL não concede selo ao usuário (ver 11). |
| 16 | Aprovado | `logBond` + `audit.log`. |

### 9. Expiração

| # | Status | Evidência |
|---|---|---|
| 1–3 | **Corrigido** | `grantExpiry`: validade própria contada da emissão; o fim da campanha só bloqueia novas concessões. |
| 4 | Parcial | Sem opção "permanente" (máximo de 3650 dias). |
| 5, 10 | **Corrigido** | `approvedBadges` filtra vencidos; peças já filtravam; a vitrine move os vencidos para o histórico. |
| 6, 8 | Aprovado | Vínculos nunca são apagados; "Looks consagrados" mostra os expirados. |
| 7 | Parcial | `grantValidityDays` está no `sealView`; a tela de pedido do usuário ainda não mostra esse valor. |
| 9 | Aprovado | Servidor. |

## Parte IV — Selos nos cards

### 10. Peças e looks

| # | Status | Evidência |
|---|---|---|
| 1–3 | Aprovado | Medalhões de `approvedBadges`/`pieceSeals`, posicionados por `SEAL_PLACEMENT`; sem regerar a arte. |
| 6–7, 15 | Aprovado | Posição por anatomia; tiers distintos; `maxVisible` 3 ou 4. |
| 8 | Parcial | Medalhão mostra emissor e nome; o significado fica na política. |
| 10, 12 | Aprovado | Visibilidade de quem vê (`canViewPiece`/`canViewScheme`). |
| 11 | **Corrigido** | Look agora some ao vencer (antes só a peça sumia). |
| 13 | Parcial | Os selos Hype automáticos derivam do Hype, não o contrário; não há teste explícito de que um selo não altera o score. |
| 4, 5, 9, 14 | Sem evidência | Requer inspeção visual. |

### 11. Selos no perfil do usuário

**Reprovado / Sem evidência.** Um selo `PERFIL` não premia o perfil do usuário: ele seleciona conteúdo elegível para
a vitrine do **emissor** (`profilePolicies`). Não existe selo exibido no perfil do usuário premiado.

## Parte V — Vitrine do emissor

### 12–13. Política e layout

| # | Status | Evidência |
|---|---|---|
| 12.1–12.2 | Parcial | A vitrine é automática para todo vínculo aprovado de look (`InstitutionalService.promoted`). Uma política PERFIL restringe o que entra, mas não há um interruptor por campanha. |
| 12.3–12.4, 12.7 | Aprovado | Só vínculos APPROVED e vigentes; nada é incluído sem concessão. |
| 12.5 | Reprovado | Sem período de destaque próprio (usa a validade do selo). |
| 12.8–12.9 | Aprovado | Autoria preservada; o selo leva à origem. |
| 12.10, 12.12 | Aprovado | `displayable` exige look publicado e `canView`; tornar privado revoga (`revokeForScheme`). |
| 12.11 | Parcial | Consentimento de imagem obrigatório para celebridade; para marca não é pedido. |
| 12.13, 13.12 | Reprovado | Não dá para ocultar da vitrine sem revogar o selo. |
| 12.14–12.15 | Aprovado | Expirados vão para "Looks consagrados". |
| 13.1–13.5 | Aprovado | Abas de destaques e consagrados, com o medalhão e o link do autor. |
| 13.6–13.7 | Parcial | Ordem fixa (Hype, depois data); limite `TAB_LIMIT`. |
| 13.8, 13.10, 13.11 | Aprovado | Some quando fica indisponível; uma entrada por look; sem métricas inventadas. |
| 13.9 | Aprovado | A vitrine pública é separada da fila de revisão (`/api/seal-bonds/review-queue`). |

**SELO-014:** viável pelo código. Ressalva: o passo 2 ("ativar a política de vitrine") não existe como opção, porque a
vitrine está sempre ligada.

## Parte VI — Selos Hype

| # | Status | Evidência |
|---|---|---|
| 14.1–14.3, 14.7–14.8 | Aprovado | `policy.mode=HYPE`, tier PEÇA ou LOOK, critérios em `SealPolicies`, janela e cota. |
| 14.4–14.5 | Parcial | Critérios definidos pela política do emissor; não verifiquei se ficam restritos às faixas oficiais. |
| 14.6 | Aprovado | Só o Hype global (`HypeScoreCurrent`). |
| 14.10–14.12 | Aprovado | `normalize` antes de salvar; `canAssess` protege peças privadas; editar a política não mexe em vínculos emitidos. |
| 15.1–15.2, 15.4–15.10, 15.12–15.13 | Aprovado | `SealHypeOffersService.offers`/`request`: elegibilidade e `canRequest` no próprio painel, revalidação no servidor, só o dono, sem Hype → "métricas indisponíveis". |
| 15.3, 15.14 | Parcial | Motivo genérico (`sealHype.not_eligible`), sem o requisito numérico. |
| 15.15 | Aprovado | Um vínculo ativo por emissor por card. |
| 16.1–16.2, 16.9–16.12 | Aprovado | Verificado no pedido e de novo na aprovação (`requireHypeMatch`), com trava do selo (`findForIssuance`), Hype fresco (`freshHype`), mesma fonte do Analytics. |
| 16.3 | Parcial | Precisa recarregar o painel. |
| 16.4, 16.6 | Aprovado | A concessão é histórica: não é revogada se o Hype cair. |
| 16.5 | Não se aplica | Não há selos de manutenção dinâmica. |
| 16.7 | Reprovado | A UI não informa que o selo é histórico. |
| 16.8 | Parcial | O score fica só no texto da justificativa do vínculo; não há colunas dedicadas. |

## Parte VII — Integridade e IHC

| # | Status | Evidência |
|---|---|---|
| 17.1, 17.3, 17.11 | Aprovado | Guards no backend; checagem de dono em cada recurso. |
| 17.2, 17.10 | Aprovado | Ledger, `SealBond` com emissor, beneficiário, entidade e código, e `audit.log`. |
| 17.4 | Reprovado | Item do quarto: criar = publicar. |
| 17.5–17.6 | Aprovado | Compra idempotente; resgate de promoção agora com trava (**Corrigido**). |
| 17.7 | Aprovado | Desativar em vez de apagar. |
| 17.8 | Sem evidência | Não verifiquei FKs de `room_inventory`. |
| 17.9 | Aprovado | Horário do servidor. |
| 17.12 | Parcial | `audit.log` registra o ator, sem papel explícito (criador × admin × premiado). |
| 18.1 | Parcial | "Comprar", "Montar no quarto", "Provar no meu quarto" e agora "Retirar do quarto" são distintos; não há "Resgatar" para itens grátis. |
| 18.3, 18.6–18.7, 18.11 | Aprovado | Toasts, `blocker` e `unavailableReason` com o motivo. |
| 18.8 | **Corrigido** | Rótulo "Expira em" → "Fim do resgate", mais o campo de validade do selo concedido. |
| 18.12 | Parcial | Pulso de Hype agora com seta ▲/▼ (auditoria AURA); medalhões sem texto alternativo verificado. |

## Matriz obrigatória (previsão pelo código)

| ID | Status |
|---|---|
| FAI-LOJA-001 | Aprovado (sem etapa de aprovação) |
| FAI-LOJA-002, 003 | Aprovado |
| FAI-ROOM-001, 003 | Aprovado |
| FAI-ROOM-002 | Parcial (acabamento no guarda-roupa modular) |
| FAI-SELO-001 | Aprovado |
| FAI-SELO-002 | Aprovado (via vínculo) |
| FAI-SELO-003, 004 | Aprovado |
| FAI-SELO-005 | Reprovado (não há selo no perfil do usuário) |
| FAI-SELO-006 | Aprovado |
| FAI-SELO-007 | **Corrigido** |
| FAI-BRAND-001 | Aprovado (vitrine automática) |
| FAI-BRAND-002 | Aprovado (privado → revogado) |
| FAI-HYPE-001 a 004 | Aprovado |
| FAI-SEC-001 | Aprovado (compra e vínculo); **Corrigido** (resgate de promoção concorrente) |

## Nota ponderada (estimativa, após as correções)

| Bloco | Peso | Nota | Pontos |
|---|---:|---:|---:|
| Criação, aprovação e catálogo | 15% | 0,55 | 8 |
| Compra, resgate e inventário | 15% | 0,95 | 14 |
| Instalação no Meu Quarto | 20% | 0,65 | 13 |
| Selos comuns e campanhas | 15% | 0,75 | 11 |
| Vitrine de cards premiados | 15% | 0,70 | 11 |
| Selos Hype | 15% | 0,90 | 13 |
| Clareza da interface | 5% | 0,60 | 3 |
| **Total** | | | **≈ 73/100** |

Dos cinco comportamentos eliminatórios:
- **Entrega real** e **Elegibilidade Hype** são atendidos.
- **Premiação verificável** é atendida para peças e looks, não para o perfil do usuário.
- **Publicação real** funciona, mas sem a etapa de aprovação do item.
- **Instalação 3D** funciona como troca de acabamento do guarda-roupa modular, não com o modelo 3D próprio da marca.
