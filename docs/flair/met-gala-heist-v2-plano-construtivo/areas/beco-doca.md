# Beco e doca

**Zonas do blueprint:** Z12 (apoio e doca), Z15 (pátio de saída e garagem) · **Salas da planta:** `beco`, `doca` (o beiral, cornija norte, é da fachada: área da rua)

**Dimensões:** beco x 22,5 a 30, z −22 a 24,5 (rua, ao ar livre); doca x −22 a −8,5, z 16,5 a 24 (pé-direito 6 m)

**Arquivos da área:** `components/heist/scene/exterior-alley.tsx` (beco), `components/heist/scene/areas/doca.ts` (doca); arquivos novos da área em `areas/doca-*.ts` ou `exterior-alley-*.ts`

## Como está hoje

Beco com caçambas, escada de incêndio e o carro da fuga; doca com caixas do bufê e piso de concreto. Pouca sujeira, pouca tubulação, pouca história.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Beco: asfalto rachado e remendado, poças com brilho de óleo, grelha de drenagem, sujeira acumulada no pé das paredes. Doca: concreto polido com juntas de dilatação, faixas amarelas e pretas, manchas de pneu, marcações de vaga e de corredor de empilhadeira |
| Paredes | Beco: tijolo aparente velho com pichações fictícias, reboco descascado, canos de descida, caixas de ar-condicionado, medidores, fiação. Doca: bloco de concreto pintado até 1,2 m, para-choques de borracha nas quinas, quadros de aviso e escala |
| Teto | Doca: estrutura metálica aparente, calhas de cabos, luminárias industriais, sprinklers e tubulação pintada |
| Portas | Porta de enrolar da doca, porta de aço de serviço com barra antipânico e placa, porta corta-fogo |
| Luz | Beco: luminária de vapor de sódio na parede, luz de segurança com sensor, a luz da rua no fim do beco. Doca: luminárias industriais de LED, luz de emergência |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Flight cases, estantes e carrinhos da produção | Equipamento do evento chegando pela doca | case 1,2 × 0,6 × 0,8 m com rodízios e fechos | alta/baixa | PLANEJADO |
| Quadro de escalas, cabides, paletes e bancada de conferência | Onde a equipe confere a carga | bancada 2,0 × 0,8 × 0,9 m | baixa | PLANEJADO |
| Paleteira manual e empilhadeira estacionada | Movimento de carga | paleteira 1,6 × 0,55 m | baixa | PLANEJADO |
| Guarita de acesso da doca | Controle de quem entra pelos fundos | 1,6 × 1,6 × 2,6 m | alta | PLANEJADO |
| Caçambas, contêineres de lixo e gaiola de gás (beco) | Fundo de prédio de verdade | caçamba 2,0 × 1,2 × 1,3 m | alta (já existe) | PLANEJADO |
| Totem de saída com identidade gráfica | Orienta a saída de funcionários | 0,5 × 0,3 × 2,0 m | baixa | PLANEJADO |

### Objetos de cena

Sacos de lixo, caixas de papelão desmontadas, paletes encostados, cones, extintores, bebedouro, relógio de ponto, jaleco pendurado, rádio, prancheta, latas de tinta, rolos de fita, carrinho de lixo.

### Pessoas

Equipe do bufê descarregando, segurança da doca, motorista do caminhão.

### Regras de jogo

A rampa da doca, o portão com interfone, a porta da equipe e o teclado do labirinto continuam acessíveis; a escada de incêndio continua escalável nos pontos marcados. Móveis novos com colisão entram como `fixture`.

### Vistas de aceite

Beco do fim da rua até a escada; escada de incêndio de baixo; doca da rampa; bancada de conferência de perto; vista alta da doca.

## Estudo da área

