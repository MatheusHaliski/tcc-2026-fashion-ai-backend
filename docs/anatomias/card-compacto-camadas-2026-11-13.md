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
| Card (largura × altura) | 470 × 870–978 px (variava com o conteúdo) | **264 × 552 px fixos** em todas as telas (≈ 56 % × 58 %) |
| Fotografia | 428 × 321 px (≈ 34 % da altura) | 214 × 128 px (≈ 23 %; ↓ ≈ 30 % na proporção) |
| Janelas de dados | ≈ 51 % do card | ≈ 62 % do container (↑ ≈ 40 % na proporção do card) |
| Moldura da arte (faixa entre a borda e o container) | 12–20 px, variável | **16 px** nas laterais (≈ 23 px em cima e embaixo na peça) |
| Cantos | raio da skin (6–10 px) | **22 px** no card, 12 px no container, 10 px na foto e nas janelas |
| Linha da borda | 2 px | **3 px** (cor, degradê ou padrão) |
| Cabeçalho / ações | 48 / 48 px | 36 / 34 px |
| Texto | valores 16 px | nome 15 px, valores 12–13 px, rótulos 12 px em versalete (mínimo do projeto: 12 px) |

Os percentuais pedidos (−50 % no card, −35 % na foto, +40 % nas janelas) foram ajustados para manter a peça legível e
o card elegante: com −35 % sobre um card já reduzido à metade a foto ficaria com ~80 px de altura. Conteúdo maior que
a janela rola **dentro** dela; o card nunca muda de tamanho, então a grade fica alinhada.

## Grades

`.feed-compact-grid`, `.social-card-grid` e as grades `.grid-cards`/`.grid-looks` que contêm cards sociais usam
colunas de largura fixa (`repeat(auto-fill, 264px)`), centralizadas, até quatro colunas. No celular (390 px): uma
coluna de 264 px.

## Borda (criador de peça, look e DNA)

Aba **Borda** na Arte de fundo: **Padrão** (acompanha a paleta da arte; sem arte, degradê champanhe `#c6b8a4` → linho
`#f1e6d5`), **Cor sólida** (8 sugestões + seletor livre) ou **Degradê** (8 prontos + duas cores livres), e o efeito da
linha (Automático, Liso, Brilho, Cintilante, Holográfico). Sem escolha, nada é gravado e vale o padrão.

## Verificação

Medido no Chromium com a página real dos componentes (`PieceCard`, `SchemeCard`) e respostas da API simuladas:
16 cards em quatro grades (feed, busca de peças, busca de looks, `grid-cards`) em 1440 px e 390 px — todos 264 × 552 (medição final: 9 cards em três grades, 1440 px, com as famílias de arte bento, passarela e blocos).

Capturas: [antes](../correcoes/2026-11-13-card-compacto/antes-1440.png) ·
[peças depois](../correcoes/2026-11-13-card-compacto/pecas-depois.png) ·
[looks depois](../correcoes/2026-11-13-card-compacto/looks-depois.png) ·
[criador, aba Borda](../correcoes/2026-11-13-card-compacto/criador-aba-borda.png).

## Card ampliado em janelas (peça e look)

Folha `app/(site)/_styles/30-card-ampliado-janelas.css`. Mesmas camadas do compacto; cada bloco vira uma janela com
contorno e raio de 12 px, sem linhas divisórias soltas.

| Item | Antes | Agora |
|---|---|---|
| Peça ampliada (modal, 1280 px) | 1040 × 808 px | 900 × 725 px |
| Look ampliado (altura total) | 1273 px | 970 px (foto limitada a 40 % da altura da tela, no máximo 340 px) |
| Ficha da peça | aba Info **e** seção "Detalhes" (categoria, cor, ocasião, estilo e estado repetidos) | só a aba Info, com a ficha completa |
| Look · aba Info | estilo, ocasião e "Estado de conservação: Não informado" | estilo, ocasião e estação |
| Look · chips no rodapé | ocasião, estilo e estação repetidos | removidos (o selo do bloco, se houver, fica) |
| Peça · opções | "História & cuidados" em seção própria + "Mais opções" em outra | uma única linha de opções |
| Carta FLAIR | título, nota explicativa e botão em três linhas | título e botão na mesma linha (nota só para leitor de tela) |
| Rótulo Hype | ícone de chama + 🔥 + score | 🔥 + score |

Nenhuma ação foi removida: reações, remix, 3D, passaporte, edição e as ações do dono do look continuam disponíveis.

## Card compacto do próprio dono

Quando o card é da pessoa logada (`data-own`), o avatar e o "@usuário" saem do cabeçalho — a autoria é redundante no
próprio closet, perfil e feed. Na peça, o botão ↻ e a visibilidade flutuam sobre a foto, que ganha a altura do
cabeçalho. A linha "marca · estado" sob o nome também saiu do compacto (os dois dados já estão nas janelas).

Capturas: [peça antes](../correcoes/2026-11-13-card-compacto/ampliado-peca-antes.png) ·
[peça depois](../correcoes/2026-11-13-card-compacto/ampliado-peca-depois.png) ·
[look antes](../correcoes/2026-11-13-card-compacto/ampliado-look-antes.png) ·
[look depois](../correcoes/2026-11-13-card-compacto/ampliado-look-depois.png) ·
[compacto do dono](../correcoes/2026-11-13-card-compacto/compacto-proprio-dono.png).
