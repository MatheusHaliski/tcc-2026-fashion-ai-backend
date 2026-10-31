# Rua: avenida, fachada e cidade

**Zonas do blueprint:** Z01 (fachada e tapete vermelho) · **Salas da planta:** `rua` e a fachada inteira do museu, inclusive o beiral (cornija norte) e a parede leste vista do beco

**Dimensões:** x −30 a 30, z 24,5 a 50,5; calçada em y −1,6 e pista em −1,75; escadaria de 12 degraus até as portas (z 24,5 a 31)

**Arquivos da área:** `components/heist/scene/exterior.tsx`, `exterior-street.tsx`, `exterior-city.tsx`, `exterior-facade.tsx`, `exterior-vehicles.tsx`, `exterior-fx.tsx`, `exterior-textures.ts`, `exterior-materials.ts`, `exterior-geometry.ts`, `sky.tsx`; laboratório `/lab/heist-rua`

## Como está hoje

Avenida noturna com a fachada neoclássica, escadaria com tapete, arquibancada de fotógrafos e imprensa, fila, limusines, caminhão do bufê, viatura, grades dos fãs e a barraca do revendedor. A cidade ao fundo é rala e a calçada é limpa demais: parece cenário de estúdio.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Calçada em placas de granito cinza (60 × 60 cm) com juntas, desgaste e manchas; meio-fio de granito com sarjeta; asfalto molhado com faixa de pedestre gasta, tampas de bueiro e de inspeção, remendos; sujeira de cidade: chicletes, manchas de óleo, folhas, poças rasas com reflexo, **panfletos espalhados** (shows, festas, a própria gala, sem marcas reais) e **bitucas de cigarro** concentradas perto das lixeiras, do ponto de ônibus e da fila |
| Paredes | Fachada do museu (já existe) com mais relevo: almofadas de pedra, frisos, placas de bronze com o nome do museu, iluminação de destaque; **a quadra inteira com prédios vizinhos**: térreos com **vitrines de loja** (moda, joalheria, café, farmácia, banca — nomes fictícios), toldos, portas de enrolar, letreiros de neon e luminosos; andares de cima com janelas de tipos diferentes, varandas, aparelhos de ar-condicionado, persianas, algumas acesas |
| Teto | Céu noturno com nuvens iluminadas pela cidade, holofotes da gala; **skyline ao fundo** com prédios altos em camadas (perto, meio, longe), janelas acesas em padrão irregular, antenas, luzes de aviso vermelhas |
| Portas | Portas de bronze do museu (folha dupla com almofadas e puxadores); portas das lojas (vidro com caixilho, porta de enrolar meio aberta); portão da doca |
| Luz | Postes de rua com luminária real (vapor de sódio e LED), luz das vitrines saindo para a calçada, letreiros de neon, faróis e lanternas dos carros, flashes dos fotógrafos |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Banco escultural de pedra e vasos monumentais | Marcam a entrada do museu e seguram a fila | banco 2,4 × 0,6 × 0,45 m; vaso Ø 0,9 × 1,2 m | baixa | PLANEJADO |
| Totens e cordões de veludo | Organizam a chegada e o tapete | totem Ø 0,3 × 1,0 m; cordão a 0,9 m | baixa (já existe como rope) | PLANEJADO |
| Painel fotográfico (step-and-repeat) com armação | Onde as celebridades posam | 3,0 × 2,4 m, armação de alumínio com sapatas | alta | PLANEJADO |
| Balcão do manobrista | Chaves dos carros, guarda-chuvas | 1,2 × 0,6 × 1,1 m | baixa | PLANEJADO |
| Ponto de ônibus com abrigo e banca de jornal | Vida da cidade fora da gala; esconderijo visual | abrigo 4 × 1,5 × 2,6 m; banca 2,5 × 1,5 × 2,4 m | alta | PLANEJADO |
| Lixeiras, parquímetros, hidrante, placas e semáforos | Mobiliário urbano que dá escala | lixeira Ø 0,45 × 0,9 m | baixa | PLANEJADO |

### Objetos de cena

Sacos de lixo, copos descartáveis, garrafas, panfletos no chão e colados em postes, bitucas, cartazes lambe-lambe, grades de árvore, bicicletas presas a postes, cones, barreiras de imprensa, cabos de TV, holofotes no chão.

### Pessoas

Fãs atrás das grades, fotógrafos, imprensa, fila com convite, recepcionistas, motoristas, manobristas, seguranças da rua, a celebridade posando.

### Regras de jogo

A calçada e a escadaria continuam com a mesma altura e colisão (`floorY`); a fila, o portão do tapete, a barraca do revendedor e os carros da fuga ficam onde estão. Mobiliário urbano novo com colisão entra como `fixture` na seção da rua de `baseProps()` e passa no teste de proteção.

