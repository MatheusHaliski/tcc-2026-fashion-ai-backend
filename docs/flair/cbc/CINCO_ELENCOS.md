# FLAIR CBC: elencos em quebra-cabeça

Os cinco elencos de linhas e química (Primeiro Elenco, Paleta do Ateliê, Casa da Marca, Noite de Estreia e Elenco
Lendário) foram **retirados** (front, servidor, testes e textos). O histórico de entregas e os contadores de edição já
gravados continuam no banco; nenhuma migration apaga nada. O nome deste arquivo ficou por causa das referências.

Agora cada elenco é um **quebra-cabeça com uma imagem do FashionAI**. A imagem é cortada em peças, uma por vaga. A
pessoa põe as próprias cartas nas vagas; a carta que cumpre o que a vaga pede (cor, estilo ou ocasião) **encaixa a
peça** e a parte da imagem aparece no lugar. Com o deck inteiro certo, o quebra-cabeça se completa, a entrega sai
sozinha (com a edição numerada, pela ordem de conclusão) e abre o modal **"Parabéns, você completou!"**.

## O catálogo, do mais simples ao mais difícil

| Código | Imagem (`public/flair/elencos`) | Recorte | Peças | O que as vagas pedem | Requisitos do deck |
| --- | --- | --- | --- | --- | --- |
| `DESAFIO_FOGO` | `fogo.webp` (cena do fogo de 10.webp) | grade 2 × 2 | 4 | as 4 vermelhas | todas as peças vermelhas |
| `DESAFIO_VERDE_FLORESTAL` | `verde-florestal.webp` | grade 2 × 2 | 4 | 3 verdes, 1 livre | pelo menos 3 verdes |
| `DESAFIO_AZUL_TECH` | `azul-tech.webp` | grade 2 × 2 | 4 | 1 azul, 3 livres | pelo menos 1 azul |
| `DESAFIO_FASHIONAI_TECH` | `fai-tech.webp` (circuito laranja) | grade 2 × 2 | 4 | as 4 de estilo moderno | todas com o estilo moderno |
| `CELEBRACAO_ARENA` | `arena.webp` (11.webp) | grade 3 × 2 | 6 | 3 para festa, 3 livres | pelo menos 3 para festa |
| `LOGO_QUEBRA_CABECA` | `logo-quebra-cabeca.webp` (12) | jigsaw 4 × 3 | 12 | 6 laranja (xadrez), 6 livres | pelo menos 6 laranja |
| `LOGO_SETORES` | `logo-3d.webp` (13) | 12 setores circulares iguais | 12 | ciclo preta, laranja, livre | 4 pretas e 4 laranja |
| `LOGO_TEAL` | `logo-teal.webp` (14) | jigsaw 4 × 3 | 12 | coluna esquerda azul, direita verde | 3 azuis e 3 verdes |
| `LOGO_CACOS` | `logo-cacos.webp` (15) | 12 cacos de vidro | 12 | ciclo rosa, roxa, livre | 4 rosa e 4 roxas |
| `LOGO_PECAS_FALTANDO` | `logo-pecas-faltando.webp` (16) | jigsaw 4 × 4 | 16 | cantos pretos, borda laranja, miolo livre | 6 laranja, 4 pretas e 3 marcas |

Todo elenco também pede o deck cheio (`CARTAS` = número de peças). As vagas aceitam carta de qualquer posição (`ANY`):
o que conta é a cor, o estilo ou a ocasião. As cores valem pela família da taxonomia (carmim conta como vermelha,
marinho como azul). Os requisitos de cor dos logos seguem as cores de cada imagem (o laranja e o preto do logo, o azul
e o verde do 14, o rosa e o roxo dos cacos); o 16, o mais difícil, pede também marcas variadas.

**Os recortes** (`lib/flair/elencos/recortes.ts`, contornos SVG aplicados com `clipPath`):

- **grade**: as quatro cenas de 10.webp viram quatro imagens; cada uma é cortada em quatro quadrados iguais, pelo
  centro da largura e da altura. A arena é cortada em 3 × 2 partes iguais.
