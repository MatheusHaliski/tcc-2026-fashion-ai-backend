# Pessoas

**Zonas do blueprint:** todas · **Arquivos da área:** `components/heist/people/*`, `lib/avatar3d/human/locomotion.ts` (e o que
o corpo humano usa em `lib/avatar3d/human/`), `lib/heist/looks.ts`; laboratório `/lab/heist-gente`

## O que o cenário pede das pessoas

| Pedido | O que construir | Estado |
| --- | --- | --- |
| Pista com convidados dançando de verdade | Dança no ritmo (≈ 120 BPM), com passos diferentes por pessoa (balanço, passo lateral, giro, braços), fase e intensidade variadas, pés plantados sem patinar, pares que se olham; para e olha quando há tiro ou alarme | PLANEJADO |
| DJ tocando | Animação "dj": mãos no mixer e nos pratos, uma mão segurando o fone numa orelha de vez em quando, cabeça e ombros no ritmo; visual próprio (`dj`) e fone de ouvido (`headphones`) | PLANEJADO (provisório: gesto de interagir) |
| Convidados comendo | Animação "eat": prato pequeno numa mão (`plate`), garfo ou doce na outra, levar à boca, mastigar | PLANEJADO (provisório: gesto de beber) |
| Garçons servindo | Bandeja estável na mão, taças individualizadas com líquido, oferecer e entregar | parcial |
| Chef e equipe da copa | Visual próprio (`chef`): dólmã branco, avental, touca | PLANEJADO (provisório) |
| Humanos reais | Pele, cabelo, olhos, roupas com volume, joias; nada de manequim | parcial |

## Regras

- Os nomes `dj`, `eat`, `plate`, `headphones`, `chef` já existem nos tipos (`lib/heist/types.ts`) e na locomoção; esta
  área troca os provisórios pela animação e pelos objetos de verdade.
- Desempenho: a multidão do salão pode passar de 60 pessoas; animação espaçada e nível de detalhe por distância.

## Estudo da área

_Preenchido pelo agente das pessoas._

## Implementado

_Preenchido pelo agente das pessoas._
