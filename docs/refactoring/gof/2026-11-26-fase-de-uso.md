# Fase de uso dos jogos de zonas (26/11/2026)

## Problema

A reauditoria (docs/flair/flair-3d/REAUDITORIA_2026-11-25.md) deu as quatro menores notas aos jogos de zonas (Clube do
Coração, My Favorite Singer, Meu Piloto Favorito, Meu Super-Herói): "a fase de uso é andar 0,5 m e posar". A execução
no percurso (`Flair3dExecucao`, Decorator) já existia neles, com três marcas dentro do tablado do ateliê e um botão por
marca: havia tempo, mas não havia decisão, e o recurso só caía por erro.

## Decisões

| Peça | Padrão | Por quê |
| --- | --- | --- |
| `Flair3dFaseDeUso` | **NENHUM** (tabela e regra pura) | A fase de uso é a mesma execução com outros números (5 marcas, prazo) e um lance a mais por marca (o ousado). Não é outro sistema: `Flair3dExecucao` continua o único Decorator, pede as marcas de `Flair3dFaseDeUso.marcasDo`, leva o `Risco` no mesmo `Pedido` e delega a nota quando há risco. Um segundo Decorator duplicaria o acionamento, o pedido e a leitura do `DESGASTE`. |
| `Pedido.risco` (nulo fora da fase de uso) | **NENHUM** | O pedido dos doze jogos de ação não muda: os campos novos (`ousados`, `custo`, `janelaOusadaMs`, `prazoMs`) só saem no evento quando há risco. |
| `lib/flair/nucleos/movimento/fase-de-uso.ts`, `scene/salas/fase-de-uso.ts` | **NENHUM** (dados) | As marcas, o alvo e os gestos de cada jogo e o lugar de uso (campo, palco, pista, terraço) são descrição pura, como as salas. O lugar fica fora de `VARIANTES` porque tem outras zonas (o piso inteiro é do avatar). |
| `obstaculosDaSala` com uma lista por folga | **NENHUM** (correção) | O cache era por sala e valia a folga de quem chamasse primeiro: com a câmera montada antes, o andar recebia as caixas com a folga da lente. |

## Contrato

- `EXECUCAO_PEDIDA` na fase de uso: `{botoes[5], janelaMs, recurso, reserva, dreno, ousados[5], custo, janelaOusadaMs,
  prazoMs}`. O acionamento é o mesmo (`execucao.toques`); o toque com o botão ousado da marca gasta `custo` (acerte ou
  erre) e vale `OUSADO` dentro de `janelaOusadaMs`.
- `EXECUCAO.marcas` passa a poder trazer `OUSADO`, além de `PERFEITO`, `BOM` e `ERROU`. Pontos: ousado 4, seguro
  perfeito 2, bom 1, erro −4; teto 15, como antes.
- A reserva é a que a tinta deixou (`Flair3dTinta`); zerada, a partida fecha `ESGOTADO`, com no máximo 30 pontos.
- Os tempos (reação e prazo) vêm do navegador, como na execução comum: o servidor confere botão, marca, reação mínima e
  um toque por marca.
