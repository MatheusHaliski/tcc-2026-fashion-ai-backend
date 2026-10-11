# Prova no espelho dentro do quarto (RF27 ↔ RF28)

As abas **Meu Quarto** e **Espelho** passam a ser um fluxo só: o personagem caminha até o espelho e a prova abre sozinha,
sem sair do quarto e sem trocar de tela; afastar-se volta ao quarto. Desde 11/10 o **Espelho não tem mais tela própria**:
`/mirror` só redireciona para `/room?espelho=1` (ver "Espelho como navegação derivada" no fim).

## Estados e transições

```
Quarto ──(distância < 1,15 m, por 350 ms)──► Aproximação ──► Prova ──(troca)──► Prova
  ▲                                                                   │
  └──(distância > 1,70 m, por 250 ms)── Saída ◄──────────────────────┘
```

| Fase | O que a pessoa vê | Câmera | Personagem |
|---|---|---|---|
| `room` | quarto, painel com a ajuda de primeiro uso; **Ir ao espelho** (cabeçalho) faz o personagem andar até o espelho | uma das 4 vistas do quarto (Q/E ou ↺ ↻; a 0 é a visão geral: guarda-roupa, personagem, espelho), sempre dentro das paredes | anda com as setas ou com o direcional na tela, relativos à câmera |
| `approach` | "Chegando ao espelho…" | começa a ir para a frente do espelho | vira de frente para o espelho |
| `tryon` | o painel do Espelho ao lado da cena (as roupas em mãos ficam nas células "Partes do look") e **Voltar ao quarto** | de frente para o espelho, personagem e vidro no quadro | parado, reage a cada troca |
| `exit` | "Saindo do espelho…" | volta à visão geral | anda (com as setas ou sozinho, depois de Voltar ao quarto) |

Regras (em `lib/room3d/mirror-session.ts`, sem React):

- **Zona com histerese**: entra a menos de 1,15 m, só sai a mais de 1,70 m, com 350 ms na entrada e 250 ms na saída.
  Parar exatamente na divisa não faz a prova piscar; voltar durante a saída retoma a prova sem reabrir do zero.
- **Ir ao espelho é andar até ele** (ver "Ir ao espelho andando"). Só sem caminhada possível (modo órbita/foto, cena
  sem avatar a tempo) a prova abre à mão (`MirrorSession.open`): fica aberta a qualquer distância até **Voltar ao
  quarto**. Fechar à mão dentro da zona não reabre sozinho: a pessoa precisa sair da zona e voltar.
- **A seleção mais recente prevalece**: cada troca recebe um número; a resposta de um pedido antigo que chega depois é
  ignorada. Uma falha mantém a roupa anterior (o espelho só muda com a resposta do servidor) e avisa sem opinar:
  "Não deu para trocar (…); a peça anterior continua."
- O estado é um só para a cena 3D (`RoomAvatarController`), o painel (`MirrorHands` + `MirrorControls`) e a página (`/room`): a cena
  atualiza a fase pela distância a cada quadro; a página faz os pedidos à API do espelho (`POST/DELETE
  /api/me/mirror/pieces`, `GET /api/me/mirror/wardrobe?slot=`) e o reflexo (Prévia 2D no vidro) e a roupa do personagem
  seguem o mesmo estado do espelho.

## Menu lateral e obstáculo

- Com a prova à vista (fase `tryon` na aba 3D, ou a vista embutida na aba 2.5D) aparece **Espelho** recuado logo abaixo de
  **Meu Quarto** no menu lateral, como sub-item (não é link; `setNavSub` em `lib/nav/active-override.ts`). "Meu Quarto"
  continua visível como pai. Trocar de aba, Voltar ao quarto ou sair da tela tira o sub-item. Não há mais item
  "Espelho" de primeiro nível no menu.
- O espelho é obstáculo com caixa orientada (vidro girado 28°, meias-medidas 0,47 × 0,08 m + raio do tronco 0,18 m):
  o personagem para na frente do vidro e contorna pela lateral, nunca atravessa. Na diagonal contra um obstáculo ele
  desliza ao longo dele; já sobreposto (porta abriu sobre ele), só aceita passos que diminuem a sobreposição.
