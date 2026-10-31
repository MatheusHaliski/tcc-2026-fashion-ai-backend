# Grande Salão: gala, pista de dança e DJ

**Zonas do blueprint:** Z04 (salão de gala), Z05 (pista e DJ), Z06 (camarotes no mezanino) · **Salas da planta:** `salao`

**Dimensões:** x −12 a 12, z −6 a 14 (24 × 20 m), pé-direito 9,5 m com cúpulas e mezanino

**Arquivos da área:** `components/heist/scene/interior-hall.ts`, `components/heist/scene/areas/salao.ts` (e arquivos novos `areas/salao-*.ts`)

## Como está hoje

Colunata coríntia, cúpulas em caixotões, mezanino com balaustrada, instalação floral central, mesas altas, palco do quarteto, passarela e telão. Falta a festa: não há DJ, pista, comida nem doces.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Granito/mármore polido com frisos e rosácea central; **pista de dança** de madeira escura com borda metálica (ou piso de LED discreto) iluminada pelos globos; tapetes sob as mesas de jantar |
| Paredes | Pedra esculpida, pilastras, boiserie com almofadas, cortinas pesadas nos arcos, arte emoldurada ficcional |
| Teto | Cúpulas existentes com medalhões; lustres **Celestial Crown** de anéis de bronze e cristal presos em suportes; **três globos espelhados** com eixo e cabo sobre a pista; treliças (truss) com moving heads e caixas de som penduradas |
| Portas | Folhas duplas altas para o vestíbulo e a galeria; porta discreta dos garçons para o serviço; porta para o lounge |
| Luz | Lustres, castiçais nas mesas, luzes da pista que mudam com a música (cores e varredura), foco no palco |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Cabine do DJ: mesa com CDJs, mixer, laptop, cases, cabos e caixas | O DJ tocando de verdade, voltado para a pista | mesa 2,4 × 0,8 × 1,1 m; line array e subwoofers | alta | PLANEJADO |
| Pista de dança com globos espelhados | Onde os convidados dançam | 8 × 6 m | sem colisão | PLANEJADO |
| Mesa de doces: bolo de vários andares, torre de macarons, éclairs, cupcakes, cloches de vidro | O pedido do usuário: mesa de doces e bolos | 4,0 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Buffet de comidas: réchauds, canapés, frios, frutas, torre de champanhe | Comida servida aos convidados | 5,0 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Mesa de patronos com marchetaria e lugares nomeados; cadeiras Gala Étoile | Jantar dos patronos (Z04) | mesa Ø 1,8 m, 8 cadeiras | baixa | PLANEJADO |
| Aparador de serviço Atelier Service em pedra e madeira | Base dos garçons | 2,4 × 0,6 × 0,95 m | baixa | PLANEJADO |
| Púlpito e palco com instalação de moda | Anúncios da gala | palco existente | baixa (já existe) | PLANEJADO |
| Camarotes no mezanino com poltronas | Vista de cima da pista (Z06) | poltronas 0,8 × 0,8 m | fora da área jogável | PLANEJADO |

### Objetos de cena

Pratos, talheres, taças de tipos diferentes, guardanapos, menus, cartões de lugar, velas, centros florais, baldes de gelo, bandejas, fones do DJ, cabos presos com fita, cases abertos, copos no chão da pista.

### Pessoas

**DJ** tocando (mãos nos pratos, fone em uma orelha, cabeça no ritmo); **10 a 16 convidados dançando** com passos variados no ritmo, sem fase idêntica e sem atravessar ninguém; convidados comendo junto à mesa de doces e ao buffet; garçons circulando com bandejas; seguranças observando.

### Regras de jogo

As portas, a colunata, o arranjo floral, as rotas dos garçons e dos seguranças, o checkpoint do salão e o pôster-pista (`posterAurora`) continuam acessíveis. Pessoas novas (DJ, dançarinos, quem come) entram no fim de `civs()` na seção do salão; móveis com colisão como `fixture`.

### Vistas de aceite

Geral da porta do vestíbulo; a pista com gente dançando (jogo com `?shot=`); a cabine do DJ de perto; a mesa de doces de perto (bolo e macarons); vista do mezanino; vista alta.

## Estudo da área

### Referências de uso real