Referências de uso real (sem copiar nenhuma): becos de serviço do centro de São Paulo e ruas de serviço de Nova York
(fundos de restaurante, garagem e prédio de apartamentos de tijolo), docas de museus (recebimento de obras em caixa de
transporte), docas de casas de eventos (montagem da produção) e o recebimento de cozinha de bufê. A regra que vale para as
duas áreas: tudo que está ali tem dono e motivo (o museu, o restaurante vizinho, a produção da gala, o bufê) e mostra uso
(sujeira, desgaste, remendo, etiqueta escrita à mão).

### Z15 — beco (pátio de saída)

| Peça | Por que está ali | Medidas e materiais |
| --- | --- | --- |
| Caçamba metálica de carga frontal (as duas da planta) | Coleta comercial do museu e do restaurante; fica encostada na parede para o beco manter ~3 m livres para o caminhão de coleta e para o carro | 1,6 × 2,4 × 1,3 m; aço pintado com nervuras, frente inclinada, tampas de polietileno (uma aberta, sacos aparecendo), bolsos de içamento, dreno, rodízios, etiqueta da coleta |
| Abrigo de GLP do restaurante | Cozinha comercial usa botijões P45 num abrigo ventilado fora do prédio, longe de portas e janelas, com placa de perigo e extintor perto; o cano de gás é amarelo | 2,0 × 1,15 × 1,9 m; base de concreto, quadro de cantoneira galvanizada, tela soldada, porta com cadeado, telhadinho de chapa; quatro P45 (Ø 0,375 × 1,3 m) ligados ao coletor de cobre |
| Tambor de óleo usado | A cozinha guarda o óleo de fritura para a coleta de reciclagem, junto da porta | 200 L (Ø 0,58 × 0,88 m), aço azul desbotado com os aros, funil e escorrido |
| Contêineres de 240 L | Lixo comum e orgânico do restaurante, levados até a rua no dia da coleta | 0,58 × 0,73 × 1,07 m; polietileno verde e cinza, rodas e alça, tampa com dobradiça (uma entreaberta) |
| Sacos de lixo, caixote, papelão em fardo, paletes | O que sobra das entregas do evento e do restaurante; o papelão é desmontado e amarrado para os catadores | sacos pretos e brancos amassados; fardo de 1,0 × 0,7 × 0,9 m com fitas; paletes PBR de 1,2 × 1,0 × 0,144 m (seis empilhados, dois encostados) |
| Condensadora no chão com gaiola antifurto | No Brasil a condensadora do térreo ganha gaiola (o cobre é roubado); tubos isolados entrando na parede | 1,2 × 0,5 × 0,8 m sobre base de concreto; gaiola de barras com cadeado; hélice girando |
| Colchão velho, cadeira quebrada, balde | O "depósito" informal do fundo do beco, junto à cerca | colchão 1,85 × 0,9 m manchado; cadeira de escritório tombada |
| Coleta seletiva do museu | O museu separa o lixo (cores da coleta seletiva: azul papel, vermelho plástico, verde vidro, amarelo metal) | quatro cestos de 50 L num suporte de tubo galvanizado com a placa |
| Totem de embarque da Gala Lumière | Em evento grande a produção marca o ponto de embarque dos motoristas credenciados e a saída de funcionários; explica o carro da fuga parado ali sem chamar atenção | 0,5 × 0,3 × 2,0 m; corpo preto com filetes dourados, duas faces impressas com luz por dentro, base com lastro |
| Prédio vizinho de tijolo aparente | Térreo comercial (cozinha do restaurante, garagem, saída de emergência) e quatro andares de apartamentos: é o "outro lado" do beco | tijolo velho de 22 × 6,3 cm em fiadas de 7,5 cm, juntas gastas, tijolos trocados; barrado de cimento; vigas de concreto pintadas por andar; janelas recuadas 13 cm com peitoril, verga e caixilho de ferro; aparelhos de ar e condensadoras em mãos-francesas; duas escadas de incêndio; quatro canos de descida; exaustor da cozinha subindo a fachada; fiação presa na parede |
| Luz | O museu ilumina o beco com vapor de sódio (laranja); o vizinho tem um refletor de LED com sensor sobre a porta da cozinha (acende quando alguém chega), a luminária velha de vapor de mercúrio da saída de emergência (pisca) e a tartaruga do fundo | luzes de verdade só nas luminárias do museu (ALLEY_LAMPS, o grupo de luzes da rua escolhe as mais próximas); as do vizinho são emissivo, halo e poça de luz pintada |
| Chão | Asfalto antigo de beco: oxidado, trincado, com couro de jacaré e trincas seladas com piche; remendos de vala e em volta do bueiro; canaleta central de concreto em V com grelhas; poças onde a água para (grelhas, bicas, sob o carro) com película de óleo; sujeira, folhas e mato no pé das paredes; bitucas onde a cozinha fuma e na boca do beco | textura de 4 m (agregado, trincas, piche), canaleta de 0,5 m com 3,5 cm de fundo, grelhas de 0,5 × 0,9 m, tampa de bueiro de Ø 0,66 m |

