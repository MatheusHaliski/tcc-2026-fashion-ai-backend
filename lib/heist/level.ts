/*
 * MET Gala Heist v2 — planta do Museu Vesper na noite da Gala Lumière (ficcional). O jogo começa do outro lado da avenida,
 * entre os fãs, e o diamante de Celine Dion está na Sala das Joias, no fundo do prédio.
 *
 *  z −23 ═══════════════════ beiral (cornija externa) ═══════════════════
 *  z −22 ┌─janela──┬──────────────────────┬──janela──┐┌──────┐
 *        │  SALA   │  INSTITUTO DO TRAJE  │ TERRAÇO  ││      │ escada de incêndio
 *        │DAS JOIAS│  (exposição)         │ JARDIM   ├┤ BECO │ (só escalando)
 *  z −6  ├──duto───┼───────┤vão├──────────┼─equipe───┤│      │
 *        │LABIRINTO│                      │BASTIDORES││      │
 *        │   DE    │    GRANDE SALÃO      ├─porta────┤│      │
 *        │ SERVIÇO │ (arranjo floral)     │ LOUNGE   ││      │
 *  z 14  │ (sala da├────┤detector├────────┤ E BAR    ││      │
 *  z 16  ├─teclado─┤  VESTÍBULO E         └──────────┘│      │
 *        │  DOCA   │  CREDENCIAMENTO                  │      │
 *  z 24  └─portão──┴─────portas──────────────────────────────┘
 *  z 24.5          ESCADARIA (tapete, fotógrafos, imprensa)    calçada
 *  z 31            portão do tapete (recepcionista) · fila ─────
 *  z 33  ═══ meio-fio ═══ limusines ═══ caminhão do bufê ═══ viatura
 *  z 43  ═══ grades ═══ fãs ═══ (faixa de pedestre a oeste)
 *  z 50  barraca do revendedor · ponto de partida
 *       x −30      −22      −12       0        12       22   30
 *
 * Alturas: o prédio inteiro fica em y = 0; a calçada em −1,6 e a pista em −1,75. A escadaria sobe da calçada até as
 * portas e a doca tem uma rampa até a rua (floorY). Paredes internas do labirinto vêm de uma geração com semente
 * (sempre a mesma) com alguns laços, para haver mais de um caminho e rotas de ronda.
 */
import type { CivSpawn, DoorDef, GuardSpawn, InteractDef, Prop, PropKind, Rect, Room, RoomId, Shape, Vec, VendorId, VendorOffer } from "./types";
import { mulberry } from "./math";

/** Ordem importa: a sala de segurança (dentro do labirinto) vem antes do serviço; roomAt devolve a primeira que contém. */
export const ROOMS: Room[] = [
  { id: "seguranca", rect: { x0: -22, z0: 2, x1: -18.5, z1: 7.5 }, access: "private", floor: "concrete", tier: 7 },
  { id: "servico", rect: { x0: -22, z0: -6, x1: -12.5, z1: 16 }, access: "staff", floor: "concrete", tier: 7 },
  { id: "cofre", rect: { x0: -22, z0: -22, x1: -12.5, z1: -6.5 }, access: "private", floor: "marble", tier: 9 },
  { id: "galeria", rect: { x0: -12, z0: -22, x1: 12, z1: -6.5 }, access: "public", floor: "parquet", tier: 5 },
  { id: "terraco", rect: { x0: 12.5, z0: -22, x1: 22, z1: -6.5 }, access: "public", floor: "stone", tier: 6, outdoor: true },
  { id: "bastidores", rect: { x0: 12.5, z0: -6, x1: 22, z1: 4 }, access: "staff", floor: "parquet", tier: 6 },
  { id: "lounge", rect: { x0: 12.5, z0: 4.5, x1: 22, z1: 14 }, access: "public", floor: "carpet", tier: 5 },
  { id: "salao", rect: { x0: -12, z0: -6, x1: 12, z1: 14 }, access: "public", floor: "marble", tier: 4 },
  { id: "vestibulo", rect: { x0: -8, z0: 14.5, x1: 8, z1: 24 }, access: "public", floor: "marble", tier: 3 },
  { id: "doca", rect: { x0: -22, z0: 16.5, x1: -8.5, z1: 24 }, access: "staff", floor: "concrete", tier: 4 },
  { id: "beiral", rect: { x0: -21, z0: -23.5, x1: 21, z1: -22.5 }, access: "private", floor: "stone", tier: 7, outdoor: true },
  { id: "beco", rect: { x0: 22.5, z0: -22, x1: 30, z1: 24.5 }, access: "street", floor: "asphalt", tier: 3, outdoor: true },
  { id: "rua", rect: { x0: -30, z0: 24.5, x1: 30, z1: 50.5 }, access: "street", floor: "sidewalk", tier: 3, outdoor: true },
];

/** Luz de cada sala (0–1): no escuro, quem está longe é reconhecido mais devagar (MH-06-03). A Sala das Joias fica na
 * penumbra quando o quadro de luz é cortado. */
export const ROOM_LIGHT: Record<RoomId, number> = {
  rua: 0.95, beco: 0.4, vestibulo: 1, salao: 0.85, galeria: 0.65, lounge: 0.7, terraco: 0.5, beiral: 0.3, bastidores: 0.9,
  servico: 0.55, seguranca: 0.9, doca: 0.6, cofre: 0.8,
};

/** Nome da sala para o HUD (chave de tradução) e o nível dos seguranças (tiros de pistola comum para derrubar). */
export const ROOM_TIER = Object.fromEntries(ROOMS.map((r) => [r.id, r.tier])) as Record<RoomId, number>;

