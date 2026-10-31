# Instituto do Traje e Sala das Joias

**Zonas do blueprint:** Z07 (galeria de moda), Z08 (conservação, guarda e acervo) · **Salas da planta:** `galeria`, `cofre`

**Dimensões:** galeria x −12 a 12, z −22 a −6,5 (24 × 15,5 m), pé-direito 5,5 m; Sala das Joias x −22 a −12,5, z −22 a −6,5, pé-direito 5,2 m

**Arquivos da área:** `components/heist/scene/areas/galeria.ts`, `components/heist/scene/areas/cofre.ts` (e arquivos novos `areas/galeria-*.ts`)

## Como está hoje

Galeria como corredor de museu à noite (arcadas, mezanino, caixotões, vitrines com manequins, estátuas). Sala das Joias com veludo, latão, câmeras, lasers e o pedestal do diamante.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Galeria: parquet de carvalho em espinha de peixe ou mármore claro com rodapé escuro; Sala das Joias: mármore preto polido com rosácea de latão |
| Paredes | Galeria: paredes de cor profunda por seção da exposição, textos de parede, molduras; Sala das Joias: damasco ameixa, lambri, nichos de vitrine embutidos |
| Teto | Galeria: caixotões com trilhos de luz e spots; Sala das Joias: teto escuro com spots precisos e câmeras |
| Portas | Vão aberto para o salão; porta blindada da Sala das Joias (desenhada pela área do vestíbulo); porta para o terraço |
| Luz | Spots de museu em cada vitrine, luz baixa de ambiente, luz de segurança; na Sala das Joias, foco duro no pedestal |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Vitrines com manequins individuais e vestidos-escultura | A exposição do Instituto do Traje | vitrine 2 × 2 × 2,4 m | vidro (já existe) | VALIDADO |
| Vitrine circular de joia com vidro espesso | Peça central de joalheria | Ø 1,0 × 1,8 m | vidro | IMPLEMENTADO |
| Banco escultural de galeria | Pausa para olhar | 2,4 × 0,5 × 0,45 m (feito no vão da planta: 4,0 × 0,6 m) | baixa (já existe) | VALIDADO |
| Mesa de croquis e amostras têxteis | Processo criativo exposto | 2,0 × 0,9 × 0,9 m | baixa | VALIDADO |
| Mesa de restauração com suportes acolchoados (Sala das Joias) | Conservação do acervo (Z08) | 1,8 × 0,9 × 0,9 m | baixa | VALIDADO |
| Gaveteiro horizontal, estação fotográfica e carrinho de acervo | Guarda e documentação (Z08) | gaveteiro 1,5 × 1,0 × 1,0 m | baixa | VALIDADO |

### Objetos de cena

Etiquetas das peças, textos de parede, cordões de distância, sensores, catálogos, luvas brancas, lupas, réguas, câmeras no teto, placas de saída.

### Pessoas

Convidados olhando as vitrines, curadora circulando, seguranças da Sala das Joias.

### Regras de jogo

A porta da Sala das Joias, o pedestal, os lasers, o duto e as vitrines com joias continuam onde estão (furto e cena do diamante dependem deles). Colisão nova como `fixture`.

### Vistas de aceite

Galeria do vão do salão; vitrine de perto (vidro, manequim e etiqueta); Sala das Joias da porta; pedestal de perto; vista alta.

## Estudo da área

Referência de linguagem: os salões fechados e altos de *Resident Evil Village* (teto trabalhado, parede em camadas, piso
de pedra com desenho, luz de fonte visível). Referência de uso: um museu de arte do século XIX que recebe uma exposição
de moda (o Instituto do Traje monta a cenografia por cima da arquitetura do museu) e, ao lado, a sala-tesouro onde ficam
as joias emprestadas, com o canto do conservador que recebe cada empréstimo. Nada é copiado do jogo; nomes, peças e
textos são ficcionais (Casa Orvalho, Museu Vesper, exposição "Aurora · a arte do vestido").

### Instituto do Traje (Z07, galeria de moda)

