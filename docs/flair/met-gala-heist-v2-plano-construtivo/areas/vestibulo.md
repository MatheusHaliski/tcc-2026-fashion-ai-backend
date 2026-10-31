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

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