- **Salão de castelo (pedido do usuário, Resident Evil Village):** câmera sempre dentro de um volume fechado, com teto alto e lustres de cristal em vários andares presos por correntes, piso de pedra polida com faixas escuras e uma rosácea no centro, paredes de cantaria com lambri de madeira até a altura do encosto das cadeiras (≈ 1 m), molduras de pedra acima do lambri, pilastras, cortinas pesadas de veludo com bandô e abraçadeiras. Nada de parede lisa: toda superfície tem junta, chanfro, moldura ou relevo.
- **Baile de gala em museu (Great Hall do Met, salões de baile europeus):** jantar dos patronos em mesas redondas de 8 lugares perto da música de câmara; pista e DJ separados do jantar; comida e doces junto à entrada, onde quem chega vê primeiro e a fila não atrapalha a circulação; camarotes no mezanino para olhar a pista de cima.
- **Montagem de evento com DJ:** a cabine fica numa parede curta, de frente para a pista. O tampo fica a ~1,05 m porque o DJ toca de pé. O mixer fica no centro, com um player de cada lado, e o notebook num suporte ao lado. Os cabos descem por trás e são presos no chão com fita (gaffer) para ninguém tropeçar. Há um subwoofer no chão de cada lado e uma coluna acima da altura das cabeças. Uma treliça quadrada, pendurada no teto por talhas de corrente, leva os moving heads, duas line arrays e os globos espelhados, que pin spots iluminam. Os pontinhos de luz giram no piso e no teto.
- **Pista:** um tablado de madeira escura envernizada com rampa de alumínio na borda, que evita o tropeço e marca a área. Cada pessoa dançando ocupa 1,5–2 m², então 6,6 × 6,0 m (≈ 40 m²) cabe com folga os 15 dançarinos.
- **Mesa de doces (sweet table):** toalha até o chão com saia plissada, praticáveis de mármore em alturas diferentes para dar níveis, um bolo de cinco andares como peça central, a torre de macarons em cone, cupcakes num suporte de andares, éclairs, petit fours e tortinhas sob cloches de vidro, verrines, trufas, velas em cúpulas de vidro e pratinhos de sobremesa empilhados.
- **Bufê:** réchauds (chafing dishes) com tampa de rolo e fogareiros de álcool em gel (chama azul), bandejas de canapés, uma fruteira de dois andares, uma tábua de queijos e frios e uma torre de taças de champanhe (pirâmide de coupes sobre base espelhada). Ao lado ficam o balde de gelo com as garrafas, os pratos e os guardanapos.
- **Mesa dos patronos (serviço à francesa):** redonda, Ø 1,8 m para 8 (≈ 0,7 m de borda por lugar). Cada lugar tem sousplat, prato, guardanapo dobrado, menu, talheres na ordem de uso (garfos à esquerda, facas à direita, sobremesa acima), três taças (água, tinto e branco), pratinho de pão e cartão com o nome. No centro ficam o candelabro, as rosas e as velas votivas, e um tapete redondo vai sob a mesa.
- **Aparador dos garçons:** fica junto à porta da equipe. É a base de reposição: pilhas de pratos, rack de taças, guardanapos, porta-talheres, cafeteira e balde de gelo.

### Por que cada coisa fica onde está

| Onde | O quê | Razão |
| --- | --- | --- |
| Nave leste, pista x 3,2…9,8 × z 1,5…7,5 | Pista, treliça, globos, cabine no meio da parede leste (z 4,5) e caixas dos dois lados | A parede leste é contínua entre a porta do palco (z −2) e a do lounge (z 10). O DJ fica de frente para a pista e para o salão inteiro, longe do jantar. |
| Nave oeste, x ≈ −6,7; z −3,5 / 2,0 / 7,2 | Três mesas dos patronos | Ficam perto do quarteto (música do jantar) e longe das caixas. A rota s1 passa a ≥ 1 m de cada mesa. |
| Arco sudoeste (x −10…−6, z 12,9…13,9) | Mesa de doces | Fica à esquerda de quem entra do vestíbulo, com o arco de veludo como fundo e as cortinas como moldura. |
| Arco sudeste (x 5,5…10,5, z 12,9…13,9) | Bufê | É o par simétrico do lado direito. A torre de champanhe fica na ponta, perto da porta. |
| Parede oeste junto à porta da equipe (z 11,7…13,9) | Aparador de serviço | Os garçons saem pela porta da equipe (z 10) e repõem dali os doces e o bufê. |
| Mezanino norte e sul (y 5,4) | Camarotes com poltronas | É a vista da pista de cima (Z06). Ficam fora da área jogável. |

