# Carta FLAIR da peça com o desenho do card comum — 06/11/2026

Pedido: "refatore os cards de peça de roupa com design FLAIR para que tenham o mesmo estilo de design dos cards
comuns (janela segmentada info + hype), sendo a única diferença de destaque justamente a arte de background que remete
a uma versão de carta FLAIR (bronze, prata, ouro, especial)".

## O que mudou

`components/flair/flair-game-card.tsx` (`FlairGameCard`) deixou de ser uma carta 5:7 com desenho próprio (`.fgc`) e
passou a ser o **mesmo card da peça** (`components/piece-card.tsx`), com a mesma anatomia em camadas
(`.fai-card.piece-card.pc`): cabeçalho, foto (`.pc-media`), identificação (`.pc-id`) e a janela segmentada
**Info | Hype** (`.pc-panels/.pc-seg/.pc-seg-btn/.pc-panel/.pc-info` + `FashionCardStats`). A única diferença é a
**arte de fundo por nível** (`.fpc-art`, na camada `.pc-art` do card em camadas) e a tinta sobre ela.

| | Antes (`.fgc`) | Depois (`.flair-piece-card`) |
|---|---|---|
| Forma | carta 5:7 fixa, 184/220/300 px | o card comum, largura 184/220/300 px (`--fpc-w`), altura livre (sem 5:7) |
| Cabeçalho | nota + posição soltos sobre a foto, inicial da marca | `.c-header.pc-header` como no card comum: **nota (OVR em LED) + posição** no lugar do avatar, **nível escrito** no lugar de quem publicou (e "Entregue em desafio" quando bloqueada), ↻ à direita |
| Foto | área que sobra, `object-fit: contain` | `.pc-media` 4:5 do card comum, `img.is-contain` com `loading="lazy"`, halo do metal atrás |
| Identificação | nome em caixa alta + marca | `.pc-name` + `.pc-sub` ("marca ou Sem marca · Temporada X") |
| Dados | lista de atributos de jogo na frente; Hype só no verso (`dl.fgc-hype`) | **janela Info \| Hype** idêntica à do card comum: Hype (inicial) = matriz `FashionCardStats` a partir do snapshot da carta; Info = Marca, Categoria, Nível, Nota, Posição, Atributos de jogo (EDGE RANGE CLOUT GLOW ART SYNC), Habilidade, Temporada, Preço |
| Verso | verso próprio (`.fgc-back`) com botão `.fgc-flip` | `FashionCard/FashionCardFront/FashionCardBack` + `CardFlipButton` como o card comum; carta de peça mostra **o mesmo verso do card comum** (`HypeCardBack type="PIECE"`); carta de look/programa, um verso simples com as barras dos atributos |
| Metal | `--fgc-metal/--fgc-plate/--fgc-ink` por `.fgc.tier-*` (19 e 22) | `--fpc-metal/--fpc-plate/--fpc-ink/--fpc-led/--fpc-glow` por `.flair-piece-card.tier-*`; o card redefine `--ink/--muted/--surface/--surface-2/--line-soft/--card-*` dentro dele, e por isso a janela segmentada, o selo de Hype e o ↻ seguem o metal sem CSS próprio |
| Raro | brilho animado no `.fgc-face::after` | brilho no `.fpc-art::after`, só com movimento permitido (`prefers-reduced-motion` e `data-reduce-motion`) |
| Dados ausentes | "—" | "—" (nunca 0): snapshot vazio vira `HypeSummary {status:'INSUFFICIENT_DATA'}` e o selo da aba Info mostra "🔥 —" |
| Acessibilidade | `aria-label` "Carta FLAIR Ouro rara, nota 82, …" | o mesmo `aria-label`; tablist com setas; nível sempre em texto; contraste ≥ 4,5:1 da tinta sobre a placa de cada nível; tema de contraste força branco sobre preto |

## Por quê

- Um único contrato visual: quem aprende a ler o card da peça (Info | Hype, ↻ para o verso) lê a carta FLAIR do
  mesmo jeito. A carta continua reconhecível pelo metal do nível, que é o que o pedido quer destacar.
- O Hype da carta já é um snapshot (POP, ENG, TRD, ORI, RAR, LON, NOV, HYP); convertê-lo em `HypeSummary` deixa a
  matriz do card comum (`FashionCardStats`) desenhar a aba Hype sem código novo e sem chamada à API. `TREND_VELOCITY`
  não existe no snapshot e aparece como "—".

## Arquivos

- `components/flair/flair-game-card.tsx` (69 linhas) — mesma interface pública (`{card, size, flip}`) e as mesmas
  exportações (`FlairTier`, `FLAIR_TIERS`, `HYPE_KEYS`, `seasonName`, `FlairCollectionCard`); compõe os dois abaixo.
- `components/flair/flair-piece-card-art.tsx` (novo) — `FlairPieceCardArt` (a arte), `FlairPieceCardHeader` (nota, posição,
  nível, ↻) e `FlairPieceCardBack` (verso simples).
- `components/flair/flair-piece-card-panels.tsx` (novo) — `flairHypeSummary` (snapshot → `HypeSummary`), `FlairStatList`,
  `useFlairInfoRows` e `FlairPieceCardPanels` (mesmo DOM de `PieceCardPanels`; não reutilizou o componente porque ele
  acrescenta sozinho a linha "Estado de conservação: Não informado", que não faz sentido numa carta).
- `app/(site)/_styles/19-momentos-carta-flair.css` — as regras `.fgc` deram lugar às `.flair-piece-card`/`.fpc-*`
  (`.fgc-grid` e `.fgc-tier-head`, da lista por nível, continuam).
- Chaves i18n novas: `flairCard.row.{tier,ovr,position,ability,season,priceVerified,priceTyped}` e `flairCard.backLabel`
  (pt-BR, en, es). `flairCard.front`/`flairCard.back` deixaram de ser usadas (o ↻ é o `CardFlipButton` do card comum).
- Testes: `components/flair/flair-game-card.test.tsx` (novo), `flair-collection.test.tsx` e `flair-metal.test.tsx`
  ajustados ao novo DOM com as mesmas asserções semânticas.

## Pendências

- `app/(site)/_styles/22-aura-hype.css` (linhas 24–38, 49–51, 85–87) e `21-flair-central-desafios.css` (141, 165, 174)
  ainda têm regras `.fgc*` órfãs; os tamanhos dos exemplos dos tutoriais e do banco de cartas já foram reescritos para
  `.flair-piece-card` no arquivo 19. `scripts/e2e/verify-flair-led-borders.mjs` procura `.fgc`/`.fgc-metal-light`
  (agora `.flair-piece-card`/`.fpc-art-light`, animação `fpc-metal-reflection`).
