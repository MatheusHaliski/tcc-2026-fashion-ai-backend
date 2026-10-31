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

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
