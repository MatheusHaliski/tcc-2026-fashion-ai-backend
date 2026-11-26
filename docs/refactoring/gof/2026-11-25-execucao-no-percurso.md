# Execução no percurso: Decorator sobre o núcleo (25/11/2026)

## Problema

A reauditoria das 15 modalidades (docs/flair/flair-3d/REAUDITORIA_2026-11-25.md) mostrou que a habilidade da pessoa
não contava na nota: andar, desfilar e posar mudavam só a cena, e os recursos só subiam. A dona decidiu que a
habilidade passa a contar, com o servidor como única fonte da nota.

## Decisão

`Flair3dExecucao` é um **Decorator** de `Flair3dNucleo`, como `Flair3dJogadaDeCena`: embrulha os doze jogos de ação
jogável em `Flair3dNucleos.TODOS`. Ele espera o núcleo embrulhado fechar e, enquanto não há acionamento com `execucao`,
devolve EM_ACAO com o evento `EXECUCAO_PEDIDA`. O evento leva:

- um botão por marca, sorteado da semente;
- a janela de tempo, que sai da AGILIDADE do look;
- o recurso que o erro drena, a reserva e o dreno.

Quando chega o acionamento com os toques, ele dá a nota e fecha a partida:

| Situação | Efeito |
| --- | --- |
| Toque perfeito | +5 |
| Toque bom | +2 |
| Erro | −4 e drena o recurso |

O total fica entre −15 e +15. Se o recurso zerar, a partida fecha como `ESGOTADO`, com no máximo 30 pontos.

Nenhum núcleo muda: a regra é comum e fica num lugar só. Dress Fighter, Fashion Detective e Fashion Sports ficam de
fora, porque a habilidade deles mora no próprio motor.

## O que o servidor confere

- O toque é da marca certa.
- Vale um toque por marca (o primeiro).
- O botão é o pedido.
- A reação é humana: menos de 150 ms é antecipar.
- O tempo está dentro da janela.
- O ganho tem teto.

O tempo de reação vem do navegador. Não há como conferi-lo no servidor sem um canal em tempo real; o teto de +15 limita
o que uma fraude ganharia.

## Front

- `lib/flair/nucleos/movimento/execucao.ts` (puro) lê o pedido e repete as regras para a resposta na hora.
- `components/flair/nucleos/use-execucao-do-desfile.ts` abre a deixa em cada marca alcançada e envia os toques.
- `desfile-hud.tsx` mostra o botão com o anel da janela, a nota de cada marca e o recurso.
- Os comandos mandam ✕ ○ □ △ à deixa enquanto a execução está pendente (`execucao-pendente.ts`).
- Com "reduzir movimento", as deixas vêm em sequência, sem andar.