### Z12 — doca (apoio e doca)

| Peça | Por que está ali | Medidas e materiais |
| --- | --- | --- |
| Estantes de aço (duas) | Material da produção e do bufê que fica na doca durante o evento | 2,0 × 0,6 × 2,4 m; montantes em cantoneira azul-aço, seis bandejas com aba, contraventamento em X, sapatas; carga variada (caixas de papelão e do bufê, organizadores, fitas, carretéis de cabo, latas, toalhas, cubas) e a placa de carga máxima |
| Bancada de conferência | O recebimento confere a nota fiscal com a carga antes de liberar a entrada | 2,0 × 0,8 × 0,9 m; quadro de tubo, tampo de madeira com cantoneira, prateleira de baixo; prancheta com a lista, notebook, impressora de etiquetas, rádio, estilete, fita, café |
| Quadro de escalas e cabideiro | A escala da noite (Gil no portão, Sônia na ronda, Dorival na portaria, Márcia e Tião do bufê), as entregas e a troca de turno das 23:10 — a mesma da folha de chamada dos bastidores; os coletes e jaquetas de quem trabalha ali | quadro branco de 1,5 × 0,95 m com moldura de alumínio e bandeja de canetas; tábua com ganchos, coletes refletivos, jaqueta da segurança, avental do bufê, capacete |
| Guarita de controle de acesso | Portaria dos fundos: motoristas e fornecedores se identificam antes do portão | 1,6 × 1,6 × 2,6 m; chapa embaixo e vidro em cima, porta lateral, passa-documentos com balcão, telhado com o letreiro; mesa, monitor das câmeras (troca de imagem), livro de registro, rádio, cadeira, ventilador, luz de teto |
| Flight cases | A produção (luz e figurino do desfile) chega em cases com rodízios | 1,2 × 0,6 × 0,8 m + rodízios de 0,15 m; compensado laminado preto, perfis de alumínio nas 12 arestas, cantos de esfera, fechos borboleta, alças embutidas, estêncil e fita gaffer escrita à mão |
| Paleteira manual com palete carregado | Move a carga do caminhão até a doca | garfos de 1,15 m, corpo com bomba hidráulica, timão; palete PBR com fardos de água e caixas do bufê envoltos em filme stretch |
| Empilhadeira patolada elétrica (a "empilhadeira estacionada" do plano) | Doca pequena de museu e de casa de eventos usa a patolada (operador a pé), não a empilhadeira a combustão: sobe a carga do palete para a estante e cabe entre a rampa e a parede; fica estacionada com os garfos no chão, carregando a bateria na tomada da parede | 1,7 × 0,74 m, torre de 2,0 m; chassi amarelo com tampa preta, timão em pé, torre de dois estágios com cilindro, correntes e tela de proteção, garfos sobre as patolas, roletes, plaqueta de capacidade (1.200 kg), tomada industrial azul com o cabo |
| Carros térmicos do bufê | Levam a comida quente/fria da cozinha central até a copa sem perder temperatura | 0,48 × 0,66 × 1,45 m de polietileno isolado, porta com fechos e termômetro, sobre carrinho de rodízios; bandejas brancas em cima |
| Bebedouro de pressão | Água para quem trabalha na carga | coluna de inox de 0,34 × 0,34 × 0,9 m com cuba, duas torneiras, botões e grade; dispensador de copos ao lado |
| Paletes vazios e cones | Esperando a coleta; cones guardados em cima | sete paletes (1,0 m) e três cones de 0,62 m |
| Caixa de obra (a caixa alta da planta) | O museu recebe e devolve obras em caixa de transporte; esta é do Instituto do Traje | compensado com sarrafos, patins, parafusos, estêncil "MUSEU VESPER · INSTITUTO DO TRAJE · FRÁGIL", indicadores de inclinação e de umidade |
| Relógio de ponto, mural de avisos, mapa de rota de fuga | Toda área de funcionários tem: ponto eletrônico com porta-cartões, mural (CIPA, ramais, avisos) e o mapa de fuga perto da saída (o mapa desenha a planta real do museu do jogo) | parede leste, perto da porta lateral |
| Segurança do trabalho | Extintores de pó e de CO₂ com o topo a 1,6 m, placa vermelha e o quadrado vermelho de borda amarela no piso (NR-23 e instruções do Corpo de Bombeiros); placas de EPI, proibido fumar, empilhadeira, velocidade de 5 km/h; "não obstruir" diante das portas e do quadro de força; corredor de pedestres pintado; cantoneiras zebradas e bate-carrinho de borracha | — |
| Construção | Doca de verdade: concreto polido com juntas serradas a cada 3 m, marcas de borracha e óleo; bloco de concreto pintado (barrado grafite até 1,2 m com filete amarelo, cinza-claro em cima); estrutura metálica aparente (vigas I) com telha de aço trapezoidal; eletrocalha, sprinklers e luminárias industriais de LED a 4,6 m; porta de enrolar com guias, caixa do rolo, motor, corrente de manobra e botoeira | pé-direito de 6 m |