export const DOORS: DoorDef[] = [
  { id: "carpetGate", rect: { x0: -1.5, z0: 31, x1: 1.5, z1: 31.5 }, lock: "invite", between: ["rua", "rua"] },
  { id: "front", rect: { x0: -2, z0: 24, x1: 2, z1: 24.5 }, lock: "open", between: ["rua", "vestibulo"] },
  { id: "dockGate", rect: { x0: -21, z0: 24, x1: -17, z1: 24.5 }, lock: "key", keyId: "doca", between: ["rua", "doca"] },
  { id: "side", rect: { x0: -8.5, z0: 20, x1: -8, z1: 22.5 }, lock: "staff", between: ["doca", "vestibulo"], freeFrom: "doca" },
  { id: "main", rect: { x0: -2, z0: 14, x1: 2, z1: 14.5 }, lock: "wristband", between: ["salao", "vestibulo"], freeFrom: "salao" },
  { id: "service", rect: { x0: -20, z0: 16, x1: -18, z1: 16.5 }, lock: "keypad", between: ["servico", "doca"], freeFrom: "servico" },
  { id: "staff", rect: { x0: -12.5, z0: 9, x1: -12, z1: 11 }, lock: "key", keyId: "servico", between: ["servico", "salao"], freeFrom: "servico" },
  { id: "lounge", rect: { x0: 12, z0: 9, x1: 12.5, z1: 11 }, lock: "open", between: ["salao", "lounge"] },
  { id: "backstage", rect: { x0: 16, z0: 4, x1: 18, z1: 4.5 }, lock: "open", between: ["bastidores", "lounge"] },
  { id: "stage", rect: { x0: 12, z0: -3, x1: 12.5, z1: -1 }, lock: "staff", between: ["salao", "bastidores"], freeFrom: "bastidores" },
  { id: "gallery", rect: { x0: -2, z0: -6.5, x1: 2, z1: -6 }, lock: "open", between: ["galeria", "salao"] },
  { id: "vault", rect: { x0: -12.5, z0: -16, x1: -12, z1: -14 }, lock: "keycard", between: ["cofre", "galeria"], freeFrom: "cofre" },
  { id: "terrace", rect: { x0: 12, z0: -16, x1: 12.5, z1: -14 }, lock: "open", between: ["galeria", "terraco"] },
  { id: "staffTerrace", rect: { x0: 16, z0: -6.5, x1: 18, z1: -6 }, lock: "open", between: ["terraco", "bastidores"] },
  { id: "vent", rect: { x0: -18, z0: -6.5, x1: -17, z1: -6 }, lock: "vent", between: ["cofre", "servico"] },
  { id: "secDoor", rect: { x0: -18.5, z0: 4, x1: -18, z1: 5.5 }, lock: "open", between: ["seguranca", "servico"] },
  { id: "windowT", rect: { x0: 19, z0: -22.5, x1: 20, z1: -22 }, lock: "climb", between: ["beiral", "terraco"] },
  { id: "windowC", rect: { x0: -20, z0: -22.5, x1: -19, z1: -22 }, lock: "climb", between: ["beiral", "cofre"] },
  { id: "fireEscape", rect: { x0: 22, z0: -15, x1: 22.5, z1: -13 }, lock: "climb", between: ["terraco", "beco"] },
];

/* ---------- labirinto de serviço ---------- */
/** Módulo de 2 m: corredor de 1,5 m e parede de 0,5 m. 5 colunas × 11 linhas entre x −22…−12,5 e z −6…16. */
export const MAZE = { x0: -22, z0: -6, cols: 5, rows: 11, cell: 2, wall: 0.5 };
/** Células ocupadas pela sala de segurança (colunas 0–1, linhas 4–6). */
const inSecRoom = (c: number, r: number) => c <= 1 && r >= 4 && r <= 6;

/** Paredes internas do labirinto (retângulos), geradas com semente: DFS + alguns laços. Sempre as mesmas. */
export function mazeWalls(): Rect[] {
  const { x0, z0, cols, rows, cell, wall } = MAZE;
  // paredes entre células: v[c][r] = parede à direita de (c,r); h[c][r] = parede abaixo de (c,r)
  const v = Array.from({ length: cols }, () => Array<boolean>(rows).fill(true));
  const h = Array.from({ length: cols }, () => Array<boolean>(rows).fill(true));
  const seen = Array.from({ length: cols }, () => Array<boolean>(rows).fill(false));
  let rng = 1957;
  const rnd = () => { const [x, s] = mulberry(rng); rng = s; return x; };
  const stack: [number, number][] = [[2, 0]]; seen[2][0] = true;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (inSecRoom(c, r)) seen[c][r] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dc, dr]) => [c + dc, r + dr] as [number, number])
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nc][nr]);
    if (!next.length) { stack.pop(); continue; }
    const [nc, nr] = next[Math.floor(rnd() * next.length)];
    if (nc !== c) v[Math.min(c, nc)][r] = false; else h[c][Math.min(r, nr)] = false;
    seen[nc][nr] = true; stack.push([nc, nr]);
  }
  // laços: abre algumas paredes fora da sala de segurança (rondas em circuito e mais de uma saída)
  for (const [c, r, dir] of [[3, 1, "v"], [2, 3, "h"], [3, 6, "v"], [2, 8, "h"], [0, 9, "v"], [3, 9, "h"], [1, 1, "h"], [2, 5, "v"]] as const) {
    if (dir === "v") v[c][r] = false; else h[c][r] = false;
  }
  // a sala de segurança tem as próprias paredes (sem paredes por dentro); a porta abre na linha 5 (secDoor)
  for (let c = 0; c <= 1; c++) for (let r = 4; r <= 6; r++) { if (c === 0) v[c][r] = false; if (r < 6) h[c][r] = false; }
  h[0][3] = true; h[1][3] = true; h[0][6] = true; h[1][6] = true; v[1][4] = true; v[1][5] = true; v[1][6] = true;
  h[4][7] = false;                                                                 // porta da equipe (coluna 4, linhas 7–8) sem parede no meio
  // segmentos de parede + pilares em todos os cruzamentos internos (menos dentro da sala de segurança)
  const out: Rect[] = [];
  const cx = (c: number) => x0 + c * cell, cz = (r: number) => z0 + r * cell, run = cell - wall;
  for (let c = 0; c < cols - 1; c++) for (let r = 0; r < rows; r++) if (v[c][r]) out.push({ x0: cx(c) + run, z0: cz(r), x1: cx(c) + cell, z1: r === rows - 1 ? 16 : cz(r) + run });
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows - 1; r++) if (h[c][r]) out.push({ x0: cx(c), z0: cz(r) + run, x1: cx(c) + run, z1: cz(r) + cell });
  for (let c = 0; c < cols - 1; c++) for (let r = 0; r < rows - 1; r++) {
    if (inSecRoom(c, r) && inSecRoom(c + 1, r) && inSecRoom(c, r + 1) && inSecRoom(c + 1, r + 1)) continue;
    out.push({ x0: cx(c) + run, z0: cz(r) + run, x1: cx(c) + cell, z1: cz(r) + cell });
  }
  return out;
}
/** Centro do corredor (c, r) do labirinto. */
export const mazeCell = (c: number, r: number): Vec => ({ x: MAZE.x0 + c * MAZE.cell + 0.75, z: MAZE.z0 + r * MAZE.cell + 0.75 });

