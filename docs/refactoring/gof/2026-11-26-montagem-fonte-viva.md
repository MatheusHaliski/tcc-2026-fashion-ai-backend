# Fonte viva do quebra-cabeça dinâmico dos Desafios de Montagem (26/11/2026)

## Problema

Os Desafios de Montagem dinâmicos recortam as peças de uma fonte em movimento. Há duas fontes de natureza diferente:
um vídeo (`<video>` fora do documento, sem som, em laço, com pôster para "reduzir movimento") e o símbolo FAI animado
em código (giro, pulso, órbita e brilhos). O pintor das peças (`lib/flair/montagem/dinamico/pintura.ts`) precisa só de
"o quadro deste instante" numa tela de apoio, para recortar todas as peças do mesmo quadro (sincronizadas).

## Decisões

| Peça | Padrão | Por quê |
| --- | --- | --- |
| `lib/flair/montagem/dinamico/fonte.ts` (`FonteViva`, `criarFonteViva`) | **Strategy** | Duas formas de produzir o quadro com o mesmo contrato (`pintar`, `tocar`, `pausar`, `soltar`). O hook `use-quebra-cabeca-vivo.ts` e o pintor não sabem de onde o quadro vem; um cenário novo com outra fonte (ex.: canvas procedural) só acrescenta uma estratégia. |
| `catalogo.ts`, `recorte.ts`, `movimento.ts`, `pintura.ts` | **NENHUM** | Dados e funções puras (testadas sem DOM). O recorte reaproveita `lib/flair/elencos/recortes.ts` (grade, jigsaw, setores, cacos) e a folga por estado (`folgaDaPeca`). |
| `components/flair/montagem/cbc-arte.tsx` | **NENHUM** (seleção simples) | Um `if` escolhe entre o quebra-cabeça dinâmico e a cena desenhada (`CenaViva`); não há hierarquia que peça fábrica. |

## Contrato

Nada muda na API: o cenário (`flair_challenges.scenario`) decide a fonte no cliente. Cenários dinâmicos:
`firefly-fogo`, `arena`, `logo-fai`, `logo-deriva`, `caleidoscopio`.
