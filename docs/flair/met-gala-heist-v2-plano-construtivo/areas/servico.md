# Bastidores, copa e segurança

**Zonas do blueprint:** Z09 (operações e monitoramento), Z10 (cozinha, copa e bar de serviço), Z11 (camarins, ateliê e produção) · **Salas da planta:** `bastidores`, `servico` (labirinto), `seguranca`

**Dimensões:** bastidores x 12,5 a 22, z −6 a 4 (pé-direito 4,6 m); labirinto de serviço x −22 a −12,5, z −6 a 16 (3,6 m, divisórias de 3,2 m); segurança x −22 a −18,5, z 2 a 7,5

**Arquivos da área:** `components/heist/scene/areas/bastidores.ts`, `areas/servico.ts`, `areas/seguranca.ts` (e arquivos novos `areas/servico-*.ts`)

## Como está hoje

Bastidores com penteadeiras, mesa da produção, monitores, vaporizador e manequins; labirinto com luz fluorescente fria, canos e placas; segurança com monitores, cofre e quadro de luz.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Bastidores: piso de palco preto com marcações de fita; labirinto e copa: granilite ou borracha antiderrapante com ralos, faixas de segurança; segurança: piso vinílico |
| Paredes | Bastidores: paredes pretas com cases encostados e quadro de chamada; copa: azulejo branco até o teto, cantoneiras de inox, para-choques; labirinto: drywall com marcas de carrinho, extintores, placas "SOMENTE FUNCIONÁRIOS"; segurança: painel acústico |
| Teto | Bastidores: grid com refletores; copa: forro de PVC com luminárias estanques e coifa; labirinto: forro removível com canos e calhas aparentes; segurança: forro acústico |
| Portas | Porta do palco, portas vaivém da copa com visor, porta corta-fogo, porta da segurança com leitor |
| Luz | Bastidores: lâmpadas das penteadeiras e refletores de trabalho; copa: fluorescente fria; segurança: brilho dos monitores |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Penteadeira de maquiador com gavetas e lâmpadas | Camarim (Z11) | 1,6 × 0,5 × 0,75 m + espelho | baixa (já existe como mirror/desk) | PLANEJADO |
| Arara móvel com rodízios e cabides; bancada de costura com manequim de ajuste; carrinho de acessórios | Ateliê da produção (Z11) | arara 1,6 × 0,6 × 1,8 m | baixa/alta | PLANEJADO |
| Ilha central de inox e bancada de preparo; pass-through com louças | Copa do bufê (Z10), nas pontas mortas do labirinto | ilha 2,4 × 1,0 × 0,9 m | baixa | PLANEJADO |
| Carrinho de catering, torre de copos, estação de coquetelaria e refrigeração | Serviço do bufê | carrinho 0,9 × 0,6 × 1,0 m | baixa | PLANEJADO |
| Console panorâmico de monitores e mesa de coordenação com rádios | Monitoramento (Z09) | console 3 × 0,9 m | baixa (já existe como monitor) | PLANEJADO |
| Racks ventilados com portas e painel do palco e da pista | Operação técnica (Z09) | rack 0,6 × 1,0 × 2,0 m | alta | PLANEJADO |

### Objetos de cena

Panelas, formas, cubas gastronômicas, pilhas de pratos, caixas de taças, avental pendurado, quadro de pedidos, latas de lixo com pedal; bastidores: fita gaffer, cabos, rádios, prancheta, roupas em capas; segurança: café, rádios no carregador, quadro de chaves.

### Pessoas

Equipe do bufê e chef na copa, equipe de produção nos bastidores, operador na segurança.

### Regras de jogo

**O labirinto não muda de forma**: as paredes vêm da semente e os testes exigem mais de uma rota (doca → duto, porta da equipe → segurança). Móveis com colisão só em pontas mortas e sem fechar caminho; os armários do uniforme, o cofre, o quadro de luz e a porta da segurança continuam acessíveis.

### Vistas de aceite

Bastidores da porta do lounge; uma penteadeira de perto; um corredor do labirinto ao nível dos olhos; a copa de perto; a sala de segurança; vista alta do labirinto.

## Estudo da área

### Como essas salas são de verdade

