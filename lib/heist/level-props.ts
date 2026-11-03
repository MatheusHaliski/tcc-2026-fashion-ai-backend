/* MET Gala Heist v2 — móveis e peças fixas de cada sala (baseProps): colisão, o que esconde quem está agachado e o que bloqueia a visão. */
import type { Prop, PropKind, RoomId, Shape } from "./types";

const box = (x0: number, z0: number, x1: number, z1: number): Shape => ({ type: "box", x0, z0, x1, z1 });
const circ = (x: number, z: number, r: number): Shape => ({ type: "circle", x, z, r });

/** Móveis e peças fixas. Colunas, estantes, araras, risers e carros bloqueiam a visão; mesas, cordas e grades só escondem
 * quem está agachado; o vidro das vitrines bloqueia o passo, não o olhar. */
export function baseProps(): Prop[] {
  let seq = 0;
  const out: Prop[] = [];
  const P = (kind: PropKind, room: RoomId, shape: Shape, height: Prop["height"], yaw?: number, variant?: number) => out.push({ id: `${kind}-${++seq}`, kind, room, shape, height, yaw, variant });
  /* rua: escadaria com tapete, cercados de fotógrafos e imprensa, fila, carros, grades dos fãs e a barraca do revendedor */
  P("rope", "rua", box(-2.6, 24.5, -2.4, 31), "low"); P("rope", "rua", box(2.4, 24.5, 2.6, 31), "low");
  P("rope", "rua", box(-6, 31, -1.5, 31.5), "low"); P("rope", "rua", box(1.5, 31, 6, 31.5), "low");
  P("riser", "rua", box(-12, 24.5, -6, 31), "tall", 0, 0);                       // arquibancada dos fotógrafos
  P("riser", "rua", box(6, 24.5, 12, 31), "tall", 0, 1);                         // imprensa e TV
  P("rope", "rua", box(2, 32.6, 15, 32.8), "low");                               // fila (cordão do lado do meio-fio)
  P("podium", "rua", circ(-2.3, 32.1, 0.35), "low");
  P("limo", "rua", box(-9, 33.6, -3, 35.4), "tall", Math.PI / 2, 0); P("limo", "rua", box(4, 33.6, 10, 35.4), "tall", Math.PI / 2, 1);
  P("cateringTruck", "rua", box(-22, 33.6, -15, 36.2), "tall", -Math.PI / 2);
  P("policeCar", "rua", box(18, 33.6, 23, 35.6), "tall", Math.PI / 2);
  P("suv", "rua", box(12, 40.8, 17, 42.6), "tall", -Math.PI / 2);
  P("getawayCar", "rua", box(-30, 36.9, -26, 38.9), "tall", Math.PI / 2);
  for (const [x0, x1] of [[-30, -29], [-25, 30]]) P("barrier", "rua", box(x0, 43.15, x1, 43.45), "low");
  for (const x of [-27, -19, -12.5, 15.5, 23.5]) P("lampPost", "rua", circ(x, 32.7, 0.18), "tall");
  for (const x of [-23, -13, -3, 7, 17, 27]) P("lampPost", "rua", circ(x, 43.75, 0.18), "tall");
  for (const [x, z] of [[-27, 27], [19.6, 31.3], [27.5, 31.6], [-8, 46.8], [10, 47]]) P("tree", "rua", circ(x, z, 0.7), "tall");
  P("hydrant", "rua", circ(-10.5, 43.9, 0.2), "low");
  P("vendorStand", "rua", box(-30, 47.6, -26.4, 50.4), "tall");
  /* rua, móveis próprios (exterior-furniture.tsx desenha pelo model): ponto de ônibus com abrigo (vidro do fundo, painel de
   * anúncio, vidro lateral, banco e a placa), banca de jornal, lixeiras, parquímetros, paraciclo, caixas de jornal, placa de
   * proibido estacionar e os únicos da entrada da gala — bancos de granito, vasos monumentais, painel de fotos com os
   * refletores e o balcão do manobrista. Do lado de lá a frente dá para a avenida (giro π). */
  const RF = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "rua", shape, height, yaw });
  RF("busShelter", box(-15.6, 50.15, -11.6, 50.4), "glass", Math.PI);
  RF("busShelterAd", box(-15.6, 48.9, -15.45, 50.4), "tall", Math.PI);
  RF("busShelterSide", box(-11.75, 49.6, -11.6, 50.4), "glass", Math.PI);
  RF("busShelterBench", box(-14.9, 49.85, -12.3, 50.15), "low", Math.PI);
  RF("busStopSign", circ(-16.3, 49.0, 0.08), "low", Math.PI);
  RF("newsstand", box(19.4, 48.6, 21.9, 50.1), "tall", Math.PI);
  for (const [x, z] of [[-10.9, 49.8], [2.2, 49.9], [18.6, 49.9], [-13.5, 32.45], [20.6, 32.55]]) RF("bin", circ(x, z, 0.24), "low");
  for (const x of [-16.2, -22.5, 18.2, 21.8]) RF("meter", circ(x, 32.72, 0.1), "low");   // na beira do meio-fio, fora da linha z 32,6
  RF("bikeRack", box(5.4, 48.85, 8.2, 50.45), "low", Math.PI);
  RF("newsBox", box(-6.2, 49.9, -5.0, 50.4), "low", Math.PI);
  RF("noParking", circ(-20.6, 32.74, 0.06), "low");
  RF("stoneBench", box(-27.2, 24.85, -24.8, 25.45), "low"); RF("stoneBench", box(18.8, 24.85, 21.2, 25.45), "low");
  RF("monumentalVase", circ(-12.75, 25.35, 0.45), "low"); RF("monumentalVase", circ(12.75, 25.35, 0.45), "low");
  RF("stepRepeat", box(14.1, 24.85, 17.3, 25.6), "tall");
  RF("lightStand", circ(13.7, 26.7, 0.3), "low"); RF("lightStand", circ(17.7, 26.7, 0.3), "low");
  RF("valetStand", box(-8.6, 32.1, -7.4, 32.7), "low");
  /* beco: caçambas, a escada de incêndio presa à parede e o carro da fuga do lado leste */
  P("dumpster", "beco", box(28.4, -4, 30, -1.6), "tall"); P("dumpster", "beco", box(28.4, 14, 30, 16.4), "tall");
  P("fireEscape", "beco", box(22.5, -18, 23.1, -15.4), "tall"); P("fireEscape", "beco", box(22.5, -12.6, 23.1, -10), "tall");
  P("getawayCar", "beco", box(26.2, 6, 28.6, 11), "tall", 0, 1);
  // móveis próprios do beco (exterior-alley-props.ts desenha pelo model): fundo de prédio de verdade junto à parede do
  // vizinho (abrigo de gás, tambor de óleo da cozinha, contêineres, lixo, papelão, paletes, condensadora, colchão velho),
  // a coleta seletiva do museu e o totem de embarque da gala na boca do beco. Longe da ronda (x 25–27) e do carro.
  {
    const FB = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "beco", shape, height, yaw });
    FB("becoTotem", box(28.75, 22.6, 29.25, 22.9), "tall");
    FB("becoGasCage", box(28.85, 20.4, 30, 22.4), "glass", -Math.PI / 2);
    FB("becoDrum", circ(29.55, 19.6, 0.3), "low");
    FB("becoBins", box(29.15, 11.6, 30, 13.7), "low", -Math.PI / 2);
    FB("becoTrashPile", box(28.55, -1.45, 30, -0.35), "low", -Math.PI / 2);
    FB("becoCardboard", box(29.2, -7.9, 30, -6.5), "low", -Math.PI / 2);
    FB("becoPallets", box(28.95, -10.4, 30, -8.6), "low", -Math.PI / 2);
    FB("becoCondenser", box(29.15, -15.2, 30, -13.6), "low", -Math.PI / 2);
    FB("becoJunk", box(28.9, -21.6, 30, -19.4), "low", -Math.PI / 2);
    FB("becoRecycling", box(22.5, 18.6, 23.15, 20.6), "low", Math.PI / 2);
  }
  /* vestíbulo: balcão curvo do credenciamento (oeste, de frente para a rua), chapelaria (leste), detector e cordões até
   * o salão, banco de espera sob o nicho sudeste. Móveis próprios (areas/vestibulo*.ts desenha pelo model): a escadaria
   * em U de cada canto norte (sobe 26 degraus de 17 cm à galeria sobre a porta do salão, a 4,42 m), a mesa floral, o
   * aparador das taças de boas-vindas, o painel dos pavimentos e o totem acessível. */
  P("desk", "vestibulo", box(-6, 21.45, -3, 22.25), "low", 0, 1);
  P("coatcheck", "vestibulo", box(5.2, 18.4, 5.8, 22), "low", -Math.PI / 2);
  P("detector", "vestibulo", box(-2.5, 14.6, -2.05, 15.2), "tall"); P("detector", "vestibulo", box(2.05, 14.6, 2.5, 15.2), "tall");
  P("rope", "vestibulo", box(-2.2, 15.6, -2, 19.6), "low"); P("rope", "vestibulo", box(2, 15.6, 2.2, 19.6), "low");
  P("bench", "vestibulo", box(4.3, 23.2, 6.3, 23.8), "low", Math.PI);
  const FV = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "vestibulo", shape, height, yaw });
  FV("vestStair", box(-8, 14.5, -3.9, 17.9), "tall"); FV("vestStair", box(3.9, 14.5, 8, 17.9), "tall");
  FV("vestFloral", circ(3.7, 20.8, 0.7), "low");
  FV("vestConsole", box(-6.3, 23.45, -4.3, 23.95), "low", Math.PI);
  FV("vestDirectory", box(-3.65, 16.9, -2.95, 17.02), "tall");
  FV("vestTotem", box(2.35, 22.4, 2.75, 22.7), "low", -Math.PI / 2);
  /* Grande Salão: colunata, o arranjo floral, mesas altas, palco do quarteto, passarela, telão. A festa ocupa a nave
   * leste (pista de dança sem colisão em x 3,2…9,8 × z 1,5…7,5, com a cabine do DJ e as caixas na parede leste), os
   * patronos jantam na nave oeste e os doces e o bufê ficam nos arcos da parede sul, um de cada lado da porta. */
  for (const x of [-9, -4.5, 4.5, 9]) for (const z of [-1, 10]) P("column", "salao", circ(x, z, 0.5), "tall");
  P("floral", "salao", circ(0, 4.5, 1.6), "tall");
  for (const [x, z] of [[-2.8, 1.2], [-2.6, 9.2], [2.8, 8.8], [6.4, 9.0]]) P("table", "salao", circ(x, z, 0.42), "low", 0, 1);
  P("stage", "salao", box(8.8, -4.6, 11.8, 0.6), "low", -Math.PI / 2, 0);             // passarela (encurtada: a pista ocupa o leste)
  P("screen", "salao", box(3.6, -6, 8.4, -5.6), "tall");
  P("stage", "salao", box(-11.6, 0.5, -9.6, 4.5), "low", Math.PI / 2, 1);
  P("sofa", "salao", box(-11.6, -5, -10.6, -2.5), "low", Math.PI / 2);
  P("planter", "salao", circ(11.3, 13.3, 0.45), "low");
  // móveis próprios da área (areas/salao*.ts desenha pelo model): DJ e caixas, doces, bufê, aparador e mesas dos patronos
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "salao", shape, height, yaw });
    F("djBooth", box(10.0, 3.3, 10.8, 5.7), "low", -Math.PI / 2);                    // tampo a 1,05 m, o DJ atrás (x 11,12)
    F("djSpeaker", box(10.05, 1.85, 10.85, 2.65), "tall", -Math.PI / 2); F("djSpeaker", box(10.05, 6.35, 10.85, 7.15), "tall", -Math.PI / 2);
    F("dessertTable", box(-10, 12.9, -6, 13.9), "low", Math.PI);                       // no arco sudoeste, de frente para o salão
    F("buffetTable", box(5.5, 12.9, 10.5, 13.9), "low", Math.PI);                      // no arco sudeste (torre de champanhe na ponta)
    F("serviceBuffet", box(-11.82, 11.7, -11.24, 13.9), "low", Math.PI / 2);           // aparador dos garçons, junto à porta da equipe
    for (const [x, z] of [[-6.8, -3.5], [-6.6, 2.0], [-6.6, 7.2]]) F("patronTable", circ(x, z, 1.45), "low");   // mesa Ø 1,8 m + 8 cadeiras
  }
  /* lounge e bar: o bar de ônix de Davi (cabeceiras curvas), os dois grupos de estar — sofá capitonê contra a parede,
     mesa baixa, poltronas club e guéridon com abajur —, o piano de cauda (teclado para o norte, banqueta fora da caixa),
     o trumeau no canto noroeste e, como móveis próprios (areas/lounge-mob.ts desenha pelo model), as poltronas, as mesas
     baixas, as quatro banquetas do balcão (o meio fica livre para falar com Davi) e o biombo de laca junto à porta dos
     bastidores */
  P("bar", "lounge", box(19.8, 6.5, 21, 12.5), "low", -Math.PI / 2);
  P("sofa", "lounge", box(13.95, 12.95, 16.65, 13.9), "low", Math.PI); P("sofa", "lounge", box(12.95, 5.75, 13.95, 8.45), "low", Math.PI / 2);
  for (const [x, z, r] of [[15.72, 7.03, 0.3], [17.0, 13.35, 0.25]]) P("table", "lounge", circ(x, z, r), "low", 0, 1);
  P("mirror", "lounge", box(12.5, 4.6, 14, 4.9), "tall", 0, 1);
  P("piano", "lounge", box(17.6, 12.3, 19.1, 13.9), "low", Math.PI);
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "lounge", shape, height, yaw });
    F("loungeArmchair", box(15.3, 5.75, 16.15, 6.6), "low", -Math.PI / 2); F("loungeArmchair", box(15.3, 7.45, 16.15, 8.3), "low", -Math.PI / 2);
    F("loungeArmchair", box(16.3, 11.75, 17.1, 12.55), "low", -Math.PI / 2);
    F("loungeCoffee", box(14.35, 6.45, 14.95, 7.75), "low", Math.PI / 2); F("loungeCoffee", box(14.6, 11.85, 16.0, 12.45), "low");
    for (const z of [6.95, 8.2, 10.8, 12.05]) F("loungeStool", circ(19.42, z, 0.21), "low");
    F("loungeScreen", box(18.7, 4.75, 20.3, 5.15), "tall");
  }
  /* bastidores: três penteadeiras com as cadeiras de maquiagem (a caixa baixa inclui as cadeiras), mesa da produção,
     monitores, vaporizador, manequins do ateliê e, como móveis próprios (areas/bastidores-moveis.ts), a bancada de
     costura, o carrinho de acessórios, a pilha de cases e as cadeiras de diretor da produção */
  P("mirror", "bastidores", box(21.75, -3.3, 22, 1.2), "tall", -Math.PI / 2); P("desk", "bastidores", box(20.55, -3.3, 21.75, 1.2), "low", -Math.PI / 2, 4);
  P("desk", "bastidores", box(14.4, 1.8, 16.8, 2.8), "low", 0, 2);
  P("desk", "bastidores", box(18.6, -5.6, 21.4, -4.8), "low", Math.PI, 1); P("screen", "bastidores", box(18.6, -6, 21.4, -5.7), "tall", 0, 1);
  P("steamer", "bastidores", circ(17.6, -1.8, 0.3), "low");
  for (const [x, z] of [[14.95, -5.2], [13.0, -3.85], [13.9, -3.85]]) P("mannequin", "bastidores", circ(x, z, 0.32), "tall");
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw: number) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "bastidores", shape, height, yaw });
    F("bkSewing", box(12.6, -6, 14.3, -5.3), "low", 0);                          // bancada de costura do ateliê
    F("bkAccCart", box(13.5, -0.25, 14.0, 0.65), "low", Math.PI / 2);            // carrinho de acessórios (sapatos, chapéus, joias de cena)
    F("bkCases", box(20.3, 3.0, 21.95, 3.95), "tall", Math.PI);                  // cases de estrada empilhados (frente para a sala)
    for (const x of [19.35, 20.65]) F("bkChair", circ(x, -4.25, 0.28), "low", Math.PI);   // cadeiras de diretor diante dos monitores
  }
  /* Instituto do Traje (exposição "Aurora"): vitrines com manequins vestidos (o Aurora no eixo, as das alas e as de
     parede com chapéus, luvas e leques), o banco escultural, as cópias em gesso que ladeiam o nicho (variante 0) e os
     dois vestidos-escultura junto à parede sul (1 pétalas, 2 plissê). Móveis próprios (areas/galeria-props.ts desenha
     pelo model): a vitrine circular de joia (ala oeste, seção das joias), a mesa de croquis (ala leste, ateliê) e, junto
     ao vão do salão, o atril de catálogos e o totem do audioguia. */
  P("case", "galeria", box(-1, -18, 1, -16), "glass", 0, 1);
  P("case", "galeria", box(-7.4, -15.4, -5.6, -13.6), "glass", 0, 0); P("case", "galeria", box(5.6, -15.4, 7.4, -13.6), "glass", 0, 2);
  for (const [x0, z0, x1, z1] of [[-11.6, -20, -10.4, -18], [10.4, -20, 11.6, -18], [-11.6, -11, -10.4, -9], [10.4, -11, 11.6, -9]]) P("case", "galeria", box(x0, z0, x1, z1), "glass", 0, 3);
  P("bench", "galeria", box(-2, -11.4, 2, -10.8), "low");
  for (const [x, z, v] of [[-3.5, -20.5, 0], [3.5, -20.5, 0], [-9, -7.6, 1], [9, -7.6, 2]]) P("statue", "galeria", circ(x, z, 0.45), "tall", 0, v);
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "galeria", shape, height, yaw });
    F("jewelVitrine", circ(-6.5, -19.0, 0.5), "glass");                                 // Ø 1,0 × 1,8 m, seção III (joias)
    F("sketchTable", box(5.5, -10.45, 7.5, -9.55), "low", Math.PI);                      // 2,0 × 0,9 × 0,9 m, croquis lidos do norte
    F("catalogStand", box(-4.9, -7.57, -4.4, -7.03), "low", Math.PI / 2);                // atril (1,05 m) lido de leste
    F("audioGuide", box(4.4, -7.57, 4.9, -7.03), "low", -Math.PI / 2);                   // totem (1,1 m) lido de oeste
  }
  /* Sala das Joias: o pedestal do diamante no centro, vitrines de joias nas paredes (a do vão da janela é baixa, de tampo
     inclinado) e, no lado sul, a conservação (areas/cofre-props.ts desenha pelo model): mesa de restauração e estação
     fotográfica a leste do duto, mapoteca e carrinho de acervo a oeste — o corredor diante do duto (x −19,4…−16,2) fica
     livre para quem sai do labirinto */
  P("pedestal", "cofre", circ(-17.25, -14.25, 0.55), "glass");
  for (const [x0, z0, x1, z1] of [[-21.6, -20, -21, -17], [-21.6, -12, -21, -9], [-14.2, -21.6, -12.9, -21], [-20.4, -21.6, -19.1, -21.2]]) P("case", "cofre", box(x0, z0, x1, z1), "glass", 0, 4);
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "cofre", shape, height, yaw });
    F("restorationTable", box(-16.2, -8.15, -14.4, -7.25), "low", Math.PI);           // 1,8 × 0,9 × 0,9 m, o lado de trabalho para o norte
    F("photoStation", box(-13.9, -8.3, -12.8, -7.0), "low", Math.PI);                 // mesa com o reprodutor fotográfico
    F("flatFiles", box(-21.75, -7.55, -20.25, -6.55), "low", Math.PI);                // mapoteca 1,5 × 1,0 × 1,0 m, gavetas para o norte
    F("collectionCart", box(-20.05, -7.75, -19.45, -6.65), "low", Math.PI / 2);       // carrinho de acervo encostado na parede
  }
  /* labirinto de serviço: a copa do bufê nas pontas mortas e no ramal noroeste, que não leva a lugar nenhum (desenho em
     areas/servico-copa.ts). Nenhum fecha caminho: nos corredores, no máximo 0,45 m da parede (o centro fica livre). */
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw: number) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "servico", shape, height, yaw });
    F("srvRange", box(-19.85, -6, -18.65, -5.3), "low", 0);                      // fogão de seis bocas com forno e coifa (ponta 1,0)
    F("srvFridge", box(-19.3, 0.15, -18.5, 1.35), "tall", -Math.PI / 2);         // geladeira comercial de duas portas (ponta 1,3)
    F("srvPrep", box(-16.95, -3.9, -16.5, -0.6), "low", -Math.PI / 2);           // bancada estreita de preparo (0,45 m)
    F("srvShelving", box(-22, -1.95, -21.55, -0.55), "tall", Math.PI / 2);       // estante de inox com cubas e pratos
    F("srvHandSink", box(-19.5, -0.92, -19.0, -0.5), "low", Math.PI);            // pia de lavar as mãos
    F("srvPass", box(-16, 6.0, -15.3, 7.5), "low", Math.PI / 2);                 // pass aquecido com os canapés (ponta 3,6)
    F("srvGlassTower", box(-14.0, 6.0, -13.5, 6.5), "low", 0);                   // torre de racks de taças
    F("srvCart", box(-13.15, 6.04, -12.55, 6.79), "tall", 0);                    // carro-bandejeiro
    F("srvBar", box(-16, 10.0, -14.5, 10.65), "low", 0);                         // estação de coquetelaria (ponta 3,8)
    F("srvDish", box(-15.2, 0.0, -14.5, 1.5), "low", -Math.PI / 2);              // lavagem com a ducha de pré-enxágue (ponta 3,3)
  }
  /* sala de segurança: console de monitores na parede oeste (de frente para o posto do chefe), cofre do cartão, quadro de
     luz e, como móveis próprios (areas/seguranca.ts), a mesa de coordenação, os racks ventilados e o armário do café */
  P("monitor", "seguranca", box(-22, 5.5, -21.2, 7.5), "low", Math.PI / 2);
  P("safe", "seguranca", box(-20.2, 2.05, -19.2, 2.6), "low", 0);
  P("panel", "seguranca", box(-22, 4.2, -21.7, 5.3), "tall", Math.PI / 2);
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw: number) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "seguranca", shape, height, yaw });
    F("segCoord", box(-21.2, 6.7, -19.6, 7.5), "low", Math.PI);                  // mesa de coordenação com rádios e headsets
    F("segRack", box(-22, 2.0, -20.8, 3.0), "tall", 0);                          // dois racks ventilados com portas
    F("segCafe", box(-19.1, 6.95, -18.5, 7.5), "low", Math.PI);                  // armário do café
  }
  /* doca: chegada do bufê, da produção do desfile e das obras. Móveis próprios (areas/doca-props.ts desenha pelo model):
   * estantes de aço e a bancada de conferência na parede norte, a guarita da portaria na oeste (entre a porta de serviço
   * e o portão), os flight cases no meio (cobertura dentro do circuito da Sônia), a empilhadeira patolada (carregando),
   * a paleteira carregada e os carros térmicos junto à parede sul, o bebedouro e os paletes vazios nos cantos. A caixa alta que ficou é a caixa de obra do
   * museu (o esconderijo da doca fica diante dela). */
  P("crate", "doca", box(-11, 22.6, -9.6, 23.8), "tall");
  {
    const FD = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "doca", shape, height, yaw });
    FD("docaShelf", box(-17.2, 16.55, -15.2, 17.15), "tall"); FD("docaShelf", box(-15, 16.55, -13, 17.15), "tall");
    FD("docaBench", box(-12.6, 16.55, -10.6, 17.35), "low");
    FD("docaFountain", box(-8.95, 16.95, -8.55, 17.35), "low", -Math.PI / 2);
    FD("docaBooth", box(-22, 19.6, -20.4, 21.2), "tall", Math.PI / 2);
    FD("docaPallets", box(-21.95, 16.6, -20.75, 17.6), "low");
    FD("docaFlightCases", box(-13, 20, -11.8, 20.6), "tall");
    FD("docaPalletJack", box(-14.4, 23, -12.75, 24), "low");
    FD("docaStacker", box(-16.3, 23.26, -14.6, 24), "low");                      // empilhadeira patolada, atrás da arara rack-d1
    FD("docaHotBoxes", box(-9.55, 23.25, -8.55, 23.95), "tall", Math.PI);
  }
  /* terraço (jardim da cobertura): jardineiras escultóricas, o sofá de fibra do estar sob o pergolado (de frente para a
     mesa de fogo e para o norte), o banco de contemplação diante do totem e, como móveis próprios (areas/terraco*.ts
     desenha pelo model), a mesa de fogo, as poltronas e os pilares do pergolado, a mesa panorâmica de drinks no deck do
     canto nordeste, o totem de arte luminosa, o conjunto de bistrô e os canteiros elevados junto às paredes. A ronda da
     Bia (x 14,5 e 19,25; z −9 e −17) e a saída da escada de incêndio ficam livres. */
  P("planter", "terraco", circ(14, -20.5, 0.6), "low"); P("planter", "terraco", circ(20.8, -8, 0.6), "low"); P("planter", "terraco", circ(14, -8, 0.6), "low");
  P("sofa", "terraco", box(15.6, -11.35, 18.2, -10.45), "low", Math.PI);
  P("bench", "terraco", box(16.0, -19.45, 18.0, -18.95), "low", Math.PI);
  {
    const F = (model: string, shape: Shape, height: Prop["height"], yaw = 0) => out.push({ id: `${model}-${++seq}`, kind: "fixture", model, room: "terraco", shape, height, yaw });
    F("terracoFire", box(16.25, -12.75, 17.55, -11.95), "low");
    F("terracoChair", box(15.7, -14.35, 16.5, -13.55), "low"); F("terracoChair", box(17.3, -14.35, 18.1, -13.55), "low");
    for (const [x, z] of [[15.25, -14.75], [18.55, -14.75], [15.25, -10.1], [18.55, -10.1]]) F("terracoPost", circ(x, z, 0.09), "tall");
    F("terracoDrinks", box(21.0, -21.1, 21.8, -18.1), "low", -Math.PI / 2);
    F("terracoUrn", circ(21.55, -16.2, 0.15), "low");                              // cinzeiro de pé junto à saída
    F("terracoTotem", circ(17.0, -20.9, 0.32), "tall");
    F("terracoBistro", circ(21.1, -10.9, 0.32), "low");
    F("terracoCafeChair", circ(21.1, -11.62, 0.24), "low", 0); F("terracoCafeChair", circ(21.1, -10.18, 0.24), "low", Math.PI);
    F("terracoBed", box(12.55, -21.65, 13.25, -17.3), "low", Math.PI / 2); F("terracoBed", box(12.55, -12.7, 13.25, -6.85), "low", Math.PI / 2);
    F("terracoBed", box(13.3, -7.15, 15.2, -6.55), "low", Math.PI); F("terracoBed", box(18.8, -7.15, 21.8, -6.55), "low", Math.PI);
  }
  return out;
}
