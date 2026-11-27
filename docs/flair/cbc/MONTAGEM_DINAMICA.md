# Desafios de Montagem dinâmicos (quebra-cabeças em movimento)

Os Elencos (`CINCO_ELENCOS.md`, PR #597) são quebra-cabeças de imagens paradas. Nos Desafios de Montagem dinâmicos,
cada peça é uma janela para uma fonte **em movimento**: o vídeo da cena tocando ou o símbolo FAI animado em código.
Todas as peças saem do mesmo quadro (um canvas de apoio por quadro), por isso ficam sincronizadas.

## Como joga

- Uma peça por vaga do desafio (o recorte se ajusta ao número de vagas que vem do servidor).
- Vaga vazia: só o contorno tracejado. Carta posta e ainda sem conferência: a peça chega fraca, pulsando.
- Sintonia 0–1 (o servidor confere): fora do lugar, girada e sem cor. Sintonia 2: quase no lugar. Sintonia 3: encaixada.
- Quando o estado muda, a peça desliza até o lugar novo (0,7 s, com um leve passo além do ponto).
- Entregue, o quadro inteiro em movimento aparece e o modal de recompensa abre com "Parabéns, você completou!" e o
  vídeo inteiro da cena (sem som, em laço, com controles, quadro cheio na proporção do vídeo, sem faixas pretas) ou o
  símbolo FAI animado.
- "Reduzir movimento" (sistema ou app): o vídeo não toca, fica o pôster; o símbolo fica parado; as peças mudam de
  lugar na hora.

## Desafios (V131__montagem_quebra_cabeca_dinamico.sql)

| Slug | Cenário | Fonte | Recorte | Vagas | Requisito |
| --- | --- | --- | --- | --- | --- |
| `fogo-em-movimento` | `firefly-fogo` | `public/flair/elencos/fogo.mp4` (só o quadrante do fogo) | jigsaw 2×2 | 4 | 2 cartas vermelhas ou laranja |
| `arena-em-movimento` | `arena` | `public/flair/elencos/arena-celebracao.mp4` | grade 3×2 | 6 | 2 cartas de festa |
| `simbolo-fai-em-orbita` | `logo-fai` | `logo-3d.webp` animado em código (giro, pulso, órbita, brilhos) | 8 setores | 8 | 2 cartas laranja ou pretas |
| `logo-a-deriva` | `logo-deriva` | `public/flair/montagem/logo-deriva.mp4` (desenho novo) | 7 cacos | 7 | 3 marcas diferentes |
| `caleidoscopio-azul` | `caleidoscopio` | `public/flair/montagem/caleidoscopio.mp4` (desenho novo) | 6 setores | 6 | 2 cartas azuis ou roxas |

Nunca se usa o vídeo 2×2 do Firefly: cada cena usa só o vídeo do próprio quadrante (regra do #597).

## Desenhos animados novos (procedurais, sem IA)

`scripts/flair-modes/montagem-desenhos.sh` gera com ffmpeg, a partir das referências:

- `caleidoscopio.mp4`: a cena azul (`azul-tech.mp4`) espelhada em quatro, matiz girando, ida e volta (laço sem emenda).
- `logo-deriva.mp4`: `logo-teal.webp` com zoom, passeio em círculo, balanço e matiz dando uma volta (laço de 8 s).

E o símbolo FAI em órbita é animado em canvas (`lib/flair/montagem/dinamico/movimento.ts`). Todos abaixo de 2 MB.

## Código

- `lib/flair/montagem/dinamico/`: `catalogo.ts` (cenário → fonte e forma), `recorte.ts` (n peças), `movimento.ts`
  (pose do símbolo, trajetos das peças), `pintura.ts` (canvas), `fonte.ts` (Strategy vídeo/símbolo, ver
  `docs/refactoring/gof/2026-11-26-montagem-fonte-viva.md`).
- `components/flair/montagem/`: `quebra-cabeca-vivo.tsx` + `use-quebra-cabeca-vivo.ts`, `cbc-arte.tsx` (escolhe entre
  o quebra-cabeça dinâmico e a cena desenhada), `montagem-final.tsx` (o fim no modal de recompensa).
- Estilos: `app/(site)/_styles/58-flair-montagem-dinamica.css`.