### Vistas de aceite

Geral da avenida ao nível dos olhos; fachada com a cidade atrás; detalhe da calçada a 1 m (panfletos, bitucas, juntas); vitrines de loja de perto; vista alta (drone) mostrando a quadra e o skyline.

## Estudo da área

A rua é a primeira imagem do jogo: a jogadora nasce na calçada de lá, entre os fãs e a barraca do revendedor, e olha um
museu de 1931 numa avenida de cidade grande na noite de uma gala. O que uma avenida dessas tem de verdade, e por quê:

**A quadra em frente.** Avenida de museu é avenida de prédio residencial antigo com comércio fino no térreo: calcário
pré-guerra (11 andares, peitoril e verga de pedra com aduela, sacadinha de ferro no 2º andar, cornija pesada), tijolo
(7 andares, ar-condicionado de janela, verga clara, cornija de chapa), *loft* de ferro fundido pintado (6 andares, vãos de
1,9 × 2,55 m entre colunas com capitel), art déco (15 andares, pilares verticais salientes, coroamento escalonado com luz de
aviso) e uma torre moderna de concreto e vidro (23 andares, sacadas com guarda-corpo de vidro). Térreo de 4,3–5 m: vão de
loja de 3,4 m com caixilho (rodapé de granito de 48 cm, peitoril, montantes, travessa da bandeira a 2,72 m), porta de vidro
de 1,05 m com puxador, letreiro na faixa acima do vão (caixa de luz ou neon) e, em quem tem, toldo de lona de 1 m de
balanço com sanefa. Andares de 3,1–3,7 m; janelas de 1,0–1,25 × 1,75–1,95 m (2,6 × 2,2 na torre), em vão de verdade
(parede de 30 cm, vidro recuado 17 cm).

**As lojas (todas fictícias).** Em frente ao museu, onde a câmera mais olha, a butique de alta costura **Maison Verane**
(manequins com vestido longo, arara de peças, nichos em arco) — é uma gala de moda; ao lado a joalheria **Opaline**
(balcões de vidro com bandeja acesa) e a perfumaria **Éter**; na esquina o **Bistrô 1957** e a floricultura **Íris Flores**
(baldes de flores na calçada); a **Farmácia Avenida 24 h** com a cruz verde em neon (a única aberta de madrugada sempre tem
uma); a **Padaria Estrela**; o **Café Lumen** em neon; uma loja fechada com a porta de enrolar coberta de lambe-lambe
("ALUGA-SE"); a **Livraria Vespertina**, a **Ótica Claridade** e a **Galeria Nove** na torre; do lado do museu, depois do
beco, o **Bar Alvorada** (neon rosa) e a **Sapataria Prima**; portarias residenciais com marquise e saguão de mármore.

**O fundo.** Ruas transversais nas duas pontas da quadra (o museu fica numa avenida em T: as transversais só descem para o
sul), com semáforo de braço sobre a avenida, semáforo de pedestre, armário do controlador cheio de cartaz e a placa com o
nome das ruas. Skyline em três camadas: a fileira da avenida (perto), torres a 120–230 m (meio) e a 250–430 m (longe), com
janelas acesas em padrão irregular (andar de escritório inteiro aceso, apartamento salpicado), mastros e luzes vermelhas
de aviso piscando. A névoa da cena apagaria tudo depois de 150 m, então o skyline tem névoa própria.

**A calçada suja.** Calçada de cidade grande na noite de um evento: panfletos de festa, show, aula de tango, gato perdido,
liquidação e o programa da própria gala (perto da fila); bitucas onde se espera e se fuma — em volta das lixeiras, no ponto
de ônibus, na banca, na fila, na porta do bistrô e do café, na sarjeta, perto do revendedor; chiclete pisado (mancha
escura, chata), copo de café, saco amassado, garrafa, folha juntada embaixo das árvores e na sarjeta, poça rasa que reflete
a rua na beira do meio-fio e manchas de óleo na pista. Nada disso cai no tapete nem na escadaria: a produção da gala limpa
o tapete.

**Mobiliário urbano.** Ponto de ônibus com abrigo de 4 × 1,4 × 2,5 m (vidro temperado, faixa jateada a 1,45 m para ninguém
trombar, banco de ripas, painel de anúncio aceso — aqui o pôster da própria gala —, mapa da linha e a placa "PONTO" com as
linhas): esconderijo visual de quem espera; banca de jornal de 2,5 × 1,5 × 2,4 m (chapa verde, beiral, revistas acesas no
balcão, cartazes nas laterais); lixeira de aço Ø 0,46 × 0,95 m com saco preto; parquímetro de 1,55 m; paraciclo de três
arcos com bicicletas presas; caixas de jornal; placa de proibido estacionar do evento; postes: lanterna de ferro fundido de
4,55 m do lado do museu (luz quente) e luminária de LED de 8 m com braço sobre a pista do lado da cidade (luz fria) — a
mistura de temperatura de cor é a da cidade real e dá o contraste quente × azul-petróleo.