Pessoas: Márcia (bufê) confere a carga na bancada com o motorista do caminhão, que assina no tablet; Tião (bufê) acerta os
carros térmicos; Dorival (portaria) fica ao lado da guarita com a lanterna. Gil e Sônia (seguranças da planta) continuam
no portão e na ronda; os civis ficam fora do circuito dela.

## Implementado

Capturas em `scratchpad/gala/areas/beco-doca/` (b = beco no laboratório da rua, d = doca no laboratório das salas; `-low`
para iterar, `-high` a rodada final). Estados: VALIDADO = construído e conferido na captura; IMPLEMENTADO = construído e
testado, sem captura de perto.

**Arquivos da área** (novos ou reescritos):

| Arquivo | O que tem |
| --- | --- |
| `components/heist/scene/exterior-alley.tsx` | `HeistAlley` (monta o beco em lotes por material, decalques, instâncias e animações), `museumEscape`, `museumFixtures` + `ALLEY_LAMPS`, `neighborLights`, `fence`, `Steam` |
| `components/heist/scene/exterior-alley-facade.ts` | `neighborFacade`: o prédio vizinho inteiro (lado leste do beco) |
| `components/heist/scene/exterior-alley-ground.ts` | `alleyGround`: o chão do beco |
| `components/heist/scene/exterior-alley-props.ts` | `buildFixture` (móveis próprios `beco*`) e `dumpster` (as duas caçambas da planta) |
| `components/heist/scene/exterior-alley-tex.ts` | texturas procedurais: asfalto, remendo, concreto, tijolo, concreto pintado; folhas de decalques da parede e do chão, poças, janelas acesas, placas; tela, grelha, solda, bituca, mato, tampa de bueiro, madeira, papelão, tecido, brilho |
| `components/heist/scene/exterior-alley-mats.ts`, `exterior-alley-geo.ts` | materiais da área e o `Bag` (lotes por material com cor por vértice e UV em metros) |
| `components/heist/scene/areas/doca.ts` | módulo `AREA`: casca própria (piso, parede, telha), `ceiling`, `gate`, `walls`, `extinguisher`, `exhaust`, `floorMarks`, âncoras de luz e as luzes-chave |
| `components/heist/scene/areas/doca-props.ts` | `docaFixture` (móveis próprios `doca*`) e `artCrate` (a caixa alta da planta) |
| `components/heist/scene/areas/doca-tex.ts` | `floorSurface`, `wallSurface`, `deckSurface`, `laminateSurface` e a folha `docaAtlas` (placas, quadro de escalas, mural, mapa de fuga, etiquetas, estênceis, marcas de piso) |
| `lib/heist/level.ts` | seções beco e doca de `baseProps()` e doca de `civs()` |