- A zona só conta na frente do vidro: atrás do espelho a prova não abre.

## Roupas em mãos

Desde 11/10 as roupas em mãos **não têm mais lista própria** ao lado do painel (ela repetia as "Partes do look"): ficam
nas células do painel do Espelho (Parte de cima · Peça única · Parte de baixo · Calçado · Acessório) — a célula mostra
o que está vestido e conta quantas há em mãos ("2 em mãos"; a que acabou de chegar fica destacada) — e na folha de cada
parte, na seção **Roupas em mãos** (antes "Na lista do espelho"): a lista do espelho e a peça segurada ("Na mão"). Cada
peça mostra o estado do asset (selo curto na célula, por extenso na folha):

| Estado | Significado |
|---|---|
| Modelo 3D | a peça tem `model3dUrl` próprio |
| Molde 3D (aproximação) | molde paramétrico da subcategoria (`kindOf`), com a foto projetada |
| Só na prévia 2D | sem molde (acessórios): aparece só na Prévia 2D/reflexo |
| Foto em processamento | foto ainda sem a versão final |

Ações, todas na folha da parte: **Vestir** (tocar na peça em mãos), **Tirar** (Vestindo agora: sai do corpo, fica na
lista), **Tirar da lista** (embaixo da peça em mãos, ou no menu ⋯ da vestida: sai da lista e do corpo, nunca do
guarda-roupa) e trocar pelo **Do guarda-roupa** (a escolha manual que era o "Trocar"). Dentro do quarto elas passam
pelo quarto (`MirrorHost`): reação do personagem, pedido mais recente vence, "Pronto: … no espelho." no painel ao lado.

## Lista do espelho (QUARTO-ESPELHO)

O que a pessoa traz do quarto para provar fica numa **lista persistida no servidor**, separada do que está vestido. As
"roupas em mãos" mostram, em cada lugar do corpo, primeiro o vestido, depois o resto da lista e por fim a peça segurada
que ainda não entrou nela — cada peça uma vez só (`handsOf` em `lib/room3d/mirror-session.ts`).

| Estado da peça | Onde está | Como mostra | Ações |
|---|---|---|---|
| **segurada** | na mão do personagem (`RoomInteraction.held`), fora da lista | "Na mão" nas roupas em mãos da parte | Vestir |
| **na lista** (selecionada para prova) | `rack` do estado do espelho, `worn: false` | nas roupas em mãos da parte; "Já em mãos" no guarda-roupa | Vestir, Tirar da lista |
| **vestida** | `rack` com `worn: true` **e** um slot do espelho | "Vestindo agora" (card compacto) | Tirar, Tirar da lista (⋯) |
| acabou de chegar | a última levada ao espelho | célula da parte com contorno de destaque | — |

Transições:

```
segurada ──(prova abre com ela na mão: zona do espelho ou "Levar ao espelho" da etiqueta)──► na lista
na lista ──Vestir──► vestida ──Tirar──► na lista
na lista / vestida ──Remover──► fora da lista (continua no guarda-roupa)
segurada ──Vestir──► vestida (entra na lista também)
```

- **Fonte única da verdade**: o estado do espelho no servidor (`GET /api/me/mirror` → `slots` e `rack`). A tela só
  pede e mostra; o personagem do quarto, o reflexo e a tela `/mirror` leem o mesmo estado.
- **Persistência**: a lista e o vestido ficam no estado do espelho da pessoa (o mesmo JSON dos slots, `MirrorService`),
  valem entre sessões e aparelhos, com teto de 24 peças. **Limpar** e **Tirar** não esvaziam a lista; **Vista-me**
  mantém a lista e acrescenta o look sugerido. Nada aqui cria ou salva look: não existe "Salvar como look" na prova.
- **Sem duplicar**: `POST /api/me/mirror/rack {pieceId}` é idempotente (`added: false` na repetida); chegar ao espelho
  segurando a peça manda um pedido só por aproximação (sair da zona e voltar é outra) e a peça sai da mão
  (`engine.consume`).
- **Remover nunca apaga**: `DELETE /api/me/mirror/rack/{pieceId}` tira da lista e do corpo; a peça continua no
  guarda-roupa (teste Java abaixo confere o repositório).
