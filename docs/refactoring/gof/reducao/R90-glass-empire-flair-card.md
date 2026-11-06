# Lote R90-glass-empire-flair-card — carta FLAIR da peça com a anatomia do card comum

Pedido: a carta FLAIR das peças passa a ter o mesmo desenho do card comum (janela segmentada Info + Hype), com a
arte de fundo por nível (bronze, prata, ouro, especial) como única diferença. Detalhe em
`docs/flair/carta-flair-peca-2026-11-06.md`.

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `components/flair/flair-game-card.tsx` (`component`, 250; não congelado) | 72 | 69 | `components/flair/flair-piece-card-art.tsx` (64): arte de fundo, cabeçalho (nota LED + posição + nível escrito + ↻), verso simples · `components/flair/flair-piece-card-panels.tsx` (109): `flairHypeSummary` (snapshot → `HypeSummary`), linhas de Info, `FlairPieceCardPanels` (mesmo DOM de `PieceCardPanels`) | nenhum |
| `app/(site)/_styles/19-momentos-carta-flair.css` (`css`, 250) | 197 | 219 | — (regras `.fgc` substituídas por `.flair-piece-card`/`.fpc-*`) | — |

## Como foi dividido

- Não é redução de arquivo congelado: é uma reescrita por responsabilidade. `flair-game-card.tsx` ficou com o
  contrato público (tipos, constantes, `seasonName`, `FlairGameCard`) e a composição (`FashionCard` + frente + verso);
  a arte/cabeçalho/verso simples e a janela segmentada foram para dois arquivos coesos.
- Contrato mantido: mesma interface `{card, size?, flip?}`, mesmas exportações, mesmo `aria-label`, mesmas chaves
  `flairCard.*` (8 chaves novas `flairCard.row.*`/`backLabel`), consumidores sem alteração (`flair-collection.tsx`,
  `cbc.tsx`, `games/game-play.tsx`, `guide-demos.tsx`, `pieces/new/page.tsx`).
- Padrão: nenhum. A composição é a do card comum (camadas `.pc-art` + `.pc-frame > .pc-content`), já existente; a
  arte é um `<span>` decorativo e a janela repete o DOM de `PieceCardPanels` em vez de reusar o componente porque ele
  acrescenta a linha de estado de conservação (sem sentido numa carta) e `piece-card-panels.tsx` não era deste lote.
  Decorator/Strategy avaliados e descartados: não há comportamento a variar em tempo de execução, só o metal por classe CSS.

## Testes e equivalência

Caracterização antes (código original): `npx vitest run components/flair/flair-collection.test.tsx
components/flair/flair-hype.test.tsx components/flair/flair-metal.test.tsx components/flair/cbc.test.tsx components/guide`
→ 7 arquivos, 59 testes verdes. Depois: `npx vitest run components/flair components/guide` → 20 arquivos, 161 testes
verdes (inclui o novo `flair-game-card.test.tsx`, 9 testes); `npx tsc --noEmit` sem erros;
`node scripts/i18n/scan.js` sem texto embutido nos arquivos do lote; `python -m scripts.refactoring.line_ratchet` → 0 violações.
`flair-collection.test.tsx` e `flair-metal.test.tsx` trocaram os seletores do DOM antigo (`.fgc-*`) pelos novos,
mantendo as asserções (nota, posição, nível escrito, atributos reais, "—" sem Hype, sem score inventado).