### Z15 — beco

| Item | Arquivo e função | Captura | Estado |
| --- | --- | --- | --- |
| Chão: asfalto trincado (couro de jacaré, trincas seladas com piche), remendos, canaleta em V com quatro grelhas, bueiro com vapor, tampas da caixa de gordura e do hidrômetro, poças com película de óleo, sujeira e folhas no pé das paredes, panfletos, bitucas e mato | `alleyGround`; `alleyAsphalt`, `alleyPatch`, `groundDecals`, `puddleAtlas`, `buttTex`, `weedTex`, `manholeTex` | b1, b2 | VALIDADO |
| Prédio vizinho: tijolo velho (segundo UV para pichações fictícias, reboco descascado e manchas), barrado de cimento, vigas por andar, janelas recuadas com caixilho e interior aceso, porta da cozinha, garagem de enrolar, saída de emergência, janelinhas com grade, ar-condicionado e condensadoras em mãos-francesas, duas escadas de incêndio, canos de descida, exaustor da cozinha até a platibanda, medidores e fiação | `neighborFacade`, `wallDecals`, `windowInteriors`, `alleyBrick`, `alleyPaintedConcrete` | b1, b2 | VALIDADO |
| Escada de incêndio do museu: três balcões de grade, lances alternados, lances de baixo recolhidos (a colisão), escada de mão de `fireUp` | `museumEscape` | b3 | IMPLEMENTADO |
| Luz: quatro luminárias de vapor de sódio em braço curvo (luz de verdade pelo grupo da rua, `ALLEY_LAMPS`), refletor com sensor sobre a porta da cozinha (acende com a câmera a 6,5 m e fica 12 s), luminária de mercúrio que pisca na saída de emergência, tartaruga no fundo; câmera de segurança e placas | `museumFixtures`, `neighborLights`, `HeistAlley` | b1, b2 | VALIDADO |
| Caçambas (as duas da planta): nervuras, frente inclinada, tampas (uma aberta com sacos), bolsos de içamento, rodízios, dreno, etiqueta | `dumpster` | b1, b2 | VALIDADO |
| Abrigo de GLP com quatro P45, coletor e cano amarelo | `gasCage` (`becoGasCage`) | b2 | IMPLEMENTADO |
| Tambor de óleo usado com funil e balde | `drum` (`becoDrum`) | b2 | IMPLEMENTADO |
| Contêineres de 240 L (o carrinho de lixo do restaurante) | `bins` (`becoBins`) | b2 | IMPLEMENTADO |
| Sacos de lixo e caixote | `trashPile` (`becoTrashPile`) | b2 | IMPLEMENTADO |
| Papelão em fardo e caixas desmontadas | `cardboard` (`becoCardboard`) | b3 | IMPLEMENTADO |
| Paletes empilhados e encostados | `pallets` (`becoPallets`) | b3 | IMPLEMENTADO |
| Condensadora na gaiola antifurto (hélice girando) | `condenser` (`becoCondenser`) | b3 | IMPLEMENTADO |
| Colchão velho, cadeira quebrada e balde | `junk` (`becoJunk`) | b3 | IMPLEMENTADO |
| Coleta seletiva do museu | `recycling` (`becoRecycling`) | b2 | IMPLEMENTADO |
| Totem de embarque da Gala Lumière (aceso) | `totem` (`becoTotem`) | b2 | IMPLEMENTADO |
| Cerca do fundo: tela, mourões, portão com corrente e cadeado, arame farpado, placa | `fence` | b3 | IMPLEMENTADO |
| Vapor do bueiro e do exaustor da cozinha | `Steam` | b2 | IMPLEMENTADO |