- **Circulação de serviço (back-of-house) de um prédio que recebe gala.** Corredores de 1,5 m entre divisórias de
  drywall, pintura lavável com barra mais escura até ~1,1 m (esconde a sujeira dos carrinhos), para-choque de vinil
  (bate-maca) a ~0,8 m, cantoneira de inox em toda quina saliente, rodapé de borracha, forro removível de placas de
  0,6 m em perfil T e as instalações aparentes logo abaixo dele (rede de sprinkler vermelha com luvas ranhuradas e
  tirantes, eletrocalha perfurada com cabos). Luminárias estanques (lineares, de policarbonato) célula a célula, luz de
  emergência, câmeras nas junções, extintor com a placa acima e a demarcação de piso vermelha com borda amarela,
  abrigo de hidrante, acionador manual de alarme, setas de rota de fuga e zebrado diante das portas. Piso: granilite
  cinza polido com juntas plásticas a cada 1 m (resiste a carrinho e é fácil de lavar).
- **Copa de bufê terceirizado.** O bufê traz equipamento móvel (carro-bandejeiro de inox, torre de racks de taças,
  estação de bar) e usa a cozinha de apoio do prédio (fogão com coifa, geladeira, lavagem). A montagem fica colada à
  porta do salão: o garçom sai com a bandeja e volta com a louça suja. Nas zonas molhadas: cerâmica vermelha
  antiderrapante 15 × 15 cm com rejunte escuro e ralo, azulejo branco até o forro, forro de PVC lavável, cortina de
  tiras de PVC separando a cozinha do corredor, pia de lavar as mãos com sabonete e papel-toalha, placas de touca e de
  proibido fumar. Bancadas de inox a 0,90 m; cuba gastronômica GN 1/1 de 53 × 32,5 cm.
- **Camarim e produção de desfile.** Penteadeira com lâmpadas-globo de luz quente em volta do espelho (a maquiagem
  precisa de luz sem sombra no rosto), tampo claro a 0,76 m, gavetas, cadeira alta para o maquiador trabalhar em pé;
  araras com rodízios e cabides por look, etiqueta com o nome do modelo, sapatos na prateleira de baixo; ateliê com
  máquina reta e overloque para ajuste de última hora, manequim de prova com alfinetes; vaporizador de roupa; mesa da
  produção com intercom, relógio de timecode e os monitores das câmeras do palco; quadro de chamada com o roteiro;
  cases de estrada (ATA) com rodízios; piso de palco preto em chapas parafusadas, marcas de fita (spike) e fita
  fosforescente; refletores pendurados numa grade de tubos.
- **Central de monitoramento.** Console com duas fileiras de telas na altura do olhar de quem está sentado (1,0 a
  1,9 m), joystick das câmeras (PTZ), mesa de coordenação com a base de carga dos rádios e headsets, livro de
  ocorrências, racks de 42U ventilados (switch, gravador de vídeo, nobreak), quadro de chaves, quadro de luz geral,
  piso vinílico técnico com tampas de acesso por onde sobem os cabos, forro acústico, painéis de tecido nas paredes
  (reduzem o eco dos rádios) e paredes escuras (não refletem nas telas).

### Os móveis, por que estão ali, medidas e materiais