| Elemento | Por que está ali (uso real) | Medidas e materiais |
| --- | --- | --- |
| Piso | Galerias de moda usam madeira (abafa o passo, aquece o ambiente) com acabamento acetinado: refletir menos que o salão para não duplicar os spots no vidro das vitrines. A faixa de pedra junto às paredes protege a borda na limpeza e marca o limite do piso de madeira | Parquet de carvalho defumado em espinha de peixe a 45° (tábuas de 9 × 54 cm, juntas de 1,5 mm, chanfro); faixa de 40 cm de granito preto São Gabriel com filete de latão; soleiras de granito |
| Paredes | Exposições de moda revestem a parede por seção com cor profunda: o tecido claro salta e a luz que sobra some. O revestimento é de tecido pintado sobre painel (troca a cada mostra); a arquitetura do museu (pilastras, cornija) fica em tom de pedra | Rodapé de granito de 22 cm; tecido pintado ameixa (III Joias), azul-noite (II Aurora) e verde-garrafa (I Ateliê); pilastras caneladas de gesso (0,5 m); trilho de quadros de latão a 4,3 m (o museu não fura parede, pendura por cabo); friso escuro com a inscrição dourada; cornija de gesso de 34 cm |
| Teto | Caixotões de gesso do prédio antigo com lanternim de vidro fosco no centro (a luz natural filtrada dos museus do século XIX; à noite, lâmpadas por cima). Iluminação de museu é de spots em trilho eletrificado, facho estreito, filtro UV, 50–150 lux para têxtil | Vigas de 36 × 40 cm com degrau e cordão dourado, bossas, molduras em degrau, rosetas, difusores de climatização e detectores de fumaça; trilhos pretos sob as vigas leste-oeste com 26 spots (adaptador, garfo, corpo com aletas, lente) mirando cada peça; luz de sanca escondida na cornija |
| Nicho do Aurora | Peça principal no eixo da entrada, com o fundo em contraluz (amanhecer = "Aurora") | Arco de gesso de 2,9 m de vão e 30 cm de fundo, impostas, fecho, degrau de granito, fundo em degradê laranja-rosa-violeta aceso |
| Vitrines de piso | O padrão de museu: base alta (deck a 40–60 cm deixa a barra do vestido na altura do olhar), vidro laminado de 19 mm colado sem moldura (arestas polidas, esverdeadas), caixa de luz em cima com fibra óptica (luz sem calor dentro), grelha de ventilação (controle de umidade), fechadura de cilindro e sensor de vibração | 2 × 2 × 2,74 m (Aurora) e 1,8 × 1,8 m (alas); base laqueada de 42 cm com rodapé recuado e filete de latão; estrado redondo forrado na cor da seção; etiqueta de museu no plinto |
| Manequins e vestidos | Museus de moda usam manequim de cabeça abstrata; o vestido precisa de volume, frente e verso | Manequim marfim fosco com cabeça em ovo, ombros e braços em pose; Aurora: saia de baile em degradê lilás→ouro, sobressaia de tule translúcido, cauda, cinto e ~580 cristais; coluna de veludo azul com estola e luvas de ópera; sereia de tule carmim com cinco níveis de babados |
| Vitrines de parede | Acessórios (chapéus, luvas, bolsas, leques, sapatos) em degraus, dentro de arcos cegos da parede | 2,0 × 1,2 × 2,48 m; gabinete com portas, vidro nas quatro faces, três degraus forrados; legenda em vinil no alto do arco |
| Vitrine circular de joia | Peça central de joalheria isolada, vista por todos os lados | Ø 1,0 × 1,8 m: base de bronze canelada, cilindro de vidro espesso (duas faces), tampa com foco embutido; colar no busto de veludo, brincos e anel |
| Banco escultural | Bancos de galeria ficam no eixo de contemplação da peça principal | 4,0 × 0,6 × 0,45 m (o vão da planta) em 45 lâminas de carvalho com perfil em ampulheta, a silhueta ondula ao longo do banco; catálogo esquecido no assento |
| Mesa de croquis | O processo criativo exposto: mesa de corte do ateliê virada vitrine horizontal | 2,0 × 0,9 × 0,92 m: carvalho, tampo-vitrine de vidro com moldura de latão, croquis a grafite e aquarela, amostras de tecido, fita métrica, tesoura, alfinetes, lápis, carretel |
| Gipsoteca e vestidos-escultura | Cópias em gesso de esculturas clássicas eram coleção comum dos museus; aqui mostram o drapeado antigo como origem do vestido. Peças contemporâneas ficam em plinto aberto com cordão de distância | Pedestal clássico (base de granito, dado de pedra, cornija) com a figura em gesso; plinto redondo de granito com aro de latão e cinco pilaretes de 62 cm com cordão; «Pétalas» (≈1 000 pétalas de latão) e «Plissê» (coluna plissada com gola-leque) |
| Atril de catálogos e audioguia | O visitante começa pela entrada: catálogo para consulta e fones do audioguia | Atril de aço preto (1,05 m) com o catálogo aberto e a pilha; totem laqueado (1,1 m) com tela, três fones e base de carga |
| Segurança e conservação preventiva | Saída sinalizada sobre o vão, extintor e acionador de alarme, sensores de presença nos cantos, câmeras de domo, termo-higrômetros (têxtil pede 45–55 % UR, 18–21 °C) | Caixa de saída acesa, extintor de 4 kg, sensores a 3,6 m, domos nas vigas, registradores com visor aceso |

