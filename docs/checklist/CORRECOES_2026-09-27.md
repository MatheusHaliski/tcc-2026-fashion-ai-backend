# Checklist de correções — 27/09/2026

Planilha dos problemas apontados por aba do navegador lateral, com o estado de cada item e a evidência de que foi
arrumado (arquivo:linha no branch `claude/fashion-ai-interfaces-config-id7naj` e captura de tela).

Como ler: **✅ feito** = corrigido e verificado; **✅ feito (já no branch)** = corrigido em commit anterior deste mesmo
branch, conferido de novo hoje; **⚠️ parcial** = feito com limitação declarada. As capturas foram tiradas com a API
simulada (sem banco), só para conferir a tela; a lógica de servidor está coberta pelos testes automatizados.

Verificação geral desta entrega: `tsc` sem erros · 56 testes de frontend (vitest) · suíte completa do backend
(`mvn test`) verde, incluindo o teste novo `SchemeFormPayloadTest` · i18n: 0 erros de paridade, 0 textos embutidos ·
6 telas renderizadas sem erro de runtime (Playwright).

> Produção (fai-network.com) só recebe tudo isto depois do merge do branch em `main`.

## 1. Criar Look

| # | Problema | Estado | Evidência |
|---|----------|--------|-----------|
| a | Não dava para voltar/navegar livremente entre etapas | ✅ feito | `components/scheme-builder.tsx:122` (`canGo`: voltar sempre; avançar quando o pré-requisito está cumprido) e `:179` (Stepper clicável). Captura `img/correcoes-2026-09-27/criar-look.png` — etapa "Peças" sublinhada = navegável. |
| b | Preview com mais de uma peça por tipo; lista sem borda (RF7.CA12) | ✅ feito | Uma peça por tipo: `scheme-builder.tsx` (`toggle` troca a peça do mesmo tipo, aviso `schemeBuilder.troca_mesmo_tipo`). Borda em cada peça da prévia: `app/globals.css:298` (`.fai-card.is-preview .piece2`) e `components/scheme-card.tsx:156` (classe `is-preview`, lista completa). |
| c | Modo IA não gerava arte de fundo | ✅ feito | `scheme-builder.tsx:130–147` (`applyComposition`: direção recomendada `/api/backgrounds/recommendations` → arte por IA `/api/backgrounds/art` quando há gerador, senão o preset AURA + material + skin recomendados aplicados ao card). |
| d | Modo IA permitia várias peças do mesmo tipo | ✅ feito | Frontend `scheme-builder.tsx:68/131/194` (`onePerType`); backend `LocalSchemeComposer.onePerType` + prompt "no máximo 1 de cada tipo" (commit 3cecd73), teste `SchemeRulesTest.lookKeepsOnePiecePerType`. |
| e | "JSON inválido" ao salvar na última etapa | ✅ feito | `fai-web/.../JsonCompatConfig.java:33–39` (humor em português, modo "AI", `season`/`visibility` vazios → null). Teste `SchemeFormPayloadTest` lê o payload exato que a tela envia (2 casos verdes). |
| f | Selos com rótulos padronizados (Chique acessível, Visual premium…) | ✅ feito | Rótulos removidos do backend: `WardrobeService.taxonomy()` (sem `pieceSeals`/`schemeSeals`), `SchemeService` (sem `suggestedSeals`). Selos agora só pela IA de marca/celebridade: `POST /api/seal-suggestions/preview` (look) e `/preview-piece` (peça), com "Pesquisando selos possíveis…" enquanto carrega. |
| g | Modal "Parabéns! Seu look foi criado com sucesso!" + ir ao perfil | ✅ feito | `components/expanded-card.tsx:233` (fechar leva a `/u/{username}`) e `:240` (títulos para look, peça e DNA); o look/peça ampliado (`/schemes`, `/pieces`) aparece dentro da janela. |
| h | Tag disponível/indisponível dentro da foto; filtros do closet errados | ✅ feito | Tag removida de `components/piece-card.tsx`. Filtro: `app/(app)/closet/page.tsx:16` manda `disponivel`/`indisponivel`/`venda`; backend `WardrobeService.java:780–782` aceita singular e plural. Captura `closet.png`. |
| i | Dados redundantes fora da borda do esquema/peça ampliado | ✅ feito (já no branch) | `/schemes/[id]` e `/pieces/[id]` renderizam só o card ampliado; DNA: `app/(app)/dna-schemes/[id]/page.tsx:29` (ações do post dentro do card via `extra`). |
| j | Botão "Usei hoje" | ✅ feito | Não existe mais (busca no código: 0 ocorrências); só "Marcar como look do dia" (`expanded-card.tsx`, rodapé do look). |
| k | Botão "À venda" no card | ✅ feito | Não há botão; "À venda" é campo do formulário (`components/piece-form.tsx`, `PieceMoreDetails`, RF4.CA8). |
| l | Listas HTML default | ✅ feito | Estilo único `.fai-list` (`app/globals.css`, linhas com borda como os demais elementos); 29 arquivos convertidos de `ul/ol` cru para `fai-list`. |
| m | "nenhuma visualização" | ✅ feito (já no branch) | 0 ocorrências no código. |
| n | Botão "Abrir página" no look ampliado | ✅ feito (já no branch) | 0 ocorrências; a lista de peças abre a peça ampliada no mesmo modal (`detail-modal.tsx`). |
| o | 3D e reações no padrão (disco verde, ícone preto, ícones únicos), nunca no menu ⋯ | ✅ feito | `components/generate-3d.tsx` (`glyph`: classe `c-act`, ícone ACT-20); reações com ícones próprios SOC-07/08/09 (`components/interactions.tsx`); menu ⋯ só salvar/editar/excluir (`scheme-card.tsx` PostMenu, `expanded-card.tsx` ActionMenu). |
| p | Peça ampliada: tudo dentro, botões no fim, borda = modal | ✅ feito | `components/expanded-card.tsx` (`ExpandedPiece`: um único `article`; painéis do estúdio/3D antes e botões `c-owner` por último, `:188`); `detail-modal.tsx` (`dialog-card`). |
| o' | RF12.CA13 fotos de peça/look excluído somem de Minhas Fotos | ✅ feito (já no branch) | `WardrobeService.java:922` (`media.retire` ao excluir peça) e `SchemeService.java:863` (ao arquivar look), auditoria com `photosRemoved`. |
| q | Minhas Fotos: linha do tempo, filtros por segment picker (ocasião, estilo, cor, data, período), insights de IA, comparação | ✅ feito | Tela nova `app/(app)/photos/page.tsx`; backend `PhotoService.gallery/insights/timeline` + `PhotoInsights.java`; `GET /api/me/photos?origin&occasion&style&color&month&days`, `GET /api/me/photos/insights`. Capturas `photos-galeria.png`, `photos-timeline.png`, `photos-insights.png`, `photos-comparar.png`. |
| r | Nunca listas sobrepostas numa aba; listas via segment pickers | ✅ feito | Galeria única (sem seções por origem); origem/ocasião/estilo/cor/data/período em `SegmentPicker` no cabeçalho (`photos/page.tsx`); closet do perfil com pickers de estado e categoria (`lookbook-tabs.tsx`). |
| s | Remover "Criar Look" da sub-aba Meus Looks | ✅ feito | `components/lookbook-tabs.tsx` (`LooksTab` sem link/ação para `/schemes/new`). |
| t | Foto do look sem brilho/contraste/saturação/matiz/desfoque | ✅ feito | Presets e filtros removidos de `lib/card-art.ts` e do tipo `BgConfig.photo`; a etapa Detalhes só envia a foto para `POST /api/schemes/photos` (validação de formato e política, sem edição). |
| u | Contadores no formato de post (fora dos botões) | ✅ feito | `components/interactions.tsx` (`CardActions`: botões só com ícone, contadores em texto abaixo); `components/dna-card.tsx:133` (DNA passou a usar o mesmo componente). |
| v | Remover "baixar imagem" e "ver card ampliado" em /schemes e /pieces | ✅ feito (já no branch) | 0 ocorrências no card ampliado. |

