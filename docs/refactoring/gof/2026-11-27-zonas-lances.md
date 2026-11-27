# Rodada zonas: lance do gênero, cartas como ação e dificuldade (27/11/2026)

## Problema

Nos quatro jogos de zonas (Clube do Coração, My Favorite Singer, Meu Piloto Favorito, Meu Super-Herói) a fase de uso
era a mesma em todos: andar até a marca e escolher entre o lance seguro e o ousado. Faltavam a mecânica do gênero, as
cartas como ação, a Aura na partida e uma dificuldade que subisse.

## Decisões

| Peça | Padrão | Por quê |
| --- | --- | --- |
| `Flair3dMomentoChave` | **NENHUM** (tabela) | Um momento por jogo (pênalti, virada da música, pit stop, ameaça): a marca, duas condições e duas opções. São dados com um sorteio, não comportamento diferente por jogo; um Strategy por jogo repetiria quatro vezes a mesma regra. |
| `Flair3dCartaDeUso` | **NENHUM** (tabela e regra pura) | A cor da carta escolhe um de três efeitos (embalo, fôlego, escudo) com o nome do lance do jogo, como `Flair3dCores` faz nos jogos de cartas. A Especial é a Metamorfose. O Hype é só lido (`Flair3dHype.bandOf`). |
| `Flair3dFaseDeUsoNota` | **NENHUM** (extração) | A nota marca a marca saiu de `Flair3dFaseDeUso`, que ficou com o risco (o pedido) e a dificuldade. `Flair3dExecucao` continua o único Decorator e delega como antes. |
| `Acionamento.Toque.carta` | **NENHUM** | Campo opcional no toque. `Acionamento.cartas()` passa a listar as cartas dos toques, e o serviço só as carrega se forem da pessoa (as de outra pessoa não chegam ao contexto e não valem nada). |

## Contrato (aditivo)

- `EXECUCAO_PEDIDA` ganha `janelas[5]`, `janelasOusadas[5]`, `nivel`, `cartasMax`, `recarga`, `uniforme[]` e `chave`
  (`{marca, momento, condicao, opcoes[2], certa}`). A primeira opção vai no botão do lance seguro da marca, a segunda no
  do ousado; `certa` é o botão da opção certa para a condição sorteada.
- `execucao.toques[]` aceita `carta` (UUID). Até 3 cartas por fase, cada uma uma vez; a Especial volta depois de 2
  marcas.
- `EXECUCAO` ganha `cartas[5]` (o efeito de cada marca, ou nulo), `torcida` (a maior faixa de Hype entre as cartas),
  `chaveCerta` e `nivel`. `marcas[]` pode trazer `CHAVE` e `DEFENDIDO`.
- Teto da execução continua 15. Sem migração.