/** Paredes internas fora das salas (além do labirinto): por enquanto só ele. */
export const INNER_WALLS: Rect[] = mazeWalls();

/* ---------- alturas ---------- */
export const SIDEWALK_Y = -1.6, ROAD_Y = -1.75, CURB_Z = 33, FAR_CURB_Z = 43;
/** Escadaria: x −6…6, patamar até z 25,5, doze degraus até z 31. */
export const STAIRS = { x0: -6, x1: 6, top: 25.5, bottom: 31, steps: 12 };
export const DOCK_RAMP = { x0: -21, x1: -17, z0: 24.5, z1: 28.5 };
/** Altura do piso em (x, z): prédio em 0, calçada e beco em −1,6, pista em −1,75, degraus da escadaria e rampa da doca. */
export function floorY(p: Vec): number {
  if (p.z < 24.5 && p.x < 22.5) return 0;
  if (p.z < 24.5) return SIDEWALK_Y;                                                   // beco
  if (p.x >= STAIRS.x0 && p.x <= STAIRS.x1 && p.z <= STAIRS.bottom) {
    if (p.z <= STAIRS.top) return 0;
    const k = Math.min(STAIRS.steps, Math.ceil(((p.z - STAIRS.top) / (STAIRS.bottom - STAIRS.top)) * STAIRS.steps));
    return (SIDEWALK_Y * k) / STAIRS.steps;
  }
  if (p.x >= DOCK_RAMP.x0 && p.x <= DOCK_RAMP.x1 && p.z <= DOCK_RAMP.z1) return SIDEWALK_Y * (p.z - DOCK_RAMP.z0) / (DOCK_RAMP.z1 - DOCK_RAMP.z0);
  if (p.z > CURB_Z && p.z < FAR_CURB_Z) return ROAD_Y;
  return SIDEWALK_Y;
}

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
   * e o portão), os flight cases no meio (cobertura dentro do circuito da Sônia), a paleteira carregada e os carros
   * térmicos junto à parede sul, o bebedouro e os paletes vazios nos cantos. A caixa alta que ficou é a caixa de obra do
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

/** Araras de roupa: esconderijo (entra e sai com a interação) e lugar para trocar de roupa sem ser vista. */
export const RACKS: { id: string; pos: Vec; room: RoomId; yaw: number }[] = [
  { id: "rack-b1", pos: { x: 13.8, z: -1.6 }, room: "bastidores", yaw: Math.PI / 2 }, { id: "rack-b2", pos: { x: 19.2, z: 2.6 }, room: "bastidores", yaw: Math.PI },
  { id: "rack-v1", pos: { x: 7.2, z: 18.6 }, room: "vestibulo", yaw: -Math.PI / 2 }, { id: "rack-d1", pos: { x: -15.8, z: 22.6 }, room: "doca", yaw: Math.PI },
  { id: "rack-r1", pos: { x: -25.4, z: 49.6 }, room: "rua", yaw: Math.PI },
];

export const PLAYER_SPAWN: Vec = { x: -18, z: 47.6 };
export const PLAYER_SPAWN_YAW = Math.PI;
/** Onde a cena do diamante acontece e de onde os seguranças entram. */
export const DIAMOND_POS: Vec = { x: -17.25, z: -14.25 };
export const VAULT_ENTRY: Vec = { x: -11.4, z: -15 };
/** Pontos de checkpoint (ao entrar na sala, a partida salva ali). */
export const CHECKPOINTS: Record<string, { room: RoomId; pos: Vec; yaw: number }> = {
  start: { room: "rua", pos: PLAYER_SPAWN, yaw: PLAYER_SPAWN_YAW },
  vestibulo: { room: "vestibulo", pos: { x: 0, z: 22.6 }, yaw: Math.PI },
  salao: { room: "salao", pos: { x: 0, z: 12.6 }, yaw: Math.PI },
  servico: { room: "servico", pos: { x: -19.2, z: 15.2 }, yaw: Math.PI },
  terraco: { room: "terraco", pos: { x: 20.6, z: -14 }, yaw: -Math.PI / 2 },
  cofre: { room: "cofre", pos: { x: -14, z: -15 }, yaw: -Math.PI / 2 },
  fuga: { room: "cofre", pos: { x: -16.2, z: -13.4 }, yaw: Math.PI / 2 },
};

/** Fila na calçada (do portão para o leste) e o caminho de quem entra: portão → tapete → portas → salão. */
export const QUEUE_SLOTS: Vec[] = Array.from({ length: 9 }, (_, i) => ({ x: 2.9 + i * 1.3, z: 31.95 }));
export const ENTRY_PATH: Vec[] = [{ x: 0, z: 32.2 }, { x: 0, z: 30.6 }, { x: 0, z: 25 }, { x: 0, z: 22.6 }, { x: 0, z: 16 }, { x: 0, z: 13.2 }];