### Z12 — doca

| Item | Arquivo e função | Captura | Estado |
| --- | --- | --- | --- |
| Piso: concreto polido com juntas serradas a cada 3 m, desgaste, marcas de pneu e de óleo; zebrado na boca do portão, "não obstruir" diante das portas e do quadro de força, corredor de pedestres com setas e letreiro, vagas de palete | `floorSurface`, `floorMarks` | d1, d5 | VALIDADO |
| Paredes: bloco pintado com barrado grafite de 1,2 m e filete amarelo, raspões de carrinho, retoques e escorridos; cantoneiras zebradas e bate-carrinho de borracha; placas (EPI, proibido fumar, empilhadeira, 5 km/h, motoristas, somente funcionários, saída) e luzes de emergência | `wallSurface`, `walls` | d1, d5 | VALIDADO |
| Teto: telha trapezoidal, vigas I com enrijecedores e mãos-francesas, eletrocalha com cabos e tirantes, eletrodutos, sprinklers (tubos vermelhos e bicos), detectores de fumaça, seis luminárias de LED com aletas (uma com defeito) | `ceiling`, `deckSurface` | d1 | VALIDADO |
| Portão de enrolar por dentro: guias, capô do rolo, motor, corrente de manobra, botoeira, placas, para-choques, a cortina que sobe com `dockGate` e a luz da rua vazando por baixo | `gate` | d1, d2 | IMPLEMENTADO |
| Estantes de aço (duas) com a carga da produção e a placa de carga máxima | `shelf` (`docaShelf`) | d1 | VALIDADO |
| Bancada de conferência, quadro de escalas e cabideiro | `bench` (`docaBench`) | d1, d3 | VALIDADO |
| Guarita de controle de acesso (monitor das câmeras trocando de imagem) | `booth` (`docaBooth`) | d5 | VALIDADO |
| Flight cases empilhados | `flightStack` (`docaFlightCases`) | d1 | VALIDADO |
| Paleteira com palete carregado e filme | `palletJack` (`docaPalletJack`) | d4 | IMPLEMENTADO |
| Empilhadeira patolada carregando a bateria | `stacker` (`docaStacker`) | d4 | IMPLEMENTADO |
| Carros térmicos do bufê | `hotBoxes` (`docaHotBoxes`) | d4 | IMPLEMENTADO |
| Bebedouro de inox e o dispensador de copos | `fountain` (`docaFountain`), `walls` | d3 | IMPLEMENTADO |
| Paletes vazios e cones | `palletStack` (`docaPallets`) | d5 | VALIDADO |
| Caixa de obra do museu (tampa aparafusada com o envelope da nota) | `artCrate` | d1 | VALIDADO |
| Relógio de ponto, mural de avisos, porta-cartões, mapa de rota de fuga, extintores (placa e quadrado no piso), quadro de força, exaustor girando, vassoura e pá, carrinho de mão | `walls`, `extinguisher`, `exhaust` | d1, d5 | VALIDADO |
| Pessoas: Márcia e o motorista na bancada, Tião nos carros térmicos, Dorival na guarita | `civs()` (level.ts) | d6 | IMPLEMENTADO |