### Sala das Joias (Z08, guarda, acervo e conservação)

| Elemento | Por que está ali (uso real) | Medidas e materiais |
| --- | --- | --- |
| Piso | Sala-tesouro: pedra escura polida dá profundidade e faz o ouro e as pedras brilharem; a rosácea marca o centro (o pedestal) | Nero Marquina em placas de 75 cm, faixa de Rosso Levanto de 35 cm com filete de latão; rosácea de 16 pontas Ø 5,2 m em latão, Thassos e Rosso com anéis e estrelinhas; soleira de aço ranhurado na porta blindada |
| Paredes | Fundo escuro e quente valoriza joias (a tradição das salas de tesouro); o lambri protege a parede de carrinhos e vitrines | Lambri de nogueira de 93 cm com almofadas em relevo, rodapé de mármore e régua de cadeira com filete de latão; seda adamascada ameixa (desenho acetinado sobre fundo fosco) em painéis com filete dourado; pilastras de nogueira; friso e cornija de laca com cordões dourados |
| Teto | Escuro para não refletir os spots; a luz dura vem de cima do pedestal | Laca ameixa-negra em caixotões; tambor de Ø 4,2 m com cúpula de folha de ouro e oito spots (quatro com feixe) sobre o pedestal; spots embutidos mirando vitrines e nichos |
| Pedestal (peça principal) | Exibe a peça única com a trava de símbolos e a campânula | Base octogonal em dois degraus de mármore com filetes de latão, fuste canelado, três anéis da trava (os símbolos da placa-pista), capitel, tampo, campânula de vidro grosso com cúpula e remate, almofada capitonê com garras; o diamante e o brilho dele somem quando o diamante sai |
| Vitrines de joias (furto) | Joalheria se vê de cima e de perto: gabinete na altura de bancada e caixa de vidro | Gabinete de nogueira de 86 cm com portas almofadadas, caixa de vidro com colunetas de latão, deck de veludo preto, dentro de alcova em arco forrada de veludo ameixa; a sob a janela é baixa (tampo inclinado a 0,76–0,88 m) para não tapar a janela de fuga |
| Nichos iluminados | Peças avulsas embutidas na parede, atrás de vidro | Grande nicho oeste (no eixo da porta e do pedestal) com a parure de esmeraldas; nicho norte sob a placa com uma tiara de safira |
| Janela | A janela para a cornija (fuga escalando) | Cortinas de veludo presas por braçadeiras douradas com borlas, sanefa de laca com galão |
| Postes dos lasers | Emissores e receptores dos feixes da simulação | Coluna de aço negro de 1,62 m com base e remate de latão, cabeças emissoras com lente vermelha nas alturas dos feixes (0,35, 0,9, 1,1 e 1,45 m) e LED de estado |
| Conservação | Cada joia emprestada é examinada e fotografada na entrada (laudo de conservação) e guardada em caixa livre de ácido | Mesa de restauração 1,8 × 0,9 × 0,9 m (aço branco, tampo acolchoado com musselina, rolos e anel de apoio, busto, luvas brancas de algodão, lupa de mão, luminária-lupa com aro de LED frio, pinça, pincel, laudo na prancheta); mapoteca 1,5 × 1,0 × 1,0 m (dez gavetas rasas etiquetadas, caixas e rolo de tecido em cima); estação fotográfica (reprodutor com câmera na coluna, base cinza 18 %, cartão de cores, régua, duas luzes de LED, notebook); carrinho de acervo de inox com prateleira acolchoada e rodízios; quadro de cortiça com laudos, registrador de clima, prateleira de caixas |
| Segurança | A sala mais vigiada do prédio | Quatro câmeras de parede nos cantos e um domo sobre o duto; giroflex; saída sinalizada e luminária de emergência de dois faróis (acende quando cortam o quadro de luz) |