### Materiais e medidas

- **Piso:** módulo de 2,4 m de mármore Botticino polido (placas de 1,2 m), com faixas de granito negro de 7 cm entre os módulos, filete de latão e losangos de Rosso Levanto nos cruzamentos. A rosácea é uma rosa-dos-ventos de 16 pontas em mármores (Ø 6,1 m) sob o arranjo floral. A barra grega de granito tem 0,45 m e corre a 0,58 m das paredes. O piso reflete (espelho 0,8 no "high").
- **Paredes:** cantaria de calcário em blocos de 1,2 × 0,6 m com junta chanfrada. Por cima, um lambri de nogueira de 0 a 1,06 m (rodapé de mármore, travessas, montantes, almofadas em relevo e moldura de encosto) e molduras duplas de pedra de 1,45 a 4,35 m com florão dourado. As pilastras e os arcos vêm da arquitetura do salão.
- **Cortinas:** veludo bordô em painéis de 0,92 m com pregas de 0,16 m, presos por abraçadeira dourada a 1,1 m, com borla. Em cima, um bandô de veludo de 0,44 m com dois galões e franja de borlas.
- **Lustres "Coroa Celeste":** três anéis de bronze (Ø 1,9 / 1,4 / 0,84 m) com braços em S, velas, lâmpadas e fios de cristal. Uma coroa no topo, presa por corrente à rosácea do teto.
- **Pista:** réguas de nogueira escura envernizada de 0,12 m e borda de alumínio chanfrada de 8 cm. A treliça quadrada de 0,29 m fica a 6 m de altura.
- **Cabine:** 2,4 × 0,8 m e tampo a 1,05 m. É de laca preta, com o medalhão "GL" e filetes dourados na frente e fita de LED que muda de cor na batida.
- **Caixas:** dois subwoofers de 0,66 × 0,54 × 0,72 m empilhados e uma coluna de 1 m numa haste, em tolex preto com grade perfurada.
- **Mesas de banquete:** 0,9 m de altura, linho branco e trilho de cetim champanhe com galão dourado. A mesa dos patronos tem tampo de marchetaria envernizado, pé torneado e quatro garras com esferas douradas. As cadeiras "Gala Étoile" são de madeira dourada com medalhão e assento de veludo.

## Implementado

**Arquivos (todos em `components/heist/scene/`, menos a planta):**

- `areas/salao.ts`: o módulo da área (móveis por `model`, decoração, piso e parede da casca, luzes principais).
- `areas/salao-kit.ts`: pegada e matriz dos móveis, torneados, gerador de superfícies PBR, lote por acabamento (`tinting`) e feixes de luz instanciados (`salaoBeamMaterial`, `BeamSet`).
- `areas/salao-walls.ts`: piso, paredes, cortinas, lustres, camarotes e o painel do DJ.
- `areas/salao-dj.ts`: cabine, caixas, pista, treliça, luzes, globos e o tique da música.
- `areas/salao-food.ts`: doces, bufê e aparador.
- `areas/salao-dining.ts`: mesas dos patronos.
- `interior-hall.ts`: arquitetura do salão.
- `lib/heist/level.ts`: seção do salão em `baseProps()` e `civs()`.

**Capturas:** `scratchpad/gala/areas/salao/`. As `v*-low` são da iteração; as `h*-high` são da rodada final.

