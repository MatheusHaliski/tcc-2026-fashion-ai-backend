# Vestíbulo e escadaria (e as portas do prédio)

**Zonas do blueprint:** Z02 (vestíbulo e credenciamento), Z03 (corredores nobres), Z14 (escadas e passagens) · **Salas da planta:** `vestibulo` + todas as portas internas

**Dimensões:** x −8 a 8, z 14,5 a 24 (16 × 9,5 m), pé-direito 6,5 m

**Arquivos da área:** `components/heist/scene/areas/vestibulo.ts`, `components/heist/scene/interior-doors.ts` (portas de todas as salas)

## Como está hoje

Tapete vermelho, viga do detector, lustre, letreiros, cartazes, credenciamento, chapelaria e vasos. Piso xadrez sem bordas nem embutidos; paredes de pedra lisas; nenhuma escadaria.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Granito polido (preto absoluto e branco) com faixa de borda, rosácea central embutida e soleiras de mármore; o tapete vermelho com debrum e varões de latão nos pontos de dobra |
| Paredes | Pedra calcária em blocos com junta fina, pilastras com capitel, nichos com estátua ou vaso, lambri de mármore até 1,1 m, cimalha, sanca, placas de bronze |
| Teto | Caixotões profundos com rosáceas e filete dourado, medalhão central de onde desce o lustre de cristal |
| Portas | Todas as portas internas do prédio (dono: esta área): folhas duplas de 4 m do salão com almofadas entalhadas e puxadores de latão; portas de serviço de aço com chapa de chute e barra antipânico; porta acolchoada do lounge; porta preta do palco com estêncil; porta blindada da Sala das Joias com volante e trancas; batentes e guarnições com perfil, dobradiças visíveis, molas aéreas, LEDs das fechaduras |
| Luz | Lustre de cristal central, arandelas de parede em pares, luz rasante nos nichos, a luz da rua entrando pela porta |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Escadaria monumental (dois lances curvos até uma galeria sobre a porta do salão) | A subida cerimonial que o blueprint pede (Z14); camarote para olhar a chegada | degrau 17 × 30 cm, largura 1,8 m, corrimão a 0,9 m | alta nos lances | PLANEJADO |
| Balcão curvo de credenciamento Nocturne com gavetas e leitor | Recepção dos convites e pulseiras | 3,0 × 0,7 × 1,1 m | baixa (já existe como desk) | PLANEJADO |
| Banco escultural Silhouette com estofamento | Espera de quem chega | 2,0 × 0,6 × 0,45 m | baixa | PLANEJADO |
| Guarda-volumes com cabides e nichos numerados | Chapelaria (onde a joia guardada fica) | 4,0 × 0,6 × 2,2 m | baixa (já existe como coatcheck) | PLANEJADO |
| Mesa floral com arranjo exclusivo do evento | Peça central de quem entra | Ø 1,4 m, arranjo até 2,2 m | baixa | PLANEJADO |
| Painel de indicação dos pavimentos e totem acessível | Orientação (Z14) | 0,6 × 0,1 × 1,8 m | baixa | PLANEJADO |

### Objetos de cena

Livro de presença, leitores de QR, pulseiras em bandejas, porta-guarda-chuvas, cabideiro, extintor discreto em nicho, placas de bronze, cordões e totens, bandeja de taças de boas-vindas.

### Pessoas

Recepcionistas, equipe de credenciamento, convidados chegando e conversando, segurança no detector.

### Regras de jogo

O detector e a porta do salão (z 14), a porta lateral da doca (x −8, z 20 a 22,5), a chapelaria e o balcão continuam acessíveis; a escadaria fica junto às paredes sem fechar a passagem do tapete. Colisão nova como `fixture`.

### Vistas de aceite

Da porta da rua para o salão; escadaria de baixo; balcão e livro de perto; vista alta do vestíbulo; cada tipo de porta de perto (salão, serviço, lounge, palco, Sala das Joias).

## Estudo da área

**O que um vestíbulo de museu em noite de gala tem de verdade.** É a primeira sala coberta depois da escadaria da rua:
precisa receber, conferir e distribuir gente. Vestíbulos de museus do fim do século XIX (e os castelos e palacetes que
inspiram a linguagem de *Resident Evil Village*) resolvem isso com três camadas: pedra e mármore no chão e nas paredes,
porque aguentam o tráfego e a umidade da rua; um eixo cerimonial marcado no piso que leva à porta principal; e móveis
de serviço (balcão, chapelaria, bancos) encostados nas laterais para não fechar esse eixo. Na noite do evento entram por
cima disso o tapete, os cordões, o pórtico de segurança e o mobiliário da produção.