## Implementado

Arquivos da área (todos em `components/heist/scene/areas/`): `galeria.ts` (módulo da galeria: casca, paredes, nicho,
teto, spots, luz), `galeria-props.ts` (vitrines, banco, estátuas, móveis próprios), `galeria-trajes.ts` (manequins,
vestidos, acessórios, joias), `galeria-tex.ts` (texturas e textos da galeria), `galeria-copy.ts` (textos diegéticos em
pt-BR, en, es), `galeria-kit.ts` (ferramentas comuns: superfícies procedurais, molduras extrudadas, atlas, idioma),
`cofre.ts` (módulo da Sala das Joias), `cofre-props.ts` (pedestal, vitrines, conservação), `cofre-tex.ts` (mármores,
seda adamascada, anéis da trava, laudo, etiquetas). Todas as chaves de cache começam por `galeria-` ou `cofre-`.

**Planta** (`lib/heist/level.ts`, só as seções da galeria e do cofre):

- `baseProps()` galeria: as quatro estátuas ganham variante (0 = gesso em (−3,5; −20,5) e (3,5; −20,5); 1 = «Pétalas» em
  (−9; −7,6); 2 = «Plissê» em (9; −7,6)); móveis novos `fixture`: `jewelVitrine` círculo (−6,5; −19,0) r 0,5 "glass";
  `sketchTable` x 5,5…7,5, z −10,45…−9,55 "low" giro π; `catalogStand` x −4,9…−4,4, z −7,57…−7,03 "low" giro π/2;
  `audioGuide` x 4,4…4,9, z −7,57…−7,03 "low" giro −π/2.
- `baseProps()` cofre (canto da conservação, encostado na parede sul): `restorationTable` x −16,2…−14,4,
  z −8,15…−7,25; `photoStation` x −13,9…−12,8, z −8,3…−7,0; `flatFiles` x −21,75…−20,25, z −7,55…−6,55;
  `collectionCart` x −20,05…−19,45, z −7,75…−6,65 (todos "low", giro π, o carrinho π/2).
- `civs()` galeria: fotógrafo em (2,4; −14,4) mirando o Aurora; convidada em (−5,6; −18,3) na vitrine de joia; convidado
  em (6,3; −11,25) na mesa de croquis; convidada sentada no banco em (−0,9; −11,28).
- Sem mudança de lugar nem de altura: vitrines, banco, pedestal (−17,25; −14,25), vitrines de joias, lasers e postes,
  duto, porta blindada, `placardStars`, checkpoints "cofre" e "fuga", curadora e convidados que já existiam. O diamante
  e o brilho somem com `view.diamondOnPedestal` como antes. Todos os móveis novos passam no teste de proteção do
  `world.test` (rotas, portas e interações livres).

**Capturas** (pasta `scratchpad/gala/areas/galeria-joias/` da sessão; `low` para iterar, `high` na rodada final):

- Instituto do Traje: `g02-entrada-low` (do vão do salão), `g03-vitrine-perto-low` (vidro, manequim e etiqueta),
  `g11-alta-low` (vista alta), `g12-escultura-atril-low` (canto sudoeste: «Pétalas», atril, vitrine de parede,
  créditos), `g13-vitrine-parede-low` (vitrine de parede de perto), `g31-entrada-high`, `g32-vitrine-high`.
- Sala das Joias: `c01-porta-low` (da porta), `c02-pedestal-low` (pedestal de perto), `c03-conservacao-low` e
  `c13-conservacao-low` (canto da conservação, antes e depois de baixar os brancos), `c04-alta-low` (vista alta),
  `c05-sem-energia-low` (quadro de luz cortado), `c06-janela-low` (parede da janela), `c31-porta-high`,
  `c32-pedestal-high`.

