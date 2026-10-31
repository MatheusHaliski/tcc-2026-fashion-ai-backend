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
| Vitrines com manequins individuais e vestidos-escultura | A exposição do Instituto do Traje | vitrine 2 × 2 × 2,4 m | vidro (já existe) | PLANEJADO |
| Vitrine circular de joia com vidro espesso | Peça central de joalheria | Ø 1,0 × 1,8 m | vidro | PLANEJADO |
| Banco escultural de galeria | Pausa para olhar | 2,4 × 0,5 × 0,45 m | baixa (já existe) | PLANEJADO |
| Mesa de croquis e amostras têxteis | Processo criativo exposto | 2,0 × 0,9 × 0,9 m | baixa | PLANEJADO |
| Mesa de restauração com suportes acolchoados (Sala das Joias) | Conservação do acervo (Z08) | 1,8 × 0,9 × 0,9 m | baixa | PLANEJADO |
| Gaveteiro horizontal, estação fotográfica e carrinho de acervo | Guarda e documentação (Z08) | gaveteiro 1,5 × 1,0 × 1,0 m | baixa | PLANEJADO |

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

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