/** Os dois carros da fuga. Chegar a qualquer um com o diamante encerra a missão. */
export const EXITS: { id: string; pos: Vec; room: RoomId }[] = [{ id: "carWest", pos: { x: -25.3, z: 37.9 }, room: "rua" }, { id: "carEast", pos: { x: 25.5, z: 8.5 }, room: "beco" }];

/** Lasers da Sala das Joias em volta do pedestal: high = passa agachada; full = só desligado. Ligam e desligam em ciclo. */
export interface LaserDef { id: string; a: Vec; b: Vec; height: "high" | "full"; on: number; off: number; phase: number }
export const LASERS: LaserDef[] = [
  { id: "L1", a: { x: -20.6, z: -10.9 }, b: { x: -13.9, z: -10.9 }, height: "full", on: 2.6, off: 1.6, phase: 0 },
  { id: "L2", a: { x: -20.6, z: -17.6 }, b: { x: -13.9, z: -17.6 }, height: "full", on: 2.6, off: 1.6, phase: 2.1 },
  { id: "L3", a: { x: -13.9, z: -17.6 }, b: { x: -13.9, z: -10.9 }, height: "high", on: 99, off: 0, phase: 0 },
  { id: "L4", a: { x: -20.6, z: -17.6 }, b: { x: -20.6, z: -10.9 }, height: "full", on: 3.2, off: 1.4, phase: 1 },
  { id: "L5", a: { x: -16, z: -12.4 }, b: { x: -18.5, z: -16.1 }, height: "high", on: 1.8, off: 1.8, phase: 0.6 },
];

/* ---------- seguranças: o nível sobe sala a sala (tiros para derrubar com a pistola comum) ---------- */
export const GUARDS: GuardSpawn[] = [
  // rua (3 tiros)
  { id: "r1", callsign: "Vargas", room: "rua", look: "police", post: { pos: { x: -27, z: 42.6 }, yaw: 0 }, role: "police", critical: true },
  { id: "r2", callsign: "Diniz", room: "rua", look: "guard", post: { pos: { x: -4.4, z: 32.6 }, yaw: Math.PI / 2 }, critical: true },
  { id: "r3", callsign: "Kátia", room: "rua", look: "guard", post: { pos: { x: 16.6, z: 32.2 }, yaw: -Math.PI / 2 } },
  { id: "r4", callsign: "Bento", room: "rua", look: "guard", route: [{ x: -14, z: 26 }, { x: -24, z: 26 }, { x: -24, z: 31.6 }, { x: -14, z: 31.6 }] },
  { id: "b1", callsign: "Iuri", room: "beco", look: "guard", route: [{ x: 25, z: 20 }, { x: 25, z: -6 }, { x: 27, z: -19 }, { x: 25, z: 2 }] },
  // vestíbulo (3)
  { id: "v1", callsign: "Jonas", room: "vestibulo", look: "guard", post: { pos: { x: 3, z: 15.4 }, yaw: 0 }, critical: true },
  { id: "v2", callsign: "Lívia", room: "vestibulo", look: "guard", route: [{ x: -6.6, z: 19.1 }, { x: -6.8, z: 23 }, { x: -3.4, z: 23 }, { x: -3.4, z: 19.5 }] },
  // doca (4) — Gil leva a chave do portão da doca
  { id: "d1", callsign: "Gil", room: "doca", look: "guard", post: { pos: { x: -19, z: 23.2 }, yaw: Math.PI }, carries: "doca", critical: true },
  { id: "d2", callsign: "Sônia", room: "doca", look: "guard", route: [{ x: -10, z: 19 }, { x: -16.5, z: 18.6 }, { x: -12, z: 22.6 }] },
  // Grande Salão (4) — o chefe Marcos leva a chave da porta de serviço
  { id: "s1", callsign: "Marcos", room: "salao", look: "guard", route: [{ x: -3, z: 12 }, { x: -7, z: 4.5 }, { x: -3, z: -3 }, { x: 3, z: -3 }, { x: 7.5, z: 4.5 }, { x: 3, z: 12 }], carries: "servico", role: "chief" },
  { id: "s2", callsign: "Marta", room: "salao", look: "guard", post: { pos: { x: -3.2, z: -4.6 }, yaw: Math.PI } },
  { id: "s3", callsign: "Edu", room: "salao", look: "guard", post: { pos: { x: -10.6, z: 12.4 }, yaw: Math.PI * 0.75 } },
  // lounge (5), Instituto do Traje (5)
  { id: "l1", callsign: "Ravi", room: "lounge", look: "guard", post: { pos: { x: 13.6, z: 13 }, yaw: Math.PI * 0.75 } },
  { id: "g1", callsign: "Téo", room: "galeria", look: "guard", route: [{ x: -9, z: -8.5 }, { x: -9, z: -20.5 }, { x: 9, z: -20.5 }, { x: 9, z: -8.5 }] },
  { id: "g2", callsign: "Nádia", room: "galeria", look: "guard", post: { pos: { x: -10.8, z: -13 }, yaw: Math.PI / 2 } },
  // bastidores e terraço (6)
  { id: "t1", callsign: "Bia", room: "terraco", look: "guard", route: [{ x: 14.5, z: -9 }, { x: 19.5, z: -9 }, { x: 19, z: -17 }, { x: 14.5, z: -17 }] },
  { id: "k1", callsign: "Sasha", room: "bastidores", look: "guard", route: [{ x: 15.6, z: 0.4 }, { x: 19.6, z: -3.2 }, { x: 16.4, z: -3.2 }] },
  // labirinto e sala de segurança (7)
  { id: "m1", callsign: "Rui", room: "servico", look: "guard", route: [mazeCell(1, 10), mazeCell(4, 10), mazeCell(4, 7), mazeCell(2, 8)] },
  { id: "m2", callsign: "Otávio", room: "servico", look: "guard", route: [mazeCell(2, 0), mazeCell(4, 0), mazeCell(4, 3), mazeCell(2, 3)] },
  { id: "m3", callsign: "Cida", room: "servico", look: "guard", route: [mazeCell(3, 4), mazeCell(3, 7), mazeCell(2, 6), mazeCell(2, 4)] },
  { id: "q1", callsign: "Nunes", room: "seguranca", look: "guard", post: { pos: { x: -20.6, z: 5.8 }, yaw: -Math.PI / 2 }, carries: "keycard", role: "chief", critical: true },
  // Sala das Joias (9)
  { id: "j1", callsign: "Brandão", room: "cofre", look: "guardHeavy", route: [{ x: -13.6, z: -9.6 }, { x: -21, z: -9.6 }, { x: -21, z: -19 }, { x: -13.6, z: -19 }], role: "heavy" },
  { id: "j2", callsign: "Hilda", room: "cofre", look: "guardHeavy", post: { pos: { x: -13.4, z: -13 }, yaw: -Math.PI / 2 }, role: "heavy", critical: true },
  // reforços do alarme: dois entram pela porta da sala (cena), os outros plantam-se nas saídas — toda rota de fuga tem combate
  { id: "x1", callsign: "Cardoso", room: "cofre", look: "guardHeavy", post: { pos: { x: -12.9, z: -14.6 }, yaw: -Math.PI / 2 }, lockdown: true, role: "heavy" },
  { id: "x2", callsign: "Lopes", room: "cofre", look: "guardHeavy", post: { pos: { x: -12.9, z: -15.6 }, yaw: -Math.PI / 2 }, lockdown: true, role: "heavy" },
  { id: "x3", callsign: "Prado", room: "servico", look: "guard", post: { pos: { x: -19, z: 15.2 }, yaw: Math.PI }, lockdown: true, blocker: true },
  { id: "x4", callsign: "Abreu", room: "terraco", look: "guard", post: { pos: { x: 21.2, z: -14 }, yaw: -Math.PI / 2 }, lockdown: true, blocker: true },
  { id: "x5", callsign: "Moura", room: "galeria", look: "guard", route: [{ x: 0, z: -8 }, { x: -8, z: -14 }, { x: 0, z: -19 }, { x: 8, z: -14 }], lockdown: true, reserve: true },
  { id: "x6", callsign: "Pires", room: "salao", look: "guard", post: { pos: { x: -11, z: 10 }, yaw: Math.PI / 2 }, lockdown: true, blocker: true, reserve: true },
  { id: "x7", callsign: "Silva", room: "beco", look: "police", post: { pos: { x: 25.2, z: -13.2 }, yaw: -Math.PI / 2 }, lockdown: true, role: "police" },
  { id: "x8", callsign: "Rocha", room: "rua", look: "police", post: { pos: { x: -19, z: 26.2 }, yaw: Math.PI }, lockdown: true, blocker: true, role: "police" },
];

