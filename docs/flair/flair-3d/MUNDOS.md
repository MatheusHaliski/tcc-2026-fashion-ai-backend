# Mundos exploráveis

Pedido da dona (15/11/2026): o Fashion Detective como um lugar interligado (feito: as nove salas do caso "A Coleção
Maré"), o Around the World por bairros e O Labirinto desenhado como lugar, não como uma sala com portas. Este
documento fixa os princípios de desenho de nível que os três seguem e descreve os dois mundos novos. Só princípios:
nenhum mapa, rota ou cenário copiado de outro jogo.

## Princípios

1. **Marco que se vê de longe.** Todo mundo tem um ponto alto ou claro que orienta sem mapa (o farol, a fonte). A
   câmera de exploração o mantém no quadro sempre que dá.
2. **Luz ou cor que guia.** Os pontos do caminho principal têm uma luz de uma cor só (âmbar, turquesa, violeta) no piso
   ou nas fachadas; quem segue a cor chega ao objetivo sem ler nada.
3. **Laços, não corredores.** Pelo menos um caminho fecha em laço: dá para voltar por outro lado e ver o lugar de outro
   ângulo. Ida e volta pelo mesmo corredor é o que o desenho evita.
4. **Camadas de altura.** Uma segunda camada (mirante, galeria alta) ligada por escada, de onde se vê o desenho do
   lugar e o caminho percorrido.
5. **Recompensa fora do caminho.** Uma peça de presente, uma pista ou um atalho num ponto que não está no caminho
   principal, a pelo menos um passo dele, para quem explora.
6. **Mesmas regras do resto do FLAIR.** Público a partir de 13 anos, sem arma e sem sangue; a nota sai do servidor; com
   "reduzir movimento", a planta de cima substitui a câmera de exploração.

A conferência automática desses princípios está em `lib/flair/mundos/mundo.ts` (`conferirMundo`): caminho principal
contínuo, laço, recompensa fora do caminho, marco, duas camadas ligadas por escada e luz guia em cada ponto do caminho.

## Around the World: Orla do Mirante

Uma orla em curva: o calçadão, a praça das bancas e a subida até o mirante. Doze pontos em duas camadas
(`ORLA_DO_MIRANTE` em `lib/flair/mundos/mundos.ts`).

| Trecho | O que há | Princípio |
| --- | --- | --- |
| Ponto do ônibus → calçadão oeste → bancas | luz âmbar no piso, as bancas acesas | luz guia |
| Praça | encontro do calçadão, da rua de trás, do beco e da escada | laço (praça, calçadão leste e rua de trás) |
| Beco → ateliê do beco | a peça de presente da região | recompensa fora do caminho (2 passos) |
| Escada do morro → patamar → mirante | luz turquesa; a vitrine da região no mirante (o objetivo da etapa) | camada alta |
| Farol | visto de toda a orla | marco |

Cada região da rodada "Volta ao mundo" reusa o mesmo esqueleto com outra paleta e outra vitrine; o look da região é
avaliado na vitrine do mirante.

## O Labirinto: Jardim dos Espelhos

Corredores de sebe com espelhos nas esquinas, um pátio com fonte e uma galeria alta em volta. Doze pontos em duas
camadas (`JARDIM_DOS_ESPELHOS`).

| Trecho | O que há | Princípio |
| --- | --- | --- |
| Portão → esquina 1 → corredor oeste → pátio | luz violeta nas esquinas do caminho | luz guia |
| Corredor leste | o outro lado do jardim, que também chega ao pátio | laço |
| Pátio | a fonte, vista de todo o jardim | marco |
| Atrás da fonte → espelho-mestre | o espelho que abre com o look certo (o objetivo) | objetivo |
| Escada de pedra → galeria alta → banco esquecido | a vista do desenho inteiro e a peça escondida no banco | camada alta e recompensa (4 passos) |

Os espelhos das esquinas mostram a família de cor da porta seguinte, como as pistas da rodada "Escada de Espelhos".

## Estado

| Item | Estado |
| --- | --- |
| Princípios e conferência automática (`conferirMundo`, testes em `lib/flair/mundos/mundos.test.ts`) | feito |
| Os dois mundos como dados (pontos, ligações, caminho principal, camadas, marcos, guias, recompensas) | feito |
| Andar pelos mundos na tela (câmera de exploração, avatar ponto a ponto, planta de cima), reusando o que o Fashion Detective já tem | pendente |
| Cenário 3D de cada ponto (fachadas de dois andares, sebe, fonte, farol) | pendente |
| Ligar a rodada "Volta ao mundo" e a "Escada de Espelhos" aos mundos (a etapa avaliada no objetivo) | pendente |
