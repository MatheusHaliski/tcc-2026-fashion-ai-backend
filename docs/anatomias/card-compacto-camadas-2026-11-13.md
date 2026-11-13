# Card social compacto em camadas (peça e look)

Data: 13/11/2026. Substitui as medidas de largura/altura de [cards-sociais-medidas-2026-10-22](cards-sociais-medidas-2026-10-22.md)
para os cards de **feed, busca, perfil e listas**. O card ampliado (modal/detalhe) não muda.

## Estudo das camadas

| # | Camada | Peça | Look | O que contém |
|---|---|---|---|---|
| 1 | Fundo com arte customizada | `.pc-art` | `.card-art-layer` em `.scheme-stage` | família/arte do Background Studio, efeitos; sem clique |
| 2 | Container | `.pc-frame > .pc-content` | `.scheme-container` | superfície sólida/vidro escolhida no criador |
| 3 | Fotografia | `.pc-media` | `.c-photo.is-look` | poço próprio com contorno fino, peça inteira (`contain`) |
| 4a | Janela 1 · identidade | `.pc-window.is-identity` | `.c-titleblock` | nome, marca/categoria, selos, marca·cor·ocasião·estilo, preço |
| 4b | Janela 2 · Info \| Hype | `.pc-panels` | `.pc-panels` | atributos (Info) ou matriz Hype; **🔥 + score no rótulo da aba Hype** |
| — | Borda | `.card-border` | `.card-border` | cor sólida, degradê ou padrão, com efeito (criador → aba Borda) |

As duas janelas têm fundo, contorno e raio próprios (10 px), o que torna nítida a divisão entre arte, container, foto
e dados.

## Medidas

| Item | Antes | Agora |
|---|---|---|
| Card (largura × altura) | 470 × 870–978 px (variava com o conteúdo) | **248 × 520 px fixos** em todas as telas (≈ 53 % × 55 %) |
| Fotografia | 428 × 321 px (≈ 34 % da altura) | 210 × 128 px (≈ 25 %; ↓ ≈ 30 % na proporção) |
| Janelas de dados | ≈ 51 % do card | ≈ 62 % do container (↑ ≈ 40 % na proporção do card) |
| Cabeçalho / ações | 48 / 48 px | 36 / 34 px |
| Texto | valores 16 px | nome 15 px, valores 12–13 px, rótulos 12 px em versalete (mínimo do projeto: 12 px) |

Os percentuais pedidos (−50 % no card, −35 % na foto, +40 % nas janelas) foram ajustados para manter a peça legível e
o card elegante: com −35 % sobre um card já reduzido à metade a foto ficaria com ~80 px de altura. Conteúdo maior que
a janela rola **dentro** dela; o card nunca muda de tamanho, então a grade fica alinhada.

## Grades

`.feed-compact-grid`, `.social-card-grid` e as grades `.grid-cards`/`.grid-looks` que contêm cards sociais usam
colunas de largura fixa (`repeat(auto-fill, 248px)`), centralizadas, até quatro colunas. No celular (390 px): uma
coluna de 248 px.

## Borda (criador de peça, look e DNA)

Aba **Borda** na Arte de fundo: **Padrão** (acompanha a paleta da arte; sem arte, degradê champanhe `#c6b8a4` → linho
`#f1e6d5`), **Cor sólida** (8 sugestões + seletor livre) ou **Degradê** (8 prontos + duas cores livres), e o efeito da
linha (Automático, Liso, Brilho, Cintilante, Holográfico). Sem escolha, nada é gravado e vale o padrão.

## Verificação

Medido no Chromium com a página real dos componentes (`PieceCard`, `SchemeCard`) e respostas da API simuladas:
16 cards em quatro grades (feed, busca de peças, busca de looks, `grid-cards`) em 1440 px e 390 px — todos 248 × 520.

Capturas: [antes](../correcoes/2026-11-13-card-compacto/antes-1440.png) ·
[peças depois](../correcoes/2026-11-13-card-compacto/pecas-depois.png) ·
[looks depois](../correcoes/2026-11-13-card-compacto/looks-depois.png) ·
[feed depois](../correcoes/2026-11-13-card-compacto/feed-depois.png) ·
[criador, aba Borda](../correcoes/2026-11-13-card-compacto/criador-aba-borda.png).