| Item | Por que está aqui | Medidas reais adotadas | Materiais |
| --- | --- | --- | --- |
| Piso em losangos de granito | Granito polido é o piso de entrada mais resistente (não mancha com a chuva da rua); o losango diagonal dá movimento e esconde o desgaste | placas de 60 × 60 cm na diagonal, junta de 2 mm, faixa de borda de 78 cm | granito preto absoluto (cristais de mica), granito branco com pintas de biotita e quartzo, filetes de mármore branco e de latão |
| Rosácea embutida | Marca o centro, sob o lustre, e o ponto onde o tapete se interrompe (os convidados param ali para a foto) | Ø 3,2 m, estrela de 16 pontas | nero, Carrara, giallo, rosso e cinza, cada ponta meio clara e meio escura (parece em relevo), filetes de latão, o "V" do museu |
| Soleiras | Separam pisos de salas diferentes e protegem a borda das placas na porta | 1,2 cm de altura, a largura do vão | Carrara |
| Tapete vermelho | Continua o tapete da escadaria até a porta do salão; o debrum protege a borda e os varões de latão prendem as pontas | 2,6 m de largura, 13 mm de altura | veludo de lã vermelho com linha dourada tecida, debrum de gorgorão, varões de latão com olhais |
| Cantaria de calcário | Pedra clara e quente, fácil de lavrar em juntas finas: é o "corpo" de um vestíbulo neoclássico | blocos de 1,2 × 0,6 m em amarração, junta de 3 mm | calcário creme com fósseis e poros, face apicoada fina |
| Lambri de mármore | A faixa até 1,1 m é a que leva pancada de bolsa, cadeira e carrinho: precisa ser pedra | rodapé de 20 cm, almofadas de ~0,95 m, chapim a 1,0–1,1 m | rodapé de nero, almofadas de Botticino emolduradas de nero, chapim de Carrara |
| Pilastras e cimalha | Dão ritmo à parede de 6,5 m e "seguram" visualmente o teto | pilastra de 55 cm com pedestal de 1,1 m e capitel de 48 cm; cimalha de 75 cm que avança 42 cm | calcário de moldura, caneluras, folhas de acanto e volutas douradas, dentículos |
| Nichos | Lugar clássico para escultura no vestíbulo; luz rasante de baixo valoriza o volume | vão de 1,1 m, peitoril a 1,25 m, arco a 3,7 m, 32 cm de fundo | moldura de calcário, fundo vermelho-pompeiano, estátua de mármore e urna de Botticino com rosas brancas |
| Teto em caixotões | Esconde a estrutura, dá profundidade e sombras (a referência de *RE Village*: teto sempre presente e trabalhado) | 9 × 5 caixotões, vigas de 24 cm descendo 30 cm, dois degraus de moldura, medalhão Ø 4,6 m | gesso pintado, fundo com coroa de louros, filetes e florões dourados |
| Lustre de cristal | É a fonte de luz da sala e o ponto focal de quem entra | Ø 1,9 m, da rosácea (6,9 m) até ~3,4 m; 20 velas | bronze dourado, mangas de vela, festões de contas e pingentes de cristal |
| Escadaria monumental (Z14) | A subida cerimonial à galeria-camarote sobre a porta do salão, de onde se vê a chegada | degrau de 17 × 30 cm (26 espelhos até 4,42 m), 1,5 m de largura, corrimão a 0,9 m | degraus maciços de pedra com piso de Carrara boleado, passadeira com varões, balaústres de mármore, corrimão de mogno, torchère de bronze |
| Galeria | O "camarote" da chegada; liga as duas escadas por cima da porta de 4 m | 7,8 × 1,5 m, piso a 4,42 m, balaustrada de 0,9 m | laje de pedra, friso dourado, consolos, forro em caixotões com spots, estandarte de veludo |

**Móveis únicos do Z02 (e por que cada um faz sentido ali):**