| Móvel | Onde | Por que faz sentido ali | Medida (L × P × A) | Materiais |
| --- | --- | --- | --- | --- |
| Fogão de 6 bocas com dois fornos e coifa | ponta (1,0), parede do prédio | a única cozinha quente: encostada na parede externa, por onde sai o duto | 1,2 × 0,7 × 0,9 m; coifa 1,4 × 1,0 m a 2,05 m | inox escovado, ferro fundido preto, vidro do forno |
| Geladeira comercial de 2 portas | ponta (1,3) | refrigeração perto da cozinha e fora da rota | 1,2 × 0,8 × 2,0 m | inox, borracha de vedação, grade do compressor |
| Bancada estreita de preparo | ramal (2,1)–(2,2), parede leste | mise en place no corredor sem bloqueá-lo | 3,3 × 0,45 × 0,9 m | inox, tábuas de polietileno por cor |
| Estante de inox de 4 níveis | (0,2), parede do prédio | pratos, cubas e secos à mão da cozinha | 1,4 × 0,45 × 1,8 m | aço cromado aramado |
| Pia de lavar as mãos | (1,2) | exigência sanitária na entrada da cozinha | 0,5 × 0,42 m, a 0,86 m | inox, cromado |
| Porta da câmara fria | parede do prédio em (0,1) | a câmara fica "do outro lado" da parede externa | folha 1,08 × 2,08 m | painel isolado branco, trinco cromado, termômetro |
| Pass aquecido com os canapés | ponta (3,6), a 3 m da porta do salão | onde o garçom pega a bandeja | 1,5 × 0,7 × 0,9 m + 2 prateleiras até 1,85 m | inox, resistência âmbar, ardósia, porcelana |
| Carro-bandejeiro | (4,6) | transporte das assadeiras da doca e da cozinha | 0,6 × 0,75 × 1,72 m | inox, rodízios de borracha, filme plástico |
| Torre de racks de taças | (4,6) | taças lavadas prontas para o bar | 0,5 × 0,5 × 0,8 m | polipropileno cinza, vidro |
| Estação de coquetelaria | ponta (3,8) | o bar de serviço que abastece o salão | 1,5 × 0,65 × 0,9 m | inox, poço de gelo, garrafas fictícias, madeira |
| Lavagem (mesa de sujos, ducha, lava-louças) | ponta (3,3) | a louça volta do salão por aqui | 1,5 × 0,7 × 0,9 m; ducha até 1,9 m | inox, mola cromada, racks plásticos |
| Armários da equipe (o uniforme) | (4,3), parede leste | vestiário no caminho da equipe | 4 × 0,35 × 0,32 × 1,92 m | aço pintado, venezianas, cadeado |
| Penteadeiras (3 estações) com cadeira alta | parede leste dos bastidores | camarim: luz quente frontal | 1,5 × 0,55 × 0,76 m por estação; espelho 1,12 × 1,0 m | melamina preta, laminado branco, cromado, vidro |
| Araras de figurino (esconderijos) | bastidores | um look por cabide, perto da entrada de cena | 1,3 × 0,6 × 1,86 m | aço cromado, rodízios, tecidos, madeira dos cabides |
| Bancada de costura e manequim de prova | canto noroeste dos bastidores | ajuste de última hora | 1,7 × 0,7 × 0,76 m | madeira, aço, máquinas brancas, linhas coloridas |
| Carrinho de acessórios | ao lado da arara da entrada de cena | sapatos, chapéus e joias de cena por look | 0,9 × 0,5 × 0,9 m | aço preto, cromado, veludo |
| Cases de estrada empilhados | canto sudeste dos bastidores | o figurino chega e vai embora neles | baú 0,92 × 0,9 × 1,3 m + menores | compensado ATA, alumínio, cantoneiras de bola |
| Mesa da produção, monitores, cadeiras de diretor | parede norte dos bastidores | a produção acompanha o palco e chama as deixas | mesa 2,8 × 0,8 × 0,74 m | mesa dobrável com saia preta, monitores |
| Console de monitoramento | parede oeste da segurança | de frente para o posto do chefe Nunes (que olha para oeste) | 2,0 × 0,8 × 0,75 m + telas até 1,9 m | aço preto, laminado grafite, borda de borracha |
| Mesa de coordenação | parede sul da segurança | rádios, headsets e o livro de ocorrências | 1,6 × 0,8 × 0,75 m | idem |
| Racks ventilados | canto noroeste da segurança | gravadores das câmeras e rede | 2 × 0,6 × 1,0 × 2,0 m | aço preto, porta perfurada |

### Mudanças em relação ao plano (com o motivo)

- **Ilha central (2,4 × 1,0 m): não cabe.** Os corredores do labirinto têm 1,5 m e as pontas mortas são quadrados de
  1,5 m; uma ilha precisa de ~0,9 m livres dos dois lados (≥ 3 m). O papel da ilha (montar e conferir os pratos) ficou
  com o **pass aquecido** na ponta da copa de montagem e com a **bancada estreita de preparo** no ramal da cozinha.
- **Câmara fria** como porta isolada na parede do prédio (não há espaço atrás das divisórias para um cômodo), mais a
  geladeira comercial na ponta (1,3).
- **Forro a 3,2 m, na altura das divisórias** (o da casca ficava a 3,6 m e deixava ver o topo das paredes). A rede de
  sprinkler e a eletrocalha seguem o desenho do labirinto logo abaixo do forro.
- **Segurança:** o console foi para a parede oeste, em L com a mesa de coordenação na parede sul, e os racks ocupam o
  canto noroeste (o leste ao norte da porta é onde a folha da porta dobra quando aberta).