- **A peça anterior fica até a nova estar pronta**: Vestir pré-carrega a foto (recortada → estúdio) antes do pedido; o
  avatar (`HumanOutfit`) mantém o look anterior — peças e fotos dele — até as fotos do novo ficarem prontas. Se outra
  escolha chega no meio, ela vence (número do pedido); se o pedido falha, nada muda.
- **Mesmo pipeline do provador**: a peça da lista leva foto recortada, foto de estúdio, modelagem (`variation`) e
  dimensões (`attributes`) para o 3D (`mirrorLook3d` em `lib/mirror/mirror-list.ts`), as mesmas entradas do provador —
  molde por subcategoria, classe de caimento, foto como textura.

### Provador × espelho do quarto

| | Provador 3D (`/try-on`) | Espelho do quarto (`/room`) |
|---|---|---|
| De onde vêm as peças | catálogo e guarda-roupa, escolha na tela | o que a pessoa trouxe do quarto (lista persistida) e a peça na mão |
| Lugares | 4 slots (cima, baixo, calçado, acessório) | os mesmos 4 lugares |
| Avatar | o mesmo avatar da pessoa (perfil) | o mesmo, andando no quarto; parado de frente para o espelho na prova |
| Roupa no corpo | `HumanOutfit`: molde por subcategoria, caimento por classe, foto recortada → estúdio | o mesmo componente e as mesmas entradas |
| Troca | a anterior fica até a nova carregar | igual (pré-carga + look anterior mantido) e o pedido mais recente vence |
| Persistência | estado do provador | estado do espelho (lista + vestido), entre sessões |
| Salvar look | não salva | não salva |
| Cenário | estúdio conceitual da loja | o quarto da pessoa |

### Matriz de testes

| Caso | Peças (ids reais do acervo/teste) | Onde é verificado |
|---|---|---|
| levar sem vestir, sem duplicar | `t_shirt` (camiseta) | `MirrorServiceTest.listaDoEspelhoSemDuplicarSeparadaDoQueEstaVestido` |
| vestir mantém na lista, outra vestida entra | `t_shirt` + `jeans` | idem |
| tirar e limpar não esvaziam a lista | `jeans`, `t_shirt` | idem |
| remover tira do corpo e não apaga do guarda-roupa | `t_shirt` | idem (repositório do guarda-roupa) |
| lista leva modelagem, atributos e foto de estúdio | `t_shirt` | idem; `mirror-list.test.ts` (`jeans` com `STRAIGHT`, `FULL_LENGTH`) |
| cada peça uma vez: vestida → lista → na mão | `tee` vestida, `saia` segurada e já na lista, `bolsa`, `jeans` só na mão | `mirror-session.test.ts` (lista do espelho) |
| 4 lugares, vestido/casaco em cima | `jaqueta`, `tee`, `jeans`, `tenis`, `bolsa`, `vestido` | `mirror-session.test.ts` (roupas em mãos) |
| pedido mais recente vence, falha mantém a roupa | — | `mirror-session.test.ts` (trocas) |
| camiseta vermelha/branca/preta/estampada vestem a foto, não a peça padrão | `01_parte_superior_01_camiseta_referencia` recolorida (`public/lab/cores`) | `person-filter.test.ts` + teste de cor em `docs/provador/` |
| zona com histerese, abrir/fechar à mão | — | `mirror-session.test.ts` (zona), `mirror-hands.test.tsx` |

## Reação à troca