**Os móveis únicos da entrada da gala (Z01).** Bancos esculpidos em granito (2,4 × 0,6 × 0,45 m, assento boleado sobre dois
blocos recuados, inscrição "MUSEU VESPER · MCMXXXI") encostados no embasamento das alas — é onde quem espera senta; vasos
monumentais de pedra (Ø 0,9 × 1,06 m mais o buxo podado em bola, 1,9 m no total) com a luz embutida no chão, marcando as
pontas das arquibancadas; totens de latão (Ø 0,3 × 1,05 m) com a face acesa "GALA LUMIÈRE · CONVIDADOS" no portão do
tapete; o painel de fotos (*step-and-repeat*, 3 × 2,4 m) com a treliça de alumínio, sapatas e sacos de areia, tapete vermelho
na frente e dois refletores com sombrinha — é onde quem chega posa antes de entrar; e o balcão do manobrista (1,2 × 0,6 ×
1,1 m, laca preta e latão, quadro de chaves com porta de vidro, luminária, porta-guarda-chuvas) no meio-fio, onde as
limusines param. Na fachada: almofadas em relevo com moldura nos pedestais encostados e no ático, fiada de dentículos sob a
cornija, placas de bronze fundido nos pedestais dos pares soltos (nome do museu; entrada da gala), portas com almofada de
bronze embaixo e puxador vertical de latão, e os refletores de fachada visíveis na frente das arquibancadas (a fonte da luz
âmbar que sobe pelas colunas).

## Implementado

Capturas em `scratchpad/gala/areas/rua/` (laboratório `/lab/heist-rua`, presets `?cam=` novos: `cidade`, `calcada`,
`vitrines`, `drone` refeito; `low` para iterar, `final-*-high.jpg` na rodada final). O log de cada captura traz a contagem de
um quadro inteiro separada por passada (`passes`: cena, reflexo da pista, mapas de sombra, pós), em chamadas/triângulos.