- **Ramal noroeste inteiro como cozinha:** é uma árvore pendurada na junção (2,3) — não leva a lugar nenhum além do
  esconderijo (0,0) —, então móveis nele não fecham rota. Nos corredores, os móveis têm no máximo 0,45 m de
  profundidade: o centro do corredor fica livre para a navegação (seguranças continuam podendo entrar).

## Implementado

Arquivos (todos em `components/heist/scene/areas/`): `servico-kit.ts` (superfícies PBR, materiais, referencial `Fr`,
leitura do labirinto `mazeInfo`, atlas de placas nos três idiomas), `servico-pecas.ts` (peças técnicas),
`servico-copa.ts` (móveis da copa), `servico.ts`, `seguranca.ts`, `bastidores-moveis.ts`, `bastidores.ts`. Planta:
seções do labirinto, da segurança e dos bastidores em `baseProps()` e `civs()` de `lib/heist/level.ts`.
Capturas em `scratchpad/gala/areas/servico/` (caminho completo no relatório).

| Item | Arquivo → função | Captura | Estado |
| --- | --- | --- | --- |
| Piso do labirinto: granilite cinza com juntas a cada 1 m, reflexo fosco no "high" | `servico-kit.ts` → `texGranilite`; `servico.ts` → `surfaces.servico` | r1-corredor | IMPLEMENTADO |
| Piso da copa: cerâmica vermelha antiderrapante 15 × 15 cm e ralos de inox | `texQuarry`; `servico.ts` (forro/cerâmica, ralos) | r1-copa, r1-cozinha | IMPLEMENTADO |
| Paredes: drywall com barra lavável e marcas de carrinho; azulejo branco até o forro nas zonas da copa | `texDrywallSrv`, `texTileWhite`; `servico.ts` (`faceZones`, `wallQuad`) | r1-corredor, r1-copa | IMPLEMENTADO |
| Para-choques (bate-maca) e cantoneiras de inox em todas as quinas | `servico-pecas.ts` → `crashRail`, `cornerGuard`; faces e quinas de `mazeInfo` | r1-corredor | IMPLEMENTADO |
| Forro removível a 3,2 m (mineral; PVC na copa), alçapão e manchas | `texCeilMineral`, `texCeilPvc`; `servico.ts` | r1-corredor | IMPLEMENTADO |
| Rede de sprinkler e eletrocalha seguindo o labirinto; luminárias estanques acesas (duas piscando), sprinklers, detectores | `servico.ts` (`mazeLinks`); `vaporTight`, `sprinkler`, `smokeDetector` | r1-corredor, r1-alto | IMPLEMENTADO |
| Extintores com placa e demarcação, hidrante, acionadores, luzes de emergência, câmeras | `extinguisher`, `hoseCabinet`, `alarmPoint`, `emergencyLight`, `cctvCam` | r1-corredor | IMPLEMENTADO |
| Sinalização (somente funcionários, rotas, zonas da copa, proibições, saída acesa) em pt/en/es | `servico-kit.ts` → `signAtlas`, `sign`, `SRV_TEXT` | várias | IMPLEMENTADO |
| Fogão de 6 bocas com fornos, panelas e coifa (filtros, duto, supressão) | `servico-copa.ts` → `range` (fixture `srvRange`) | r1-cozinha | IMPLEMENTADO |
| Geladeira comercial de 2 portas | `fridge` (`srvFridge`) | — | IMPLEMENTADO |
| Bancada de preparo, estante de inox, pia de mãos, porta da câmara fria, cortina de tiras | `prepBench`, `shelving`, `handSinkFixture`; `servico.ts` | r1-cozinha | IMPLEMENTADO |
| Pass aquecido com canapés, carro-bandejeiro, torre de racks de taças | `pass`, `cart`, `glassTower` | r1-copa | IMPLEMENTADO |
| Estação de coquetelaria (bar de serviço) | `cocktail` (`srvBar`) | — | IMPLEMENTADO |
| Lavagem com ducha de pré-enxágue e lava-louças | `dish` (`srvDish`) | — | IMPLEMENTADO |
| Armários da equipe (uniforme), quadro de avisos, relógio, quadro elétrico, caixa de ferramentas (esconderijo) | `servico.ts` | — | IMPLEMENTADO |
| Segurança: vinílico, pintura técnica, painéis acústicos, forro acústico com luminárias, câmera dome | `seguranca.ts` → `seguranca`; `texVinyl`, `texPaintSeg` | r1-seguranca | IMPLEMENTADO |
| Console de monitoramento (6 telas animadas, PTZ, teclados) | `seguranca.ts` → `monitorConsole` (props.monitor) | r1-seguranca | IMPLEMENTADO |
| Mesa de coordenação (rádios, headsets, telefone, livro), racks ventilados, café | `coordDesk`, `racks`, `cafe` (fixtures `segCoord`, `segRack`, `segCafe`) | r1-seguranca | IMPLEMENTADO |
| Cofre do cartão, quadro de luz entreaberto, quadro de chaves | `safe`, `fusePanel`; `seguranca.ts` | r1-seguranca | IMPLEMENTADO |
| Painel do palco e da pista (cenas que mudam; vermelho no alarme) | `seguranca.ts` → `showTexture` + tick | r1-seguranca | IMPLEMENTADO |
| Bastidores: piso de palco em chapas, paredes pretas, cortinas, vigas e grade de tubos com 8 refletores acesos | `bastidores.ts` → `stageLight`; `texStage`, `texWallBk` | r1-bastidores | IMPLEMENTADO |
| Penteadeiras com gavetas, lâmpadas-globo, maquiagem e cadeira alta | `bastidores-moveis.ts` → `vanity`, `vanityMirror` | r1-penteadeira | IMPLEMENTADO |
| Araras com rodízios, cabides, roupas e sapatos (esconderijos) | `garmentRack` (props.rack) | r1-bastidores | IMPLEMENTADO |
| Bancada de costura, manequins (um em prova), vaporizador, carrinho de acessórios, cases, cadeiras de diretor | `sewing`, `mannequin`, `steamer`, `accCart`, `cases`, `directorChair` | r1-bastidores | IMPLEMENTADO |
| Mesas da produção e da folha de chamada, parede de monitores, quadro de chamada, fitas, cabos, canaletas | `productionDesk`, `callDesk`, `monitorWall`; `bastidores.ts` | r1-bastidores | IMPLEMENTADO |
| Pessoas: chef no fogão; equipe do bufê no pass, no bar e na lavagem; costureira no ateliê | `lib/heist/level.ts` → `civs()` | (jogo com gente: a captura `/lab/heist?at=servico` não ficou pronta em 15 min na fila; posições conferidas em `plan-labirinto.jpg`) | IMPLEMENTADO |