/* ---------- civis ---------- */
function civs(): CivSpawn[] {
  const out: CivSpawn[] = []; let n = 0;
  const C = (role: CivSpawn["role"], look: CivSpawn["look"], room: RoomId, x: number, z: number, yaw: number, anim: CivSpawn["anim"], extra: Partial<CivSpawn> = {}) => out.push({ id: `c${++n}`, role, look, room, pos: { x, z }, yaw, anim, ...extra });
  // fãs atrás das grades, celulares no alto
  for (let k = 0; k < 16; k++) { const x = -23 + k * 3.3 + (k % 2) * 0.6, z = 44.2 + (k % 3) * 0.55; C("fan", "fan", "rua", x, z, Math.PI, (["cheer", "phone", "wave", "cheer"] as const)[k % 4], { hold: k % 4 === 1 ? "phone" : null }); }
  // fotógrafos: no cercado do tapete e na arquibancada (de pé sobre o riser)
  for (let k = 0; k < 4; k++) C("paparazzo", "paparazzo", "rua", -4.6 + (k % 2) * 1.1, 26.4 + k * 1.1, Math.PI / 2, "photo", { hold: "camera" });
  for (let k = 0; k < 6; k++) C("paparazzo", "paparazzo", "rua", -11.2 + (k % 3) * 2.1, 26.6 + Math.floor(k / 3) * 2.2, Math.PI / 2, "photo", { hold: "camera", y: -1.6 + 0.6 + Math.floor(k / 3) * 0.45 });
  for (let k = 0; k < 4; k++) C("paparazzo", "paparazzo", "rua", 7.2 + (k % 2) * 2.6, 27 + Math.floor(k / 2) * 2.4, -Math.PI / 2, k % 2 ? "photo" : "talk", { hold: k % 2 ? "camera" : "phone", y: -1.6 + 0.6 + Math.floor(k / 2) * 0.45 });
  // fila: convidados com convite (dá para furtar o de quem está distraído)
  for (let k = 0; k < 8; k++) C("queue", k % 2 ? "guestM" : "guestF", "rua", 2.9 + k * 1.3, 31.95, -Math.PI / 2, (["queue", "phone", "talk", "queue"] as const)[k % 4], { hold: k % 4 === 1 ? "phone" : null });
  C("hostess", "hostess", "rua", -1.7, 32.4, Math.PI, "idle", { hold: "tablet", talk: "hostess" });
  C("hostess", "hostess", "rua", 1.6, 25.1, 0, "idle", { hold: "tablet", y: 0 });
  C("driver", "driver", "rua", -6, 36, 0, "idle"); C("driver", "driver", "rua", 7, 36, 0, "phone", { hold: "phone" });
  C("catering", "catering", "rua", -20.4, 37, -Math.PI / 2, "phone", { hold: "phone", talk: "cateringChief" });
  // Lina Vale (atriz fictícia) saiu da limusine e posa para os fãs antes de subir
  C("celebrity", "guestF", "rua", -5.4, 32.9, Math.PI, "wave", { talk: "celebrity" });
  C("vendor", "vendor", "rua", -28.2, 47.1, 0, "idle", { vendor: "street" });
  // vestíbulo: a recepcionista atrás do balcão, o funcionário da chapelaria, convidados conversando fora dos cordões, um
  // convidado fazendo o credenciamento e a garçonete das taças de boas-vindas ao lado do tapete
  C("hostess", "hostess", "vestibulo", -4.4, 20.9, 0, "idle", { hold: "tablet" });
  C("crew", "crew", "vestibulo", 6.6, 19, -Math.PI / 2, "idle");
  for (const [x, z, yaw, a] of [[-3, 18, 0.4, "talk"], [-2.7, 18.9, -2.6, "talk"], [3.65, 19.5, 1.8, "drink"], [4.5, 19.3, Math.PI / 2, "phone"]] as const) C("guest", out.length % 2 ? "guestM" : "guestF", "vestibulo", x, z, yaw, a, { hold: a === "drink" ? "glass" : a === "phone" ? "phone" : null });
  C("guest", "guestM", "vestibulo", -4.2, 22.85, Math.PI, "talk");
  C("waiter", "waitress", "vestibulo", 1.95, 21.6, -Math.PI / 2, "serve", { hold: "tray" });
  // Grande Salão: rodas de conversa em volta das mesas altas, garçons e o quarteto de cordas
  const rings: [number, number, number][] = [[-2.8, 1.2, 3], [-2.6, 9.2, 3], [2.8, 8.8, 2], [6.4, 9.0, 3]];
  let g = 0;
  for (const [x, z, k] of rings) { g++; for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2 + g; const px = x + Math.sin(a) * 0.95, pz = z + Math.cos(a) * 0.95; C("guest", (i + g) % 2 ? "guestM" : "guestF", "salao", px, pz, a + Math.PI, (["talk", "drink", "talk", "idle"] as const)[(i + g) % 4], { group: g, hold: (i + g) % 4 === 1 ? "glass" : null }); } }
  C("waiter", "waiter", "salao", -4, 6, 0, "serve", { hold: "tray", wander: [{ x: -4, z: 6 }, { x: -8.4, z: 9.4 }, { x: -1.6, z: 11.6 }, { x: 1.4, z: 10.8 }] });
  C("waiter", "waitress", "salao", 4, 0, 0, "serve", { hold: "tray", wander: [{ x: 4, z: 0 }, { x: 7.4, z: 9.6 }, { x: 1.4, z: -2.6 }, { x: -4.2, z: 0.2 }] });
  C("waiter", "waiter", "salao", 0, 12.4, 0, "serve", { hold: "tray", wander: [{ x: 0, z: 12.4 }, { x: -5, z: 12.4 }, { x: 4.6, z: 12.4 }] });
  for (const [x, z] of [[-10.2, 1.2], [-10.9, 2.1], [-10.9, 3.1], [-10.2, 3.9]]) C("musician", "musician", "salao", x, z, Math.PI / 2, "play", { hold: "violin" });
  // o DJ na cabine (parede leste), colado ao tampo (pratos a ~0,5 m), virado para a pista, fone numa orelha
  C("dj", "dj", "salao", 11.12, 4.5, -Math.PI / 2, "dj", { hold: "headphones" });
  // pista de dança (x 3,2…9,8 × z 1,5…7,5): casais virados um para o outro e quem dança sozinho virado para o DJ
  for (const [ax, az, bx, bz] of [[3.7, 2.3, 4.3, 2.8], [3.7, 6.7, 4.3, 6.2], [5.6, 6.9, 6.2, 6.5], [8.6, 2.2, 8.9, 2.8], [5.4, 3.1, 6.0, 2.7]] as const) {
    const y = Math.atan2(bx - ax, bz - az);
    C("dancer", "guestF", "salao", ax, az, y, "dance"); C("dancer", "guestM", "salao", bx, bz, y + Math.PI, "dance");
  }
  for (const [x, z] of [[4.8, 4.6], [6.5, 4.3], [8.4, 6.2], [9.2, 4.0], [6.0, 5.6]] as const) C("dancer", out.length % 2 ? "guestM" : "guestF", "salao", x, z, Math.atan2(11.12 - x, 4.5 - z), "dance");
  // comendo de pé junto à mesa de doces (arco sudoeste) e ao bufê (arco sudeste), de frente para a mesa
  for (const [x, z] of [[-9.3, 12.25], [-7.9, 12.3], [-6.6, 12.2], [6.1, 12.25], [7.6, 12.3], [9.1, 12.2], [10.2, 12.3]] as const) C("guest", out.length % 2 ? "guestF" : "guestM", "salao", x, z, 0, "eat", { hold: "plate" });
  // lounge e bar (Davi negocia por baixo do balcão)
  C("bartender", "bartender", "lounge", 21.5, 9.5, -Math.PI / 2, "serve", { vendor: "bar", talk: "bartender" });
  // dois bebendo no balcão (entre as banquetas), dois no sofá sul e um no sofá oeste (sentados: o quadril fica 0,18 m
  // atrás da posição, sobre o assento), um casal conversando no meio e o pianista na banqueta, de frente para o teclado
  for (const [x, z, yaw, a] of [[18.95, 7.55, Math.PI / 2, "drink"], [18.95, 11.45, Math.PI / 2, "drink"], [14.75, 13.15, Math.PI, "sit"], [15.6, 13.15, Math.PI, "sit"], [13.7, 7.6, Math.PI / 2, "sit"], [16.6, 10.1, 2.7, "talk"], [16.95, 9.35, -0.44, "talk"]] as const) C("guest", out.length % 2 ? "guestF" : "guestM", "lounge", x, z, yaw, a, { hold: a === "drink" ? "glass" : null });
  C("musician", "musician", "lounge", 18.35, 11.95, 0, "sit");
  // Instituto do Traje: convidados olhando as vitrines e a curadora (leva um cartão da Sala das Joias)
  for (const [x, z, yaw] of [[-6.5, -12.6, Math.PI], [-5.6, -12.8, Math.PI], [6.4, -12.6, Math.PI], [0, -15.2, Math.PI], [-9.4, -10, -Math.PI / 2], [9.4, -19, Math.PI / 2]] as const) C("guest", out.length % 2 ? "guestF" : "guestM", "galeria", x, z, yaw, "look");
  C("curator", "curator", "galeria", 2, -12, Math.PI, "talk", { hold: "tablet", talk: "curator", wander: [{ x: 2, z: -12 }, { x: -4, z: -19 }, { x: 6, z: -18.6 }, { x: 8, z: -12 }] });
  // um fotógrafo de revista diante do Aurora, uma convidada na vitrine de joia, um convidado lendo os croquis e outra
  // sentada no banco olhando o nicho (o assento fica 0,18 m atrás do ponto)
  C("paparazzo", "paparazzo", "galeria", 2.4, -14.4, Math.atan2(-2.4, -2.6), "photo", { hold: "camera" });
  C("guest", "guestF", "galeria", -5.6, -18.3, Math.atan2(-0.9, -0.7), "look");
  C("guest", "guestM", "galeria", 6.3, -11.25, 0, "look");
  C("guest", "guestF", "galeria", -0.9, -11.28, Math.PI, "sit");
  // bastidores e terraço
  // (maquiadora atrás da cadeira da penteadeira do meio, vaporizador, mesa da folha de chamada e a costureira no ateliê)
  for (const [x, z, yaw] of [[20.15, -2.6, Math.PI / 2], [17.6, -1.1, Math.PI], [15.2, 1.2, 0], [13.45, -4.85, Math.PI]] as const) C("crew", "crew", "bastidores", x, z, yaw, "interact");
  // terraço: dois no sofá do pergolado (de frente para a mesa de fogo), o casal na mesa panorâmica e alguém no banco de
  // contemplação, olhando o totem
  for (const [x, z, yaw, a] of [[16.45, -11.15, Math.PI, "sit"], [17.35, -11.15, Math.PI, "sit"], [20.6, -19.15, 1.75, "drink"], [20.55, -20.05, 1.3, "talk"], [16.55, -19.25, Math.PI, "sit"]] as const) C("guest", out.length % 2 ? "guestM" : "guestF", "terraco", x, z, yaw, a, { hold: a === "drink" ? "glass" : null });
  // doca e labirinto: a equipe do bufê trabalhando
  // doca: Márcia confere a carga na bancada com o motorista do caminhão (que assina no tablet), Tião acerta os carros
  // térmicos junto à parede sul e o Dorival, da portaria, vigia o portão ao lado da guarita — todos fora do circuito da Sônia
  C("catering", "catering", "doca", -11.6, 17.85, Math.PI, "interact"); C("driver", "driver", "doca", -12.35, 17.9, Math.PI * 0.92, "talk", { hold: "tablet" });
  C("catering", "catering", "doca", -9.05, 22.85, 0, "interact"); C("crew", "guard", "doca", -20.05, 21.6, 0.35, "idle", { hold: "flashlight" });
  C("catering", "catering", "servico", mazeCell(3, 10).x, mazeCell(3, 10).z, 0, "walk", { wander: [mazeCell(3, 10), mazeCell(0, 10), mazeCell(4, 8)] });
  // copa do bufê, nas pontas mortas (longe das rondas): o chef no fogão, a montagem no pass, o bar de serviço e a lavagem
  C("chef", "chef", "servico", -19.25, -4.85, Math.PI, "interact");
  C("catering", "catering", "servico", -14.85, 7.0, -Math.PI / 2, "interact", { hold: "plate" });
  C("catering", "catering", "servico", -15.25, 11.1, Math.PI, "interact");
  C("catering", "catering", "servico", -15.65, 0.75, Math.PI / 2, "interact");
  return out;
}
export const CIVILIANS: CivSpawn[] = civs();