**Desempenho** (medido na sala isolada): galeria 131 chamadas de desenho e 208 mil triângulos no "low" (265 mil no
"high", com os cristais e as pétalas a mais); Sala das Joias 103 chamadas e 79 mil triângulos.

### Instituto do Traje

| Item | Arquivo e função | Captura | Estado |
| --- | --- | --- | --- |
| Piso de parquet em espinha de peixe, faixa de granito com filete, soleiras | `galeria-tex.ts` `herringbone`/`floorOak`; `galeria.ts` `floorBorder` | g02, g11, g12, g31 | VALIDADO |
| Rodapé de granito, tecido pintado por seção, pilastras caneladas, trilho de quadros, friso, cornija | `galeria.ts` `walls` | g02, g11, g12, g31 | VALIDADO |
| Textos de parede (introdução, seções I–III, créditos), legendas dos arcos, inscrição dourada do friso | `galeria-tex.ts` `wallTextAtlas`, `creditsAtlas`, `friezeText`; `galeria.ts` `walls` | g02, g11, g12 | VALIDADO |
| Quadros (croquis e guaches) com passe-partout, vidro e moldura de perfil | `galeria-tex.ts` `artAtlas`; `galeria.ts` `framed` | g02, g12 | VALIDADO |
| Nicho do Aurora (arco, impostas, fecho, degrau, fundo "amanhecer") | `galeria.ts` `niche`; `galeria-tex.ts` `auroraTex` | g02, g11, g31 | VALIDADO |
| Teto em caixotões, bossas, rosetas, lanternim com grelha, difusores e detectores | `galeria.ts` `ceiling` | g02, g11, g31 | VALIDADO |
| Trilhos e 26 spots de museu (suporte, corpo com aletas, lente) com seis feixes | `galeria.ts` `spots` | g02, g11 | VALIDADO |
| Luz: âncoras, manchas dos spots nas paredes tingidas pela seção, luz de sanca, três luzes com sombra | `galeria.ts` `lights`, `washes`, `KEYS` | g02, g31 | VALIDADO |
| Vitrines de piso (Aurora, coluna de veludo, tule carmim) com vidro de 19 mm, caixa de luz, sensor e etiqueta | `galeria-props.ts` `vitrine`, `glassHood`, `lightAttic`, `velvetDeck`; `galeria-trajes.ts` `auroraGown`, `velvetGown`, `tulleGown`, `mannequin` | g02, g03, g32 | VALIDADO |
| Vitrines de parede (chapéus, luvas e bolsas, leques e sapatos, chapéus e véus) com fundo forrado e luz da caixa | `galeria-props.ts` `wallVitrine`; `galeria-trajes.ts` `hat`, `headStand`, `gloveStand`, `clutch`, `fan`, `pump` | g11, g12, g13 | VALIDADO |
| Vitrine circular de joia (fixture `jewelVitrine`) | `galeria-props.ts` `jewelVitrine`; `galeria-trajes.ts` `necklace`, `earrings`, `ring`, `jewelBust` | g02 (de longe) | IMPLEMENTADO |
| Banco escultural de lâminas de carvalho com catálogo esquecido | `galeria-props.ts` `bench` | g02, g11 | VALIDADO |
| Mesa de croquis e amostras têxteis (fixture `sketchTable`) | `galeria-props.ts` `sketchTable` | g11 | VALIDADO |
| Cópias em gesso com himátion sobre pedestal clássico | `galeria-props.ts` `statue` (variante 0), `himationSkirt`, `himationSash` | g02, g11 | VALIDADO |
| Vestido-escultura «Pétalas» com cordão de distância | `galeria-props.ts` `statue` (1); `galeria-trajes.ts` `petalsGown` | g12 | VALIDADO |
| Vestido-escultura «Plissê» com cordão de distância | `galeria-props.ts` `statue` (2); `galeria-trajes.ts` `plisseGown` | — | IMPLEMENTADO |
| Atril de catálogos (fixture `catalogStand`) | `galeria-props.ts` `catalogStand` | g12 | VALIDADO |
| Totem do audioguia (fixture `audioGuide`) | `galeria-props.ts` `audioGuide` | — | IMPLEMENTADO |
| Placa-pista (`placardStars`) no atril de bronze | `galeria.ts` `details` | — | IMPLEMENTADO |
| Saída, extintor e acionador, termo-higrômetros, sensores de presença, câmeras de domo, giroflex | `galeria.ts` `details` | g11, g12 | VALIDADO |
| Pessoas novas: fotógrafo no Aurora, convidada na vitrine de joia, convidado nos croquis, convidada sentada no banco | `lib/heist/level.ts` `civs()` | — | IMPLEMENTADO |