Ao vestir, o personagem reage conforme o lugar: parte de cima abre os braços e gira o tronco; parte de baixo levanta o
joelho; calçado bate o pé; acessório inclina a cabeça (`reactionPose`). Com "reduzir movimento" a reação é a mesma, 35%
da amplitude e 320 ms em vez de 1,1 s; a câmera vai direto, sem percurso. As mensagens descrevem ("Pronto: camiseta no
espelho."), nunca avaliam a roupa.

## Ajuda de primeiro uso

"Aproxime-se do espelho para experimentar suas peças" fica no painel até a pessoa escolher **Não mostrar novamente**
(guardado por usuário no aparelho: `fai:room-mirror-help:v1:<id>`). O tutorial de comandos ilustrados continua, com o
passo "Provar a roupa" descrevendo o fluxo novo.

## Testes

- `lib/room3d/mirror-session.test.ts`: histerese e tempos nas bordas, abrir/fechar à mão com trava, pedido mais recente
  prevalece, falha mantém a roupa anterior, mapeamento dos slots e estado do asset, câmera/orientação, reação (menor
  com movimento reduzido).
- `components/room3d/mirror-hands.test.tsx`: ajuda com "Não mostrar novamente" persistida, chegando/saindo, na prova só
  Voltar ao quarto e o estado da troca (sem a lista por lugar do corpo), falha e sucesso.
- `MirrorServiceTest` (Java): lista do espelho sem duplicar, separada do vestido, persistida e sem apagar do
  guarda-roupa; `lib/mirror/mirror-list.test.ts`: a peça vai para o 3D no formato do provador.
- `lib/room3d/interaction.test.ts`: andar, pegar, carregar e soltar continuam iguais; caminhar até a frente do espelho
  (reto, pela quina, de trás do vidro) sem atravessar a colisão, seta cancela, travado desiste.

## Evidências

Capturas do fluxo com a API simulada (Chromium headless, WebGL por SwiftShader), em
`docs/evidencias/quarto-espelho-2026-10-10/`: `01-quarto-ajuda` (ajuda de primeiro uso e Abrir espelho),
`02-aproximacao`, `03-prova-roupas-em-maos` (câmera de frente para o espelho, personagem virado para ele, lista por
lugar do corpo), `04-trocar-parte-de-cima` (escolha do guarda-roupa), `05-troca-reacao` e `06-vestida` (camiseta
vestida no personagem e "Pronto: Camiseta azul no espelho."), `07-sem-tenis` (Tirar), `09-quarto-de-volta` (saiu da
zona: câmera e painel de volta ao quarto) e `10-abrir-a-mao`. O vídeo da mesma sequência (`quarto-espelho-960.webm`)
fica na pasta quando couber no repositório; o roteiro da captura é o mesmo da descrição acima.

## Aba Espelho embutida no quarto (QUARTO-ESPELHO · 10/10)

A aba **Espelho** deixa de ser uma tela separada durante a prova: ela é uma **navegação derivada do movimento** dentro
do Meu Quarto. Ao chegar ao espelho (zona acima), a coluna ao lado da cena troca a lista de posições pelas **opções de
vestimenta** da aba Espelho — o mesmo painel de `/mirror` (`components/mirror/mirror-controls.tsx`: tipo de look,
Vista-me, partes do look com "Do guarda-roupa"/"Sugerir", notas, Usar hoje/Salvar como look/Abrir no editor), em modo
compacto (sem o link para o quarto, que já é a tela atual). A página `/mirror` passa a usar o mesmo componente, então
uma correção vale nos dois lugares.

- **Foto do quarto no vidro.** Ao entrar na prova, `RoomAvatarController` tira uma foto da cena **do ponto de vista do
  espelho** (câmera no vidro olhando para o guarda-roupa, personagem oculto; `MIRROR_NORMAL` em `mirror-session.ts`) e
  guarda em `MirrorSession.snapshot`. O vidro mostra essa foto recortada ao miolo (`snapshotCrop`, sem esticar) e, por
  cima, o reflexo do avatar vestido (PNG/WebP com alfa — `AvatarStill` com fundo transparente). A foto some ao voltar
  ao quarto (pelas setas ou por "Voltar ao quarto"). Com o quarto de quatro paredes, a foto mostra as paredes leste e
  sul e o teto (antes era só névoa). Para a foto, as paredes que a câmera principal esconde aparecem inteiras por um
  instante (`userData.reveal`). A câmera da prova não mudou, só fica presa dentro do quarto.
- **Sair só com as setas.** Durante a prova as setas valem na **página inteira** (`arrowAnywhere` em
  `lib/room3d/interaction.ts`): o foco pode estar no painel ao lado e, mesmo assim, andar para fora da zona fecha a
  prova e devolve a lista de posições. Fora da prova, as setas só valem com a cena focada (evita roubar a rolagem).
  A prova aberta pelo botão "Abrir espelho" fica aberta parada em qualquer distância, mas **andar para fora da zona
  também a fecha** (`MirrorSession.update(distance, now, moving)`).
- **Tipo de look fora do ar.** Em produção o `GET /api/tipos-look` respondia 404 e o painel mostrava a caixa "Não
  encontramos esta página". Agora 404/405 viram um aviso curto (`lookType.unavailable`) e o resto do painel segue
  funcionando; outros erros continuam com "tentar de novo".
- **Layout.** `.room3d[data-mode="mirror"]` alarga a coluna lateral (360 px) no desktop; no celular o painel fica
  abaixo da cena, como o resto do quarto.

Capturas com a API simulada (Chromium headless, SwiftShader) em `docs/evidencias/quarto-espelho-2026-10-10/`: `aba-01-quarto-desktop` (lista de posições),
`aba-02-espelho-desktop` (chegou ao espelho andando: painel do espelho ao lado, foto do quarto no vidro, reflexo por
cima), `aba-03-volta-desktop` (saiu andando com as setas, foco fora da cena: lista de posições de volta),
`aba-02-espelho-mobile` e `aba-04-aba-espelho-tipos-404` (`/mirror` com o catálogo de tipos fora do ar: aviso curto, sem
"página não encontrada"). Testes: `lib/room3d/mirror-session.test.ts` (foto na sessão, recorte, sair andando),
`lib/room3d/interaction.test.ts` (setas na página inteira), `components/mirror/mirror-controls.test.tsx` (tipos 404,
Do guarda-roupa, modo compacto) e `app/room-page.test.tsx` (abrir o espelho troca a coluna; voltar devolve).

## Limites

- A cena exige WebGL; sem ele o quarto abre em 2.5D e o espelho abre **embutido** na própria aba (palco 2D + o mesmo
  painel), pela célula tracejada "Monte o look de hoje" ou pelo link `/room?espelho=1`.
- A caminhada até um ponto contorna obstáculos por desvio local (sem mapa do quarto): o espelho tem rota pelas quinas;
  uma porta aberta no caminho é contornada deslizando e, se travar, a prova abre direto (ou fecha direto, saindo).
- Os moldes 3D continuam aproximação (ver `docs/avatar3d/PIPELINE_VESTIMENTAS_3D.md`).

## Espelho como navegação derivada do Meu Quarto (11/10)

- **Rota.** `lib/nav/mirror-href.ts` → `/room?espelho=1[&vestir=<id>][&vista=2d]`. O quarto lê os parâmetros quando os
  dados chegam: vai ao espelho (`goToMirror`), leva a peça à lista do espelho e veste (`bringToMirror` + `wearInMirror`),
  abre a prévia 2D no painel; os parâmetros de uma vez só saem com `router.replace("/room?espelho=1")`. Entrar e sair do
  espelho mantém a URL em sincronia (`history.replaceState`). `/mirror` (com `?piece=`/`?vista=2d`) virou redirecionamento;
  todos os links do app e os `href` do backend (`LookbookService`, `PersonalInsights`) apontam direto para o quarto.
- **Cabeçalho.** No modo espelho: trilha "Meu Quarto › Espelho" (prop `trail` do `PageHeader`; "Meu Quarto" volta ao
  quarto), título Espelho. O botão do cabeçalho virou **Ir ao espelho**; "Espelho" no diálogo da porta virou **Levar ao
  espelho** (sem sair do quarto).
- **Painel sem formulário** (`components/mirror/mirror-controls.tsx`): "Partes do look" na grade de células do Provador
  (Parte de cima — com a camada externa do servidor dentro —, Peça única, Parte de baixo, Calçado, Acessório n de 4);
  tocar abre a folha da parte (`mirror-part-sheet.tsx`: Vestindo agora no card compacto com Tirar/Manter/⋯, Na lista do
  espelho, Do guarda-roupa, Sugestões com o porquê). "Para quem é o look" em chips; Vista-me por células de ocasião +
  humor/clima (`vista-me-cells.tsx`, também no diálogo Vista-me do quarto); peças fixadas viram `anchorIds`. Ações:
  Usar hoje, Salvar look (um toque, título do servidor, aviso com Ver look/Renomear), Abrir no editor
  (`/schemes/new?pieces=`), Provar o look no Provador, Tira uma coisa e Limpar (com desfazer), GRWM (roteiro com imagem
  e legenda), silhueta (letra + regra) e o desafio também no modo compacto. Nunca chama `/slots/{slot}/swap`.
- Evidências (API simulada, fora do repositório): `scratchpad/evidence/espelho-provador/` — `01` redirecionamento,
  `02` painel, `03`/`04` folha da parte, `05` menu, `06` Vista-me, `10` sem WebGL (desktop e celular).

## Ir ao espelho andando (11/10)

"Faça com que a aba Espelho seja integrada dentro da aba Meu Quarto, sendo uma navegação derivada dentro da
movimentação": chegar ao Espelho é **andar até ele**.

- **Motor** (`lib/room3d/interaction.ts`): `goal`/`route`, `walkTo(pontos, done)`, `cancelGoal()` e `followGoal(dt)`. O
  passo é `stepToward` — puro, com a velocidade (1,05 m/s), as paredes e as colisões das setas: reto até o ponto; bloqueado,
  desliza ao longo do obstáculo; senão contorna (desvia 45°/90°/135°, sempre para o mesmo lado até o caminho reto abrir).
  Qualquer seta ou botão do direcional cancela (a pessoa assume); sem se aproximar por 1 s parado (2 s contornando),
  desiste. `done` recebe `arrived`, `stuck` ou `cancelled`. Andar solta o puxador segurado.
- **Pontos** (`lib/room3d/mirror-session.ts`): `mirrorFront` (0,8 m pela normal do vidro: dentro do raio de entrada de
  1,15 m, fora da colisão), `mirrorRoute` (reto; ou pela quina da frente; ou, vindo de trás do vidro, pelas quinas de trás e
  da frente — só quinas dentro da área de caminhar) e `awayPoint` (2,1 m para o centro do quarto, além do raio de saída de
  1,7 m, dentro das paredes). `leave()` desfaz a abertura à mão sem trava; `unlatch()` tira a trava de um Voltar anterior.
- **Controlador**: andando = setas **ou** caminhada; sem setas, um passo de `followGoal` por quadro, virando para onde
  anda; a câmera segue como sempre; ao chegar, vira de frente para o espelho e a zona abre a prova (350 ms).
- **Página** (`goToMirror`/`leaveMirror`): com a aba 3D no modo andar e o avatar carregado, **Ir ao espelho**,
  `/room?espelho=1` (e o `/mirror` que redireciona para ele) e **Levar ao espelho** fazem o personagem andar até o
  espelho; com "reduzir movimento", ele aparece direto na frente do vidro. Cena montando ou avatar carregando: espera
  até 12 s e então anda. Sem caminhada (órbita/foto, sem cena 3D, tempo esgotado, travou no caminho): abre direto
  (`session.open()` + enquadrar o espelho). **Voltar ao quarto** e a trilha **Meu Quarto** fazem `leave()` e o personagem
  andar para longe — a zona fecha a prova; sem caminhada, `session.back`. Um aviso curto na cena, lido pelo leitor de
  tela (`aria-live`), diz "Indo ao espelho…" / "Saindo do espelho…".
- **Sem lista duplicada**: `MirrorHands` ficou com a ajuda de primeiro uso, chegando/saindo e, na prova, Voltar ao
  quarto e o estado da troca. O "Abrir espelho" saiu (o caminho é Ir ao espelho, que anda); o diálogo "Trocar" da página
  saiu (a folha da parte tem o guarda-roupa).
- Testes: `interaction.test.ts`, `mirror-session.test.ts` (frente/saída dentro/fora da zona, rota, `leave`/`unlatch`),
  `room-scene-controls.test.tsx` (direcional cancela), `mirror-controls.test.tsx` (roupas em mãos na célula e na folha),
  `app/room-page.test.tsx` (no jsdom não há cena 3D: Ir ao espelho e `?espelho=1` abrem direto; folha com Tirar da lista e
  Vestir pelo quarto; trilha e Voltar ao quarto).
- Evidências (API simulada, fora do repositório): `scratchpad/evidence/walk/`.