| Item | Arquivo → função | Captura | Estado |
| --- | --- | --- | --- |
| Piso Botticino polido em módulos de 2,4 m: frisos de granito negro, filete de latão, losangos Rosso, reflexo | `salao-walls.ts` → `floorSurfaceSalao` / `floorMaterialSalao` (via `AREA.surfaces`) | v1, h1, h5 | VALIDADO |
| Rosácea de mármores (Ø 6,1 m), barra grega e tapetes redondos de Aubusson sob as mesas | `salao-walls.ts` → `floorInlays`, `rosetteSurface`, `meanderSurface`, `rugTexture` | h1, h5, h6 | VALIDADO |
| Cantaria de calcário, lambri de nogueira com almofadas em relevo, molduras duplas de pedra com florão | `salao-walls.ts` → `wallSurfaceSalao` / `wallMaterialSalao`, `boiserie` | h2, h5 | VALIDADO |
| Cortinas de veludo bordô com bandô, galões, franja, abraçadeiras e borlas nos arcos dos doces e do bufê | `salao-walls.ts` → `drapes`, `drapePanel` | v3, h3 | VALIDADO |
| Cortina pregueada iluminada de baixo nos quatro arcos cegos (no lugar do degradê liso) | `interior-hall.ts` → `pleatedArchGeo`, `archDrapeMaterial` | h3, h5 | VALIDADO |
| Quatro lustres "Coroa Celeste" | `salao-walls.ts` → `crownChandelier` | h1, h4 | VALIDADO |
| Camarotes: seis pares de bergères com mesinha de mármore e abajur nos mezaninos norte e sul | `salao-walls.ts` → `mezzanineBoxes` | h4 | IMPLEMENTADO |
| Painel de veludo com estrelas e o monograma atrás do DJ | `salao-walls.ts` → `djBackdrop` | v2, h2 | VALIDADO |
| Cabine do DJ: dois players, mixer, notebook no suporte, luminária, copo, celular, cabos presos com fita, case aberto, bolsa de discos, rolo de cabo, frente laqueada com medalhão e LED | `salao-dj.ts` → `djBooth` (fixture `djBooth`) | v2, h2 | VALIDADO |
| Caixas: dois subwoofers e uma coluna em cada lado; duas line arrays penduradas | `salao-dj.ts` → `djSpeaker` (fixture `djSpeaker`), `flownArray` | v2, h2, v5 | VALIDADO |
| Pista de nogueira com borda de alumínio e copos esquecidos | `salao-dj.ts` → `danceFloor` | v5, h4, h6 | VALIDADO |
| Treliça com talhas e oito moving heads (feixe e mancha no piso seguem a música); três globos com motor, cabo e pin spot; pontinhos no piso e no teto; telas e LED da cabine; luzes coloridas que pulsam a 122 bpm. O alarme apaga a festa. | `salao-dj.ts` → `trussRig`, `dressDj` (tique em `c.ticks`) | v5, h4, h6 (quadro parado) | VALIDADO |
| Mesa de doces: bolo de cinco andares, torre de macarons, cupcakes, éclairs, cloches, verrines, trufas, castiçais | `salao-food.ts` → `dessertTable` (fixture `dessertTable`) | v3, h3 | VALIDADO |
| Bufê: réchauds com tampa de rolo e fogareiros, canapés, frutas, frios, torre de champanhe de 55 taças, balde com garrafas | `salao-food.ts` → `buffetTable` (fixture `buffetTable`) | v5 | IMPLEMENTADO |
| Aparador dos garçons | `salao-food.ts` → `serviceBuffet` (fixture `serviceBuffet`) | — | IMPLEMENTADO |
| Três mesas dos patronos: marchetaria, oito cadeiras Gala Étoile, lugares completos, candelabro, rosas e votivas | `salao-dining.ts` → `patronTable` (fixture `patronTable`) | v4, h5 | VALIDADO |
| Pin spots sobre os doces e o bufê e foco na passarela | `salao.ts` → `dress` (`BeamSet`) | h3 (doces); passarela sem captura | IMPLEMENTADO |
| Desempenho: 298 → 199 chamadas do salão no "low" (689 mil triângulos); 201 chamadas e 1,16 milhão de triângulos no "high" | `salao-kit.ts` → `tinting`, `BeamSet`; instâncias em `salao-dj.ts` | contagem no jsdom | VALIDADO |
| Planta: móveis | `level.ts` → `baseProps` (seção do salão) | `world.test` | VALIDADO |
| Planta: pessoas | `level.ts` → `civs` (seção do salão) | v7, h7 | IMPLEMENTADO |

**Pendências**

- Animações de verdade para "dj", "eat" e "dance" (agente das pessoas):
  - DJ: as mãos nos pratos a ~0,5 m à frente do corpo, tampo a 1,05 m; ele fica em x 11,12, de frente para −x.
  - Ritmo: o salão exporta `BPM = 122` (`salao-dj.ts`).
  - Prato na mão de quem come.
- O salão tem 41 pessoas (antes, 35).