## 2. Criar peça com formulário

| # | Problema | Estado | Evidência |
|---|----------|--------|-----------|
| a | Remover "peça única" (só 4 categorias) | ✅ feito | `components/piece-form.tsx:23` (`PIECE_CATEGORIES`) e `:93`; pickers do perfil/closet sem peça única (`lookbook-tabs.tsx`). Captura `pieces-new-dados.png`. |
| b | Remover "logo via Wikidata · zara.com · filtro…" e "Buscamos a marca na internet…" | ✅ feito | Dica do campo removida (`piece-form.tsx`); slot do logo mostra só o nome da marca (`components/brand-search-input.tsx`). |
| c | "Mais detalhes" com seta; selos pela IA (marca/celebridade com peça semelhante) | ✅ feito | Seta: `app/globals.css` (`.more-details > summary::before`, gira ao abrir). Selos: `piece-form.tsx:39` (`PieceSealSuggestions`) → `SealService.previewPiece` (compara marca, tipo, cor, ocasião e estilo). Captura `pieces-new-mais.png`. |
| d | Remover condição, data da compra, local, tags, notas | ✅ feito | Campos não existem mais em `PieceFields`/`PieceMoreDetails` (`piece-form.tsx`). |
| e | Peça à venda aparece na sub-aba "Peças à venda" (perfil e closet) | ✅ feito | Closet: estado `venda` (`closet/page.tsx:16`); perfil: picker "À venda" (`lookbook-tabs.tsx:23`) com `GET /api/users/{id}/closet?state=venda` (`WardrobeController`). Captura `perfil-a-venda.png`. |
| f | Não mostrar dados de processamento (etapas, ms, nitidez, motor…) | ✅ feito | `app/(app)/pieces/new/page.tsx` sem `StudioReport`, sem lista de métricas nem "fundo removido/confiança/motor". Captura `pieces-new-foto.png`. |
| g | Sem "Usar imagem padrão"; asset já preenchido antes do upload; sem "Solte fotos aqui"; pipeline exclui corpos humanos | ⚠️ parcial | Asset por categoria vem do backend (`WardrobeService.taxonomy()` → `defaultImages`) e ocupa o quadro (`pieces/new/page.tsx:92`); botão e mensagem removidos. Corpo humano: `lib/pieces/person-filter.ts` (segmentação local no navegador: cabelo/pele saem, roupa fica) antes de `POST /api/pieces/analysis`. **Limitação:** as métricas de fotografia profissional do estúdio (luz, enquadramento) não foram recalibradas nesta entrega. |
| f' | Criador em etapas por segment picker: upload → … → arte de fundo (aura, material, skin) → revisar e salvar | ✅ feito | `pieces/new/page.tsx` (Foto · Dados · Mais detalhes · Arte de fundo · Revisar e salvar). Arte de fundo salva em `background` (backend `PieceForm.background` → `backgroundConfigJson`) e desenhada no card (`piece-card.tsx`, `CardArtLayer`). Capturas `pieces-new-arte.png`, `pieces-new-revisar.png`. |