- **Balcão curvo de credenciamento "Nocturne"** (3,0 × 0,8 × 1,1 m): o balcão de recepção de evento tem duas alturas —
  1,1 m do lado do convidado (para apoiar o convite e assinar de pé) e 0,76 m do lado da equipe (para trabalhar
  sentada ou de pé com tablet). A frente curva convexa abraça a fila e mostra para onde ir. Laca negra com aletas de
  latão (art déco, o "noturno" do nome), tampo de nero, gavetas de nogueira do lado de dentro, fita de luz no rodapé.
  Em cima: livro de presença aberto com caneta, dois leitores de QR (a lista de convidados é digital), bandejas de
  pulseiras (a pulseira é o que abre a porta do salão no jogo), tablet e uma orquídea. Fica a oeste, de frente para a
  porta da rua, longe da porta lateral da doca.
- **Guarda-volumes e chapelaria** (balcão de 3,6 × 0,6 m e a parede de nichos de 4,0 × 0,36 × 2,66 m): numa gala de
  inverno a chapelaria recebe casacos, bolsas grandes e guarda-chuvas; o balcão separa o público da equipe e a parede
  atrás tem cabides (casacos longos precisam de ~1,1 m livre abaixo do trilho a 1,82 m) e nichos numerados para bolsas e
  pertences pequenos — um deles guarda o porta-joias da peça que o jogo esconde ali.
- **Banco escultural "Silhouette"** (2,0 × 0,6 × 0,45 m): quem espera o casaco ou o acompanhante precisa sentar; o
  assento côncavo de veludo azul-petróleo, capitonê, com pés torneados e almofada de rolo, conversa com o lounge.
- **Mesa floral** (gueridom Ø 1,4 m, arranjo até ~2,2 m): toda gala tem a peça floral da entrada com a paleta do evento
  (rosas brancas e rosadas, orquídeas pendentes, esporas brancas e azuis, eucalipto). Fica à direita de quem entra,
  equilibrando o balcão à esquerda.
- **Painel dos pavimentos e totem acessível** (0,7 × 0,12 × 1,9 m e 0,4 × 0,3 × 1,1 m): orientação do Z14 — o painel de
  bronze e vidro negro lista os pisos; o totem tem o tampo inclinado (leitura de cadeira de rodas), mapa tátil em
  relevo e braile.

**Objetos de cena:** livro de presença, leitores de QR, pulseiras em bandeja, aparador com taças de boas-vindas (flûtes
com champanhe, balde e garrafa, guardanapos), porta-guarda-chuvas de latão com três guarda-chuvas, cabideiro de madeira
curvada com chapéu e echarpe, extintor discreto num nicho de bronze com porta de vidro (é obrigatório e fica perto da
porta de serviço), placas de bronze (Grande Salão, doca/funcionários, fundação do museu), pedestais com cordão de veludo,
pórtico do detector de metais, estandarte da gala na galeria.

**Portas (todas as internas do prédio).** Cada tipo segue o uso real:
salão e galeria — portas duplas de 4 m em nogueira maciça com almofadas levantadas, moldura bolection, florão e losango
entalhados, puxador vertical de 90 cm, placa de empurrar, chapa de chute e quatro dobradiças por folha;
serviço, doca, terraço da equipe e segurança — porta de aço pintado com visor de vidro aramado (a equipe vê quem vem do
outro lado carregando bandejas), chapa de chute inox e barra antipânico no lado de empurrar;
lounge — porta acolchoada (isola o som do bar) em couro capitonê com tachas de latão;
palco e bastidores — preta fosca, visor redondo, o nome em estêncil e fita crepe de ensaio;
terraço — porta francesa de vidro (luz e vista para o jardim);
porta da equipe no salão — porta disfarçada que continua a parede do salão (calcário e lambri) e é de aço do lado do
serviço; Sala das Joias — porta blindada de 30 cm com volante, segredo, seis trancas e o mecanismo visível por dentro.
Molas aéreas com braço articulado nas portas que fecham sozinhas; guarnições no estilo da sala de cada lado.

**Mudanças em relação ao plano, e por quê.** (1) A escadaria virou duas escadas em U nos cantos norte (lance curto,
leque de dez degraus em volta de um pilar e lance junto à parede até a galeria): com degraus reais de 17 × 30 cm, chegar
a 4,42 m exige 7,5 m de lance, e o lado leste só tem 2,8 m de profundidade livre antes da arara e da interação da
chapelaria (que não são desta área); a planta em U cabe nos dois cantos, fica simétrica e não fecha o tapete, a porta do
salão, a porta lateral nem o posto do detector (3; 15,4). (2) A largura do lance ficou em 1,5 m (o plano pedia 1,8 m)
para caber o pilar central e manter a arara a mais de 0,6 m. (3) Os quatro vasos de palmeira dos cantos saíram (dois
ficavam dentro das escadas); no lugar entraram os nichos, a mesa floral e o aparador. (4) O tapete foi interrompido na
rosácea para ela aparecer inteira — os varões de latão marcam as pontas.