### Sala das Joias

| Item | Arquivo e função | Captura | Estado |
| --- | --- | --- | --- |
| Piso de Nero Marquina, faixa de Rosso Levanto, rosácea de 16 pontas, soleira de aço | `cofre-tex.ts` `floorNero`, `rossoMat`, `thassosMat`, `inlayBrass`; `cofre.ts` `floorInlays`, `rosette` | c01, c02, c04, c31 | VALIDADO |
| Lambri de nogueira com almofadas, régua de cadeira, seda adamascada em painéis com filete dourado, pilastras, friso, cornija | `cofre.ts` `walls`; `cofre-tex.ts` `damaskMat` | c01, c04, c31 | VALIDADO |
| Teto em caixotões de laca, tambor e cúpula dourada, anel de spots com quatro feixes, spots embutidos | `cofre.ts` `ceiling` | c01, c04 | VALIDADO |
| Pedestal do diamante (diamante e brilho preservados, anéis da trava com os símbolos, campânula fina) | `cofre-props.ts` `pedestal` | c02, c04, c32 | VALIDADO |
| Vitrines de joias em alcova (tiaras, pérolas, brincos) e a baixa sob a janela (anéis), tampo com moldura de latão | `cofre-props.ts` `jewelCase`, `lowCase` | c01, c04, c06, c31 | VALIDADO |
| Nichos iluminados (parure de esmeraldas no oeste, tiara de safira no norte) | `cofre.ts` `niches` | c01, c06, c31 | VALIDADO |
| Cortinas de veludo e sanefa na janela da cornija | `cofre.ts` `windowDrapes` | c06 | VALIDADO |
| Postes emissores dos lasers | `cofre.ts` `laserPosts` | c01, c02, c04 | VALIDADO |
| Câmeras de parede e domo sobre o duto | `cofre.ts` `cameras` | c04 | VALIDADO |
| Conservação: mesa de restauração, mapoteca, estação fotográfica, carrinho de acervo (fixtures) | `cofre-props.ts` `restorationTable`, `flatFiles`, `photoStation`, `collectionCart` | c03, c13, c04 | VALIDADO |
| Parede da conservação: placa, quadro de cortiça com laudos, registrador de clima, prateleira de caixas | `cofre.ts` `signsAndConservationWall` | c03, c13 | VALIDADO |
| Saída, luz de emergência e corte de energia (spots, vitrines e nichos apagam; emergência acende) | `cofre.ts` `power` | c05 | VALIDADO |
| Luz: âncoras, leques de luz na seda, luz com sombra no pedestal | `cofre.ts` `lights`, `scallops`, `KEYS` | c01, c02, c04 | VALIDADO |

### Pendente

- **Vista com gente**: a página do jogo (`/lab/heist?at=salao&q=low&shot=…`) não chegou a 60 % do carregamento das
  pessoas em 15 min (o mesmo erro das outras áreas: o carregamento é do sistema de pessoas, não das salas). As quatro
  pessoas novas estão na planta e passam nos testes de simulação e de mundo; falta a captura.
- Folhas das portas (vão do salão, porta blindada, porta do terraço) são da área do vestíbulo; a área desenhou só os
  batentes, as soleiras e as placas.
- Sem captura de perto: «Plissê», totem do audioguia, placa-pista no atril e a vitrine circular de joia (vista só de
  longe).
- Modelos gerados (Meshy): o manifesto do coordenador tem briefs para `sketchTable`, `catalogStand`,
  `restorationTable`, `photoStation`, `flatFiles`, `collectionCart` e `jewelVitrine`. Se um GLB for gerado, o desenho
  procedural da área é pulado e perde os textos desenhados nos três idiomas (catálogo, laudo, etiquetas das gavetas) e,
  na vitrine de joia, o vidro grosso de duas faces e o colar; vale manter procedural pelo menos `jewelVitrine` e
  `sketchTable`.