- **jigsaw** (12, 14 e 16): peças com encaixe, saliência de um lado e reentrância do vizinho; a borda de fora é reta.
- **setores** (13): 12 fatias iguais do círculo do logo, começando no alto, no sentido horário.
- **cacos** (15): 12 polígonos entre as rachaduras principais da imagem, que saem do ponto de impacto perto do centro
  até a borda. São uma aproximação dos cacos visíveis (não um traçado pixel a pixel); juntos cobrem a imagem inteira.

## Como a peça encaixa

Cada vaga mostra o número da peça, o que ela pede, a carta e o estado. No quebra-cabeça:

- **vazia**: só o contorno tracejado sobre a imagem apagada;
- **conferindo**: a carta foi posta e o servidor ainda não julgou; a peça aparece fraca, pulsando;
- **não encaixou**: a carta não cumpre o pedido; a peça fica torta, fora do lugar e sem cor;
- **encaixou**: a peça voa de fora até o lugar e aparece em cor.

A tela nunca encaixa uma peça que o servidor não julgou. A bandeja mostra primeiro as cartas que parecem combinar com
a peça em destaque (pelas etiquetas da carta), só para ajudar; quem julga é o servidor.

## O modal de conclusão

Título "Parabéns, você completou!", a edição ganha e:

- **cenas** (fogo, verde, azul, FashionAI tech): só o quadrante daquela cena no vídeo de 10.webp (Firefly 2×2,
  1280×720 com tarjas pretas; quadrado útil `crop=720:720:280:0`). Cada quadrante virou um arquivo próprio
  (`fogo.mp4`, `verde-florestal.mp4`, `azul-tech.mp4`, `fai-tech.mp4`, 480×480, sem áudio), recortado com
  `ffmpeg -i firefly.mp4 -vf "crop=360:360:X:Y,scale=480:480" -an -c:v libx264 -crf 26`: FashionAI tech X=280 Y=0,
  azul X=640 Y=0, fogo X=280 Y=360, verde X=640 Y=360;
- **arena**: o vídeo `arena-celebracao.mp4`;
- **logos**: não há vídeo próprio. O modal mostra o próprio quebra-cabeça **se montando em CSS**, peça a peça (cada
  uma voa até o lugar com um atraso pela ordem), e a imagem brilha no fim. Escolhemos isso em vez de reaproveitar o
  vídeo das cenas porque mostra o logo daquele elenco, é leve e respeita o movimento reduzido.

Os vídeos tocam sem som, em laço, na própria página do celular e com os controles (`autoplay muted loop playsInline
controls`). Foram comprimidos com ffmpeg (H.264, CRF 26, sem áudio, `faststart`): 7,4 MB → 2,5 MB e 5,1 MB → 2,0 MB.
Fechar o modal deixa a imagem completa e um botão "Ver a conclusão".

## API

- `GET /api/flair/elencos`: `{elencos:[{codigo, pecas, concluido, edicao}]}` (logado).
- `GET /api/flair/elencos/{codigo}`: `{codigo, vagas:[{chave, posicao, pede}], requisitos:[{tipo, alvo, valor?, nivel?}]}`;
  `pede` usa as chaves do motor (`color`, `style`, `occasion`) com a lista de valores aceitos, ou `{}`.
- `POST /api/flair/elencos/{codigo}/conferir` com `{cartas:{vaga:cardId}}`: `{pecas:{vaga:boolean}, completas, total,
  requisitos:[{tipo, ok, valor, alvo}], ok}`. Só cartas da própria pessoa (422).
- `POST /api/flair/elencos/{codigo}/entrega`: o mesmo corpo; 422 se alguma peça ou requisito falha; grava a entrega e
  devolve o mesmo resultado mais `{edicao}`. Repetir não cria nova edição (contador `flair_cbc_squad_edicoes`).

Requisitos: `COR`, `ESTILO` e `OCASIAO` (pelo menos `alvo` cartas com o `valor`, a tag do motor `CbcRules`), `CARTAS`,
`MARCAS` (distintas) e `NIVEL_CARTA`. A avaliação (`FlairCbcAvaliacao`) passa cada vaga ao motor como `accepts`: a
peça encaixa quando a vaga tem carta e a carta cumpre o pedido.

## Capturas

Em `capturas/` (API simulada no navegador): a lista (`elencos-01-lista.webp`), o fogo em andamento com uma peça que não
encaixou, completo e o modal com o vídeo, o modal da arena, os setores em andamento e o modal com o logo se montando,
e os cacos em andamento e completos.