## Implementado

Código em `components/heist/scene/areas/vestibulo*.ts` (área; textos por idioma em `vestibulo-copy.ts`) e
`components/heist/scene/interior-doors*.ts` (portas de todas as salas). Capturas em `scratchpad/gala/areas/vestibulo/`
(nomes abaixo; `-low` e `-high` são as qualidades). Estados: PLANEJADO → IMPLEMENTADO → VALIDADO / REPROVADO.

| Item | Arquivo · função | Captura | Estado |
| --- | --- | --- | --- |
| Piso: campo de granito em losangos (preto absoluto e branco salpicado, placa de 60 cm na diagonal, junta de 2 mm), reflexo planar no "high" | `vestibulo-floor.ts` · `floorMaterial`, `graniteFieldSurface` (casca: `surfaces.floor`) | v1-entrada, v4-alta | VALIDADO |
| Faixa de borda (granito negro, filetes de mármore e de latão, grega em mármore) e quadrados dos cantos | `vestibulo-floor.ts` · `bandSurface`, `buildFloor` | v4-alta | VALIDADO |
| Rosácea embutida Ø 3,2 m (estrela de 16 pontas em cinco mármores, coroa de 32 pedras, filetes de latão, "V") | `vestibulo-floor.ts` · `rosetteSurface` | v1-entrada, v4-alta | VALIDADO |
| Soleiras de Carrara (porta da rua, do salão e da doca) | `vestibulo-floor.ts` · `buildFloor` | p1-lateral, p2-salao | VALIDADO |
| Tapete vermelho em dois trechos com linha dourada, debrum e varões de latão com olhais | `vestibulo-floor.ts` · `carpetTexture`, `buildFloor` | v1-entrada | VALIDADO |
| Cantaria de calcário (blocos de 1,2 × 0,6 m, junta de 3 mm, fósseis, face apicoada) | `vestibulo-walls.ts` · `wallMaterial` (casca: `surfaces.wall`) | v1-entrada, v2-escada | VALIDADO |
| Lambri de mármore até 1,1 m (rodapé de nero, almofadas de Botticino emolduradas, chapim de Carrara) | `vestibulo-walls.ts` · `wainscot` | v1-entrada, p1-lateral | VALIDADO |
| Pilastras caneladas com pedestal e capitel dourado (folhas, volutas, ábaco) | `vestibulo-walls.ts` · `pilaster` | v1-entrada, v4-alta | VALIDADO |
| Cimalha (arquitrave, friso dourado, dentículos, cornija) e sanca côncava até o teto | `vestibulo-walls.ts` · `cornice` | v1-entrada, v4-alta | VALIDADO |
| Nichos da parede sul (fundo vermelho-pompeiano, luz rasante, estátua de mármore e urna com rosas) | `vestibulo-walls.ts` · `niche` | v4-alta, v5-galeria | VALIDADO |
| Portal da porta da rua (guarnição de pedra, blocos de nero, bandeira em leque acesa pela rua, forro do vão) | `vestibulo-walls.ts` · `frontPortal`, `fanTexture` | v5-galeria | VALIDADO |
| Placas de bronze (Grande Salão, doca/funcionários, fundação), arandelas de bronze em pares, pinturas a óleo e cartazes da exposição em molduras douradas com luz de quadro | `vestibulo-walls.ts` · `plaque`, `sconceV`, `painting`, `poster` | v1-entrada, v2-escada | VALIDADO |
| Teto em caixotões 9 × 5 (dois degraus de moldura, fundo pintado com louros, rosáceas e florões dourados) e medalhão Ø 4,6 m | `vestibulo-ceiling.ts` · `buildCeiling`, `cofferTexture`, `rosetteGeo` | v1-entrada, v4-alta | VALIDADO |
| Lustre de cristal (canopla, corrente, coroa, 12 + 8 braços, mangas de vela, festões de contas, prismas) | `vestibulo-ceiling.ts` · `chandelier` | v1-entrada, v4-alta | VALIDADO |
| Escadaria monumental em U (2 × 25 pisos + galeria, 17 × 30 cm, degrau de arranque redondo, leque de 10 degraus, pilar central, banzos, balaústres, corrimão em hélice, passadeira com varões, torchère e lanterna); colisão `vestStair` | `vestibulo-stair.ts` · `buildStair` | v1-entrada, v2-escada | VALIDADO |
| Galeria sobre a porta do salão (laje, friso, consolos, forro com spots, balaustrada, estandarte da gala) | `vestibulo-stair.ts` · `buildGallery` | v1-entrada, v5-galeria | VALIDADO |
| Balcão curvo de credenciamento "Nocturne" (laca negra, aletas de latão, tampo de nero, gavetas, livro de presença, leitores de QR, pulseiras, tablet, orquídea, luminária, placa pendurada) | `vestibulo-furniture.ts` · `desk` | v3-balcao | VALIDADO |
| Chapelaria (balcão com almofadas, tampo de latão, campainha, fichas) e guarda-volumes (36 nichos numerados, cabides e casacos, porta-joias) | `vestibulo-furniture.ts` · `coatCheck`, `cloakWall` | v4-alta | VALIDADO |
| Arara de latão (esconderijo) com casacos e capas | `vestibulo-furniture.ts` · `rack` | v4-alta | VALIDADO |
| Banco escultural "Silhouette" (assento côncavo capitonê, pés torneados, almofada de rolo) | `vestibulo-furniture.ts` · `bench` | v4-alta, g1-gente | VALIDADO |
| Mesa floral (gueridom de nero, pé de volutas douradas, arranjo de rosas, esporas, orquídeas e eucalipto até ~2,2 m) | `vestibulo-furniture.ts` · `floralTable` (móvel `vestFloral`) | v4-alta | VALIDADO |
| Aparador das taças de boas-vindas (flûtes com champanhe, balde, garrafa, guardanapos) | `vestibulo-furniture.ts` · `welcomeConsole` (móvel `vestConsole`) | v5-galeria | VALIDADO |
| Painel dos pavimentos (bronze e vidro negro) e totem acessível (tampo inclinado, mapa tátil, braile) | `vestibulo-furniture.ts` · `directory`, `totem` (móveis `vestDirectory`, `vestTotem`) | v1-entrada, v4-alta | VALIDADO |
| Pórtico do detector (colunas de bronze, LEDs de zona, visor, viga) e pedestais com cordão | `vestibulo-furniture.ts` · `detector`, `rope` | v1-entrada | VALIDADO |
| Porta-guarda-chuvas, cabideiro, extintor no nicho | `vestibulo-furniture.ts` · `smallProps` | v4-alta, p1-lateral | VALIDADO |
| Luz: lustre (âncoras fortes e a luz com sombra), arandelas, torchères, lanternas, spots da galeria, nichos, quadros, balcão, chapelaria, a rua pela porta | `vestibulo*.ts` (âncoras `A`) e `vestibulo.ts` · `keys` | v1-entrada, v4-alta | VALIDADO |
| Pessoas: recepcionista com tablet, equipe, convidados chegando e conversando, garçonete com as taças, convidada sentada no banco, segurança no detector | `lib/heist/level.ts` · `civs()` (seção do vestíbulo) | g1-gente | VALIDADO |
| Portas nobres do salão e da galeria (nogueira, 4 m, duas folhas: almofadas levantadas com moldura bolection, florão e losango entalhados, puxador vertical de latão de 90 cm, placa de empurrar, chapa de chute, quatro dobradiças por folha, mola aérea de braço paralelo) | `interior-doors-leaf.ts` · `grand`, `hinges`, `closerBody`, `closerArm`; `interior-doors.ts` · `buildDoors` | p2-salao | VALIDADO |
| Guarnições de cada lado no estilo da sala (cantaria com blocos de base no vestíbulo e no terraço, nogueira com rosetas e filete dourado, aço prensado, preta do palco, quadro rebitado do cofre, fresta da porta disfarçada), forro das jambas e do alto, batente de encosto | `interior-doors.ts` · `casing`, `casingMats`, `liningMat` | p1–p6 | VALIDADO |
| Portas de aço (doca, serviço, terraço da equipe, segurança): visor de vidro aramado, chapa de chute inox, barra antipânico no lado de empurrar, leitor de crachá e teclado com LED | `interior-doors-leaf.ts` · `steel`, `wireTexture`; `interior-doors.ts` · `fixture` | p1-lateral, p6-servico | VALIDADO |
| Porta acolchoada do lounge (couro capitonê, botões e friso de tachas de latão, placa oval de empurrar, puxador em D) | `interior-doors-leaf.ts` · `padded` | p3-lounge | VALIDADO |
| Portas pretas do palco e dos bastidores (visor redondo, nome em estêncil lido de baixo para cima, fita crepe de ensaio, chapa de chute; textos por idioma em `vestibulo-copy.ts`) | `interior-doors-leaf.ts` · `stage`, `stageTexture` | p4-palco | VALIDADO |
| Porta blindada da Sala das Joias (30 cm, volante, segredo, seis trancas e o mecanismo visível por dentro; leitor de cartão com LED) | `interior-doors-leaf.ts` · `vault`; `interior-doors.ts` · `casing("vault")`, `fixture` | p5-joias | VALIDADO |
| Porta francesa do terraço e porta disfarçada da equipe (calcário e lambri do salão de um lado, aço do outro; fechadura de chave) | `interior-doors-leaf.ts` · `french`, `jib` | — (capturas das áreas vizinhas) | IMPLEMENTADO |
| Grade do duto (solta, encostada no chão) e janela da Sala das Joias | `interior-doors.ts` · `vent`, `jewelWindow` | — | IMPLEMENTADO |