## 3. DNA de estilo

| # | Problema | Estado | Evidência |
|---|----------|--------|-----------|
| a | Aba DNA só como criador (sem quiz, sem Identidade de vida / Meu DNA); variações de card + arte AURA/material do documento | ✅ feito | `app/(app)/dna/page.tsx` renderiza só `DnaBuilder` (mesmo fluxo do RF5, itens = looks); layouts A1–A4 e narrativas B1–B12 de `docs/anatomias/anatomia_cards_DNA_v4_1.html` + Background Studio (aura, material, skin) na etapa Aparência (`components/dna-builder.tsx`). Captura `dna.png`. |
| b | Sub-aba "Meus looks DNA de estilo" no perfil | ✅ feito | `components/lookbook-tabs.tsx` (`DnaLooksTab`, `GET /api/me/dna-schemes`); ao salvar um DNA a janela de sucesso leva a `/u/{username}?tab=dna`. Captura `perfil-closet.png` (aba visível). |

## Pendências fora desta entrega

- Métricas de fotografia profissional no estúdio da peça (RF4) — refino do pipeline de servidor.
- Relatórios de pesquisa do pipeline de imagem de peças (qualidade e isolamento/enquadramento).
- Validação ponta a ponta com banco e fotos reais (as capturas usam API simulada).