/* ---------- interações fixas ---------- */
export const INTERACTS: InteractDef[] = [
  { id: "vendorStreet", kind: "vendor", ref: "street", pos: { x: -28.2, z: 46.4 }, room: "rua", radius: 1.5 },
  { id: "vendorBar", kind: "vendor", ref: "bar", pos: { x: 19.2, z: 9.5 }, room: "lounge", radius: 1.4 },
  { id: "hostess", kind: "hostess", pos: { x: 0, z: 32.3 }, room: "rua", radius: 1.6 },
  { id: "uniformTruck", kind: "uniform", ref: "truck", pos: { x: -22.8, z: 34.9 }, room: "rua", radius: 1.2 },
  { id: "lockerUniform", kind: "uniform", ref: "locker", pos: { x: -12.95, z: 0.75 }, room: "servico", radius: 1 },
  { id: "dockIntercom", kind: "intercom", ref: "dockGate", pos: { x: -16.4, z: 25.1 }, room: "rua", radius: 1.2 },
  { id: "posterAurora", kind: "inspect", ref: "posterAurora", pos: { x: -11.4, z: 7 }, room: "salao", radius: 1.4 },
  { id: "callsheet", kind: "inspect", ref: "callsheet", pos: { x: 15.6, z: 1.2 }, room: "bastidores", radius: 1.3 },
  { id: "placardStars", kind: "inspect", ref: "placardStars", pos: { x: -6.5, z: -12.7 }, room: "galeria", radius: 1.3 },
  { id: "keypadService", kind: "keypad", ref: "service", pos: { x: -19, z: 17.1 }, room: "doca", radius: 1.3 },
  { id: "safe", kind: "safe", pos: { x: -19.7, z: 3.1 }, room: "seguranca", radius: 1.1 },
  { id: "fuses", kind: "fuses", pos: { x: -21.2, z: 4.75 }, room: "seguranca", radius: 1.1 },
  { id: "pedestal", kind: "pedestal", pos: { x: -16.2, z: -14.25 }, room: "cofre", radius: 1.2 },
  { id: "doorVault", kind: "door", ref: "vault", pos: { x: -11.4, z: -15 }, room: "galeria", radius: 1.1 },
  { id: "doorStaff", kind: "door", ref: "staff", pos: { x: -11.4, z: 10 }, room: "salao", radius: 1.1 },
  { id: "doorDock", kind: "door", ref: "dockGate", pos: { x: -19, z: 25.2 }, room: "rua", radius: 1.4 },
  { id: "fireUp", kind: "climb", ref: "fireUp", pos: { x: 23.6, z: -14 }, room: "beco", radius: 1.2 },
  { id: "fireDown", kind: "climb", ref: "fireDown", pos: { x: 21.4, z: -14 }, room: "terraco", radius: 1.2 },
  { id: "climbT", kind: "climb", ref: "climbT", pos: { x: 19.5, z: -21.4 }, room: "terraco", radius: 1.2 },
  { id: "climbTout", kind: "climb", ref: "climbTout", pos: { x: 19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbC", kind: "climb", ref: "climbC", pos: { x: -19.5, z: -23 }, room: "beiral", radius: 1.2 },
  { id: "climbCin", kind: "climb", ref: "climbCin", pos: { x: -19.5, z: -21.4 }, room: "cofre", radius: 1.2 },
  // esconderijos com recompensa para quem explora (MH-02-13)
  { id: "stashBeco", kind: "stash", ref: "stashBeco", pos: { x: 27.8, z: -2.8 }, room: "beco", radius: 1.1 },
  { id: "stashMakeup", kind: "stash", ref: "stashMakeup", pos: { x: 19.9, z: -1.5 }, room: "bastidores", radius: 1 },
  { id: "stashMaze", kind: "stash", ref: "stashMaze", pos: { x: -21.25, z: -5.25 }, room: "servico", radius: 1 },
  { id: "stashTerrace", kind: "stash", ref: "stashTerrace", pos: { x: 14.9, z: -19.7 }, room: "terraco", radius: 1 },
  { id: "stashDock", kind: "stash", ref: "stashDock", pos: { x: -10.3, z: 22.1 }, room: "doca", radius: 1 },
  // joias expostas (vitrines da Sala das Joias, com sensor enquanto há energia) e a peça guardada na chapelaria
  { id: "caseJ1", kind: "jewelCase", ref: "caseJ1", pos: { x: -20.5, z: -18.5 }, room: "cofre", radius: 1 },
  { id: "caseJ2", kind: "jewelCase", ref: "caseJ2", pos: { x: -20.5, z: -10.5 }, room: "cofre", radius: 1 },
  { id: "caseJ3", kind: "jewelCase", ref: "caseJ3", pos: { x: -13.55, z: -20.5 }, room: "cofre", radius: 1 },
  { id: "caseJ4", kind: "jewelCase", ref: "caseJ4", pos: { x: -19.75, z: -20.6 }, room: "cofre", radius: 1 },
  { id: "coatRack", kind: "coatRack", ref: "coatRack", pos: { x: 7.2, z: 20.4 }, room: "vestibulo", radius: 1 },
  { id: "carWest", kind: "exit", ref: "carWest", pos: EXITS[0].pos, room: "rua", radius: 1.6 },
  { id: "carEast", kind: "exit", ref: "carEast", pos: EXITS[1].pos, room: "beco", radius: 1.6 },
];
/** De cada ponto de escalada até o outro lado (a travessia leva a jogadora pela janela ou pela escada de incêndio). */
export const CLIMB_TO: Record<string, { to: Vec; dur: number }> = {
  fireUp: { to: { x: 21.4, z: -14 }, dur: 3.2 }, fireDown: { to: { x: 23.6, z: -14 }, dur: 2.6 },
  climbT: { to: { x: 19.5, z: -23 }, dur: 1.6 }, climbTout: { to: { x: 19.5, z: -21.4 }, dur: 1.6 },
  climbC: { to: { x: -19.5, z: -21.4 }, dur: 1.6 }, climbCin: { to: { x: -19.5, z: -23 }, dur: 1.6 },
};

/** O que cada esconderijo guarda. */
export const STASH_REWARD: Record<string, { ammo?: number; bottles?: number; medkit?: number; decoder?: number; bandage?: number }> = {
  stashBeco: { ammo: 12, bottles: 1 }, stashMakeup: { medkit: 1 }, stashMaze: { decoder: 1 }, stashTerrace: { bandage: 1 }, stashDock: { bottles: 2 },
};

/** Códigos (pistas na planta: cartaz do Aurora no salão e a folha de chamada nos bastidores) e a combinação da vitrine
 * do diamante (placa da exposição). */
export const CODES = { service: "1957", safe: "0412", rings: [2, 0, 3] as number[] };
/** Símbolos dos anéis da vitrine do diamante (a placa da exposição mostra a ordem: estrela, lua, coroa). */
export const RING_SYMBOLS = ["lua", "coracao", "estrela", "coroa"] as const;

/* ---------- revendedores: troca de roupa por recursos ---------- */
/** Preço em créditos (o valor das peças entregues) e, para as armas, o valor mínimo de uma única peça ("só troco a
 * pistola por peça de grife"). O revendedor da rua não vende o que o detector do vestíbulo pegaria? Vende — e avisa. */
export const VENDOR_OFFERS: Record<VendorId, VendorOffer[]> = {
  street: [
    { item: "medkit", price: 25, stock: 3 }, { item: "ammo", price: 20, stock: 4 }, { item: "knife", price: 40, minPiece: 30, stock: 1 },
    { item: "pistol", price: 90, minPiece: 55, stock: 1 }, { item: "uniform", price: 30, stock: 1 }, { item: "invite", price: 70, minPiece: 45, stock: 1 },
    { item: "bottle", price: 8, stock: 4 },
  ],
  bar: [
    { item: "medkit", price: 25, stock: 2 }, { item: "medkitXL", price: 50, stock: 1 }, { item: "ammo", price: 20, stock: 4 },
    { item: "pistolS", price: 130, minPiece: 75, stock: 1 }, { item: "vest", price: 70, minPiece: 50, stock: 1 }, { item: "decoder", price: 35, stock: 1 },
  ],
};
