# Multiplayer do FLAIR 3D (frente A1, 27/11/2026)

Pedido da dona: "modo multiplayer (não escrever a tag do adversário e sim convidar através de busca na rede FAI que
filtra usuários)". Nenhuma tela do FLAIR pede tag digitada: o adversário sai sempre da busca.

## Fluxo

1. **Buscar** (`GET /api/flair/3d/adversarios`): termo + filtros `relacao` (TODOS, SIGO, ME_SEGUE, MUTUOS), `nivel`
   (rank FLAIR mínimo), `estilo` (arquétipo do DNA, só de perfil público), `pais`, `cidade` (só com consentimento do
   ranking), `ativo` (login ou partida nos últimos 7 dias), `jogo` + `comDeck` (tem cartas para o deck do jogo). Cada
   resultado traz avatar, nome, nível, estilo, relação, status com quem busca (DISPONIVEL, CONVITE_PENDENTE, EM_SALA) e
   se pode ser convidado (conta privada que a pessoa não segue: `convidavel=false`, `motivo=CONTA_PRIVADA`). Bloqueio
   (nos dois sentidos), a própria pessoa, conta de teste (para conta real) e menor de 13 nunca aparecem.
2. **Convidar** (`POST /api/flair/3d/convites {para, jogo, modo, rodada}`): sala CONVIDADO com prazo de 48 h e
   notificação `FLAIR3D_CONVITE` (link `/flair/3d/sala/{id}`). Um convite aberto por pessoa e jogo; até 10 salas em
   aberto.
3. **Aceitar / recusar / cancelar** (`POST /api/flair/3d/salas/{id}/aceitar|recusar|cancelar`): aceitar é de quem foi
   convidada e abre a sala (JOGANDO, aviso `FLAIR3D_VEZ` a quem convidou); cancelar é de quem convidou. Convite vencido
   vira EXPIRADO na primeira leitura (409 `CONVITE_EXPIRADO`). Recusa e expiração não avisam ninguém.
4. **Jogar**, conforme o modo da sala:
   - **ASSINCRONO — mesma semente** (os 15 jogos e o MAKE UP): `POST /salas/{id}/partida {deck, avatar}` abre a partida
     do lado da pessoa com a semente e a rodada da sala; a tela de jogo é a mesma (`/flair/3d/<jogo>?sala={id}`). No
     MAKE UP, `POST /salas/{id}/look {lookId}` registra o look entregue no brief da sala. A nota da outra pessoa só
     aparece quando as duas terminaram; mais pontos vence, depois estrelas, senão empate.
   - **TURNOS** (Batalha de Looks — piloto, Dress Fighter, Fashion Sports): `POST /salas/{id}/deck {deck}` (regras do
     deck do jogo, travado após o primeiro lance) e `POST /salas/{id}/lance {turno, cartas}`. O lance fica selado até a
     outra pessoa lançar o mesmo turno; então o servidor julga (Strategy `Flair3dDuelo`). Batalha: 3 rodadas com os
     desafios da semente, a pessoa convidada no lugar do look da casa, peça repetida cansada, voto da plateia no empate.
     Dress Fighter: 9 lances ou nocaute, golpe pela cor da carta contra o golpe da outra pessoa. Fashion Sports: 6
     lances alternando ataque e defesa, gol quando o ataque passa a defesa.
   - **COOP** (Fashion Detective, Meu Super-Herói): **próximo passo**. O caso do Detective guarda pistas por partida
     (`FashionDetectiveCaso`); dividir pistas entre duas partidas pede um estado compartilhado da sala e uma regra de
     acusação conjunta. Até lá, os dois jogam o Detective e o Super-Herói no modo assíncrono (mesma semente).
5. **Resultado, revanche e histórico**: `GET /salas/{id}` (polling de 2 s na tela) traz os dois lados e o vencedor;
   `POST /salas/{id}/revanche` convida o outro lado com a semente seguinte; `GET /api/flair/3d/historico/{userId}` dá o
   placar do confronto. Aviso `FLAIR3D_RESULTADO` para os dois.

## Single player

Continua igual: cada jogo abre na escolha de rodada/deck ("Treinar contra a Casa"), com o adversário da semente.
"Jogar contra alguém" é uma opção ao lado.

## FLAIR 2D e desafios

- Duelo 1×1 (`classic-modes.tsx`): o campo de tag saiu. A main trouxe em paralelo o `FaiNetworkPicker` (busca na rede
  com seguindo/seguidores/mútuos, manda o @ escolhido) e ele ficou no merge. O servidor aceita também `opponentId`
  (`FlairDueloOponente`: bloqueio, conta de teste e 13+ conferidos), que é o que `EscolherAdversario` manda; unificar
  os dois seletores num só é o próximo passo. A API antiga (`opponent` = @usuário ou CASA) continua aceita.
- Desafios (`challenge-start-dialog.tsx`): os convidados saem da busca (ids), não de texto separado por vírgula; a API
  (`invitees: UUID[]`) não mudou.

## Banco

`V133__multiplayer_flair3d.sql` (tabela `flair3d_salas`) e o SQL para rodar à mão no Railway em
`docs/banco-de-dados/solucoes/sql/railway/133-multiplayer-flair3d.sql`.