### Capturas (pasta `scratchpad/gala/areas/servico/`)

| Arquivo | Vista | Qualidade | Nota |
| --- | --- | --- | --- |
| `r1-corredor.jpg` | corredor principal, altura dos olhos, da esquina sudoeste para a porta da equipe | low | VALIDADO: forro, calha, sprinkler, extintor, hidrante, zebrado, para-choques, câmera |
| `r1-copa.jpg` | copa de montagem de perto (pass, bandejeiro, azulejo, cerâmica) | low | VALIDADO |
| `r1-alto.jpg` | vista alta do labirinto (o desenho das instalações seguindo os corredores) | low | VALIDADO |
| `r1-seguranca.jpg` | sala de segurança da porta (console, painel do palco, mesa, racks, quadro de luz) | low | VALIDADO (185 draws · 338k tri, com as salas vizinhas) |
| `r1-penteadeira.jpg` | penteadeiras de perto (espelhos com lâmpadas, gaveteiros, maquiagem, cadeira alta) | low | VALIDADO (112 draws · 154k tri) |
| `r9-corredor-high.jpg` | o mesmo corredor em "high" | high | REPROVADO: estourado (bloom + sonda da sala com o forro saturado pelas luzes a 30 cm); corrigido em seguida: forro autoiluminado, luzes mais baixas e mais fracas, env menor, foco mais fechado |
| `r9-corredor-high2.jpg`, `r9-copa-high.jpg`, `r9-seguranca-high.jpg`, `r9-bastidores-high.jpg` | rodada final em "high" | high | na fila de capturas ao fim do turno (ver relatório) |
| `plan-labirinto.jpg`, `plan-bastidores.jpg` | plantas de conferência (paredes da grade, móveis, pessoas, rondas, interações) | — | geradas de `lib/heist` sem navegador |