| Item | Arquivo e função | Captura | Estado |
| --- | --- | --- | --- |
| Quadra em frente ao museu: 6 prédios desenhados (calcário pré-guerra, tijolo, *loft* de ferro fundido, art déco com coroamento, torre de concreto e vidro); janelas em vão real (parede de 30 cm, vidro recuado com a variante acesa/apagada do atlas), caixilho, peitoril e verga de pedra com aduela, frisos, cornija, platibanda, ar-condicionado, sacadinha de ferro, sacadas com guarda-corpo de vidro, casa de máquinas, caixa d'água e antena com luz de aviso | `exterior-blocks.ts` → `cityPlan`, `buildBuilding`, `upperDetailed`; `exterior-city.tsx` → `HeistCity`; `exterior-citytex.ts` → `windowAtlas` | `final-cidade-high.jpg`, `r3-cidade-low.jpg` | IMPLEMENTADO |
| Térreos com lojas (16 ramos fictícios): vão de 3,4 m com caixilho de bronze ou preto, rodapé de granito, porta de vidro com puxador, bandeira, vidro recuado, interior (parede do fundo do ramo, laterais, teto com spots, piso), letreiro em caixa de luz ou neon, toldo com sanefa e abas, móveis por ramo (manequins com vestido longo e arara na Maison Verane; balcões de vidro na Opaline e na Éter; mesas e cadeiras no café, bistrô e bar; prateleiras na farmácia, livraria e sapataria; vitrine de pães; baldes de flores na calçada; escultura na galeria), loja fechada com porta de enrolar, cadeado e lambe-lambe, portarias com marquise e saguão | `exterior-blocks.ts` → `shop`, `shopProps`, `lobby`; `exterior-citytex.ts` → `interiorAtlas`, `signAtlas`, `SHOPS` | `final-vitrines-high.jpg`, `r2-vitrines-low.jpg` | IMPLEMENTADO |
| Resto da cidade: a avenida segue até x ±140 com prédios dos dois lados (os de longe com parede lisa e janela rente), ruas transversais em T (pista, calçadas, meio-fio, faixas de pedestres nas esquinas) com prédios até z 170, fachadas laterais das esquinas | `exterior-blocks.ts` → `run`, `sideFace`; `exterior-street.tsx` → `useGround`, `crossRoadGeometry` | `final-drone-high.jpg`, `final-cidade-high.jpg` | IMPLEMENTADO |
| Skyline em camadas (torres a 120–230 m e 250–430 m, janelas acesas irregulares, coroamentos, mastros, luzes de aviso piscando), com névoa própria e fora do reflexo da pista (camada 1) | `exterior-skyline.tsx` → `HeistSkyline`, `OnSkyLayer`; `exterior-citytex.ts` → `skylineTex` | `final-cidade-high.jpg`, `final-drone-high.jpg` | IMPLEMENTADO |
| Calçada suja: 320 panfletos (16 desenhos fictícios num atlas, um por instância; programas da gala perto da fila), 520 bitucas concentradas em lixeiras, ponto, banca, fila, bistrô, café, sarjetas e revendedor, 220 chicletes, copos, sacos, garrafas, 320 folhas, 12 poças rasas com reflexo, 46 manchas; nada no tapete nem na escadaria (9 chamadas de desenho) | `exterior-litter.tsx` → `HeistLitter` | `final-calcada-high.jpg`, `r2-calcada-low.jpg` | IMPLEMENTADO |
| Mobiliário urbano com colisão (fixtures da rua em `baseProps()`): ponto de ônibus com abrigo (vidro, faixa jateada, banco de ripas, painel aceso com o pôster da gala, mapa da linha, placa), banca de jornal, 5 lixeiras, 4 parquímetros, paraciclo com 2 bicicletas, caixas de jornal, placa de proibido estacionar | `exterior-furniture.tsx` → `busShelter`, `newsstand`, `bin`, `meter`, `bikeRack`, `newsBoxes`, `noParking`; `lib/heist/level.ts` (seção da rua, `RF(...)`) | `final-calcada-high.jpg`, `final-cidade-high.jpg` | IMPLEMENTADO |
| Fora da área andável: semáforos de braço sobre a avenida (cabeças viradas para a rua), semáforo de pedestre, armário do controlador com cartazes, placas AV. VESPER / R. ORVALHO | `exterior-furniture.tsx` → `signal`, `cabinet` | `final-cidade-high.jpg` | IMPLEMENTADO |
| Móveis únicos da entrada (Z01): bancos de granito com inscrição, vasos monumentais com buxo e luz embutida, totens acesos no portão do tapete, painel de fotos com treliça, sapatas, sacos de areia e tapete, refletores com sombrinha, balcão do manobrista | `exterior-furniture.tsx` → `stoneBench`, `urn`, `totem`, `stepRepeat`, `lightStand`, `valetStand`; `lib/heist/level.ts` | `final-entrada-high.jpg`, `final-escadaria-high.jpg`, `final-avenida-high.jpg` | IMPLEMENTADO |
| Fachada com mais relevo: almofadas com moldura nos pedestais encostados e no ático, dentículos sob a cornija, placas de bronze fundido nos pedestais dos pares soltos, portas com almofada de bronze e puxador vertical, refletores de fachada visíveis na frente das arquibancadas (a fonte dos holofotes) | `exterior-facade.tsx` → `useFacadeGeometry`, `FrontDoors`, `Banners`; `exterior-street.tsx` → `useRisers`; `exterior-textures.ts` → `plaqueTex` | `final-avenida-high.jpg`, `final-escadaria-high.jpg`, `final-entrada-high.jpg` | IMPLEMENTADO |
| Luz: lanternas de ferro fundido (quentes) do lado do museu e luminárias de LED de 8 m (frias) do lado da cidade; luz das vitrines e portarias como âncoras da luz de verdade (as 3/2 mais perto da câmera) e poças de luz na calçada; neons com halo | `exterior-street.tsx` → `streetLights`, `useLamps`; `exterior-fx.tsx` → `ExteriorLights` | `final-avenida-high.jpg`, `final-vitrines-high.jpg` | IMPLEMENTADO |
| Desempenho: halos e poças numa chamada cada (`GlowField`, `PoolField`), carros fundidos por material (de ~80 para ~15 chamadas), banners e placas em lote, rastros do "low" numa instância, skyline e parque fora do reflexo da pista | `exterior-glow.tsx`; `exterior-vehicles.tsx`; `exterior-facade.tsx`; `exterior-street.tsx`; `exterior-fx.tsx` | contagem no log das capturas | IMPLEMENTADO |

**Pendências e pedidos a outras áreas**

- A rua com gente só aparece no jogo (`/lab/heist?shot=…`); o laboratório da rua não carrega as pessoas.
- O prédio de tijolo depois do beco (x 30…46) agora tem 5 andares (16,7 m + platibanda) com a fachada sul em lojas (Bar
  Alvorada, Sapataria Prima); a face oeste (parede do beco, x = 30) continua lisa para o agente do beco vestir.
- O portão de enrolar da doca continua desenhado na fachada (`DockGate`); se a área da doca desenhar o portão por dentro,
  combinar para não duplicar a folha.
