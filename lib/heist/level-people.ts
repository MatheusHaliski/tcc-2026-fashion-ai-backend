/* MET Gala Heist v2 — quem está em cena: os seguranças (posto, ronda, chave, papel, reforço) e os civis de cada sala. */
import type { CivSpawn, GuardSpawn, RoomId } from "./types";
import { mazeCell } from "./level-maze";

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
  C("guest", "guestF", "vestibulo", 4.85, 23.45, Math.PI, "sit", { hold: "phone" });       // esperando o casaco no banco
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