**Planta (`lib/heist/level.ts`, só as linhas do vestíbulo).** Em `baseProps()`: balcão `desk` de box(−5,6; 21,5; −3,2; 22,2)
para box(−6; 21,45; −3; 22,25) (o balcão curvo de 3 m); chapelaria `coatcheck` de box(5,2; 17; 5,8; 21) para box(5,2; 18,4;
5,8; 22) (sai da frente da escada leste); os quatro vasos `planter` (±7,4; 15) e (±7,4; 23,4) saíram; entraram o banco
`bench` box(4,3; 23,2; 6,3; 23,8) giro π e os móveis próprios (`kind: "fixture"`): `vestStair` box(−8; 14,5; −3,9; 17,9) e
box(3,9; 14,5; 8; 17,9) altos, `vestFloral` circ(3,7; 20,8; 0,7) baixa, `vestConsole` box(−6,3; 23,45; −4,3; 23,95) baixo
giro π, `vestDirectory` box(−3,65; 16,9; −2,95; 17,02) alto, `vestTotem` box(2,35; 22,4; 2,75; 22,7) baixo giro −π/2.
Detectores, cordões e o posto do segurança v1 (3; 15,4) não mudaram. Ronda da v2 (Lívia): de (−6,5; 16) → (−6,5; 22,8) →
(−3; 23) → (−3; 16,6) para (−6,6; 19,1) → (−6,8; 23) → (−3,4; 23) → (−3,4; 19,5) (a de antes subia a escada oeste). Em
`civs()`: convidada que conversa de (−2,2; 18,6) para (−2,7; 18,9); a do copo de (3; 19,4) para (3,65; 19,5) giro 1,8; a do
celular de (2,4; 16,8) para (4,5; 19,3) giro π/2 (as duas saem da linha de tiro do v1 e do ponto do teste de mira);
novos: convidado conversando no balcão (−4,2; 22,85), garçonete com bandeja de boas-vindas (1,95; 21,6) e convidada
sentada no banco esperando o casaco (4,85; 23,45). A linha do vestíbulo em `STYLE` (interior-shell.ts) não mudou: o
módulo da área troca piso, parede e teto por `surfaces`.

**Orçamento.** Vestíbulo sozinho ~160 desenhos e ~0,32 M triângulos no "high" (limite ~400 / 1,2 M); com o salão aberto
pela porta, o que a captura v1 mede.

**Pendências.** (1) `components/heist/camera.tsx` limita a câmera do jogo a 4,7 m nas salas sem entrada em `CEILING`;
o vestíbulo tem 6,5 m — vale acrescentar `vestibulo: 6.4` (arquivo fora desta área). (2) A porta da equipe disfarçada
(`jib`) continua a cantaria da casca do salão; se a área do salão trocar a parede por material próprio, o lado do salão
da folha precisa receber o mesmo material (`M.limestone` em `interior-doors-leaf.ts`). (3) O teste de furto em
`lib/heist/plan.test.ts` chegou a estourar o tempo uma vez com a máquina carregada (passa sozinho e na suíte completa).
(4) A ferramenta `scratchpad/gala/vest/multi.cjs` fotografa várias vistas numa só sessão do laboratório (uma montagem,
câmera presa pelo gancho de devtools do three.js, HMR filtrado): serve para qualquer área.