### Planta (lib/heist/level.ts)

- **beco** (`FB`, móveis `fixture` com `model`): `becoTotem` x 28,75–29,25 z 22,6–22,9 (alto); `becoGasCage` x 28,85–30
  z 20,4–22,4 (vidro, gira −90°); `becoDrum` círculo (29,55; 19,6) r 0,3; `becoBins` x 29,15–30 z 11,6–13,7;
  `becoTrashPile` x 28,55–30 z −1,45–−0,35; `becoCardboard` x 29,2–30 z −7,9–−6,5; `becoPallets` x 28,95–30 z −10,4–−8,6;
  `becoCondenser` x 29,15–30 z −15,2–−13,6; `becoJunk` x 28,9–30 z −21,6–−19,4 (todos baixos, junto ao vizinho);
  `becoRecycling` x 22,5–23,15 z 18,6–20,6 (baixo, na parede do museu). Caçambas, escada de incêndio e carro da fuga
  ficaram onde estavam; a ronda (x 25–27), as escaladas e a saída `carEast` continuam livres.
- **doca** (`FD`): `docaShelf` x −17,2–−15,2 e −15–−13, z 16,55–17,15 (altas); `docaBench` x −12,6–−10,6 z 16,55–17,35;
  `docaFountain` x −8,95–−8,55 z 16,95–17,35; `docaBooth` x −22–−20,4 z 19,6–21,2 (alta, de frente para a doca);
  `docaPallets` x −21,95–−20,75 z 16,6–17,6; `docaFlightCases` x −13–−11,8 z 20–20,6 (alta); `docaPalletJack`
  x −14,4–−12,75 z 23–24; `docaStacker` x −16,3–−14,6 z 23,26–24; `docaHotBoxes` x −9,55–−8,55 z 23,25–23,95 (alta).
  A `crate` alta (x −11–−9,6 z 22,6–23,8) virou a caixa de obra; as outras três caixas da planta antiga (duas altas e
  uma baixa) saíram: a cobertura do meio agora são os flight cases e a carga está nas estantes, na bancada e no palete.
- **pessoas da doca** (`civs()`): bufê (Márcia) em (−11,6; 17,85) conferindo na bancada; motorista em (−12,35; 17,9)
  com o tablet; bufê (Tião) em (−9,05; 22,85) nos carros térmicos; portaria (Dorival, `crew`/`guard` com lanterna) em
  (−20,05; 21,6) ao lado da guarita. Fora do circuito da Sônia e do posto do Gil. (Antes havia um só civil do bufê, em
  (−13,4; 19,4), no meio do corredor.)

### Mudanças no plano

- A "empilhadeira estacionada" é uma **empilhadeira patolada elétrica** (operador a pé): é a que uma doca pequena usa e
  cabe junto à parede sem fechar a rampa nem a arara `rack-d1`.
- O **totem de saída** ficou na boca do beco (é o ponto de embarque dos motoristas e a saída de funcionários).
- O "carrinho de lixo" do beco são os contêineres de 240 L com rodas; na doca há o carrinho de mão entre a estante e a
  bancada.

### Pendências e pedidos a outras áreas

- **Rua**: o volume do prédio vizinho na cidade (exterior-blocks) continua atrás da fachada do beco, que fica 7 cm à
  frente dele; as poças de luz das `ALLEY_LAMPS` são desenhadas pelo grupo de luzes da rua (exterior-fx), em x + 1,4.
- **Vestíbulo/portas**: as folhas das portas da doca são da área das portas; o portão de enrolar por fora é da fachada
  (exterior-facade) e a cortina de dentro (doca.ts) repete a mesma conta de abertura.
- O refletor com sensor do vizinho acende pela posição da câmera (que acompanha a jogadora), não pela simulação.
