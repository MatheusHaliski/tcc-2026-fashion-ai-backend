# Recurso que se gasta: desgaste, orçamento de tinta e regras de lance (25/11/2026)

## Problema

A reauditoria (docs/flair/flair-3d/REAUDITORIA_2026-11-25.md) apontou que os recursos "só sobem": vida, energia, foco e
moedas subiam com o USAR e nada os gastava, salvo os erros da execução no percurso (`Flair3dExecucao`, Decorator). Cada
jogo pedia um gasto próprio: a apresentação errada no Labirinto, a tentativa reprovada na viagem, a peça fora do tema,
do perfil, do pedido ou da cena, a tinta dos jogos de zonas.

A partida é refeita do zero a cada chamada (semente + entregas + acionamentos + usos). Gravar o gasto como um uso
negativo no andamento contaria duas vezes na revisão; por isso o gasto é sempre recalculado do histórico.

## Decisões

| Peça | Padrão | Por quê |
| --- | --- | --- |
| `recurso/Flair3dDesgaste` | **NENHUM** (valor puro) | É um registro imutável com a reserva e os motivos; cada núcleo diz o que gasta e o evento `DESGASTE` leva o resultado. Não há hierarquia nem troca de comportamento que peça um padrão. |
| `Flair3dPercurso.Etapas#falha()` | **NENHUM** (método padrão) | As rodadas em etapas que gastam a cada falha declaram custo e recurso; o percurso conta as falhas que já conta para a tentativa. |
| `Flair3dExecucao` lê o `DESGASTE` | Decorator existente | A execução começa com a reserva que as decisões deixaram; sem o evento, usa a reserva das peças, como antes. Nenhum núcleo novo precisa saber da execução. |
| `Flair3dTinta` | **Decorator** | A regra do orçamento é a mesma para Clube, Singer, Piloto e Super-Herói e fica fora das regras de cor de cada jogo, como `Flair3dJogadaDeCena` e `Flair3dExecucao`. Em `Flair3dNucleos`: `exec(new Flair3dTinta(jogo))`, ou seja, a tinta fecha a peça e a execução vem depois. |
| `BatalhaLooksAdversario`, `DressFighterDistancia`, `esporte/EsporteTempo`, `detetive` (CAPTURADO) | **NENHUM** | Regras puras de um jogo só, extraídas do núcleo para caberem no limite de linhas e serem testadas sozinhas. |

## Contrato

- Evento `DESGASTE`: `{recurso, reserva, gasto, restante, motivos}`. Reserva zerada pelas decisões fecha a partida no
  desfecho do jogo (`DERROTA`, `REPROVADO`, `CLIENTE_FOI_EMBORA`, `DIRETOR_CORTOU`), com no máximo 30 pontos onde já
  havia nota.
- Evento `TINTA`: `{orcamento, gasto, sobra}`, na prévia e no resultado; passar do orçamento fecha `SEM_TINTA`.
- Alvos aceitos (o servidor recusa outro valor com 422): `DISTANCIA:PERTO|LONGE` no lance do Dress Fighter;
  `TEMPO:0|1|2`, junto de `POSICAO:dx,dy`, na jogada do Fashion Sports.

## Verificação

Testes de cada núcleo (vitória e derrota alcançáveis, look neutro com a nota de antes onde a regra não mudou) e os de
serviço repetidos 30 vezes sem falha. Medições: Dress Fighter, 60 lutas com cartas Bronze, quem recua do rápido vence
59 e quem fica sempre perto 29; Fashion Sports, 30 partidas, perfeito na barra 2880 pontos e erro 2800.
