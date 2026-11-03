/*
 * MET Gala Heist v2 — catálogo de quem está em cena: cada LookId tem alguns modelos de pessoa (sexo, corpo, tom de pele,
 * cabelo, roupa e rosto) montados uma vez com o corpo humano do FashionAI e clonados para a multidão. A variação de cada
 * pessoa vem do seed: qual modelo, a cor do vestido/paletó (tingimento do material do clone) e a altura (±5 %).
 *
 * Rosto: sem foto de ninguém. Uma textura sintética no UV canônico do rosto (o mesmo das fotos do Avatar 3D) desenha
 * sobrancelhas, lábios, delineado, sombra e barba por fazer nos pontos do MediaPipe — o corpo assa essa textura como faria
 * com o rosto de uma foto (skin-bake.ts). Ninguém é parecido com uma pessoa real.
 *
 * Roupas da gala: vestidos longos (LENGTH = FLOOR_LENGTH) e smokings; seguranças de terno preto com ponto no ouvido;
 * garçons com o mesmo uniforme que a jogadora pode vestir (outfits.ts).
 */
import type { Look3dPiece } from "@/components/three/common";
import type { AvatarHair } from "@/lib/avatar3d/model";
import type { BodyInput } from "@/lib/avatar3d/human/compose";
import type { BodyParams, BodySources, Sex } from "@/lib/avatar3d/body-spec";
import { GUARD_HEAVY, GUARD_SUIT, POLICE_UNIFORM, WAITER_UNIFORM, WAITRESS_UNIFORM } from "./outfits";
import type { LookId } from "./types";

/** Como o rosto sintético é pintado. */
export interface FaceStyle {
  lips: string; brows: string;
  /** delineado (0 = nenhum, 1 = marcado, 2 = gatinho) e sombra dos olhos */
  liner: 0 | 1 | 2; shadow: string | null;
  blush: string | null; stubble: number;
}
export interface LookTemplate {
  /** id único do modelo (chave do cache) */
  key: string; look: LookId; sex: Sex;
  body: BodyInput; stature: number; skin: string; hair: AvatarHair | null; face: FaceStyle;
  pieces: Look3dPiece[];
  /** peça tingida por pessoa (vestido, paletó, moletom) e a paleta */
  tint?: { piece: string; palette: string[] };
  /** objeto preso à cabeça: ponto de rádio (segurança) */
  earpiece?: boolean;
  /** gravata-borboleta no colarinho (smoking, garçom) */
  bowtie?: boolean;
  /** touca alta de chef presa à cabeça e os botões do dólmã trespassado */
  chefHat?: boolean;
  /** joias (brincos e colar): brilhantes, ouro ou pérolas */
  jewel?: "diamond" | "gold" | "pearl";
  /** lenço de bolso no paletó (smoking) */
  pocket?: boolean;
}

/* ---------- peças ---------- */
const P = (id: string, slot: string, category: string, subcategory: string, colorHex: string, extra: Partial<Look3dPiece> = {}): Look3dPiece =>
  ({ id: `look-${id}`, name: `look-${id}`, slot, category, subcategory, colorHex, imageUrl: null, ...extra });
/** Comprimento e decote declarados (dimensões da taxonomia, garment-fit.ts). Vestido de gala sem alça ou ombro a ombro:
 * o decote padrão do vestido sobe até o pescoço nas costas e deixa retalhos nos ombros sem manga. */
const DIM = (length: string, neckline?: string): Partial<Look3dPiece> => ({ attributes: { LENGTH: [length], ...(neckline ? { NECKLINE: [neckline] } : {}) } });
/** Paletó de smoking/terno: lapela em V até o meio do peito; camisa social de colarinho fechado (gravata-borboleta). */
const LAPEL = { attributes: { NECKLINE: ["PLUNGE"] } }, CLOSED_COLLAR = { attributes: { NECKLINE: ["MOCK_NECK"] } };
/** Base clara para tingir por clone (a cor final multiplica a textura do tecido). */
const TINT_BASE = "#ece8e2";
/** Vestidos de gala: cores de tapete vermelho, do preto ao dourado. */
const GOWNS = ["#7b0f1e", "#0f4d3a", "#c9a24a", "#14161c", "#1d2f6b", "#e7d9c8", "#b83a6b", "#5b1f6e", "#a7aab3", "#d4683a", "#3a0f12", "#f2efe9"];
/** Paletós de smoking: preto, azul-meia-noite, bordô, verde-garrafa, marfim. */
const JACKETS = ["#101114", "#141a2e", "#101114", "#4a1220", "#103326", "#e9e4d8", "#101114", "#2a2a30"];
const STREET = ["#2b2f36", "#5a6b7d", "#8a2b2b", "#d9d4c7", "#1f3a2a", "#c47b2a", "#3d2f5a", "#191a1d"];

const gown = (id: string, neckline = "STRAPLESS", length = "FLOOR_LENGTH"): Look3dPiece[] =>
  [P(`${id}-gown`, "full", "FULL_BODY", "dress", TINT_BASE, { ...DIM(length, neckline), material: "SATIN" }), P(`${id}-heels`, "shoes", "SHOES", "heels", "#141414")];
/** Uniforme da copa: o avental é uma saia aberta atrás (fabric.ts corta as costas; o cós fica como as tiras). */
const chefWear = (id: string, apron: string): Look3dPiece[] => [
  P(`${id}-dolma`, "upper", "UPPER", "shirt", "#f6f4ef", { material: "COTTON", attributes: { NECKLINE: ["MOCK_NECK"], CLOSURE: ["DOUBLE_BREASTED"], SLEEVE_LENGTH: ["LONG_SLEEVE"] } }),
  P(`${id}-pants`, "lower", "LOWER", "tailored_pants", "#1a1a1e"),
  P(`${id}-apron`, "lower", "LOWER", "skirt", apron, { material: "COTTON", attributes: { LENGTH: ["KNEE"] } }),
  P(`${id}-shoes`, "shoes", "SHOES", "loafers", "#0c0c0c"),
];
const tux = (id: string): Look3dPiece[] => [
  P(`${id}-shirt`, "upper", "UPPER", "shirt", "#f4f2ee", CLOSED_COLLAR), P(`${id}-jacket`, "outer", "UPPER", "blazer", TINT_BASE, LAPEL),
  P(`${id}-pants`, "lower", "LOWER", "tailored_pants", "#121216"), P(`${id}-shoes`, "shoes", "SHOES", "oxford_shoes", "#0a0a0a"),
];

/* ---------- corpo, pele, cabelo e rosto ---------- */
const SKIN = { porcelain: "#ecc8b0", light: "#e6bc9f", medium: "#c99470", tan: "#a8714f", brown: "#7f5038", deep: "#5b3624", ebony: "#3f2519" } as const;
const HAIR_C = { black: "#16110f", darkBrown: "#2c1e16", brown: "#4a3020", chestnut: "#6b4128", auburn: "#7a3a20", blonde: "#c49a62", platinum: "#ddd3c4", gray: "#8c8884" } as const;
const H0: AvatarHair = { present: true, color: HAIR_C.darkBrown, top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", volume: 1 };
const hair = (o: Partial<AvatarHair>): AvatarHair => ({ ...H0, ...o });
const LONG_WAVY = (color: string) => hair({ color, length: "long", texture: "wavy", bottom: -22, fringe: 0.2 });
const LONG_STRAIGHT = (color: string) => hair({ color, length: "long", texture: "straight", bottom: -24 });
const BOB = (color: string) => hair({ color, length: "medium", texture: "straight", bottom: -9.8, fringe: 0.9, fringeStyle: "blunt" });
const CURLY = (color: string) => hair({ color, length: "medium", texture: "curly", bottom: -12, volume: 1.45 });
const COILY = (color: string) => hair({ color, length: "short", texture: "coily", volume: 1.6 });
const SHORT_M = (color: string) => hair({ color, length: "short", texture: "straight" });
const SHORT_WAVY_M = (color: string) => hair({ color, length: "short", texture: "wavy", volume: 1.1 });
const BUZZ = (color: string) => hair({ color, length: "buzz", texture: "straight", volume: 0.8 });
const CAP = (color: string, under: string) => hair({ color: under, length: "short", texture: "straight", cover: color });

const KEYS: (keyof BodyParams)[] = ["stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "build"];
/** Corpo: só estatura e compleição informadas ("user"); o resto, o típico do sexo. */
function body(sex: Sex, stature: number, build = 0, extra: Partial<BodyParams> = {}): BodyInput {
  const base: BodyParams = sex === "FEMININO"
    ? { stature, shoulderW: 0.19, chestW: 0.175, waistW: 0.15, hipW: 0.205, legLen: 0.53, armLen: 0.333, headH: 0.13, build }
    : { stature, shoulderW: 0.205, chestW: 0.19, waistW: 0.165, hipW: 0.19, legLen: 0.53, armLen: 0.333, headH: 0.13, build };
  const params = { ...base, ...extra };
  const sources = Object.fromEntries(KEYS.map((k) => [k, k === "stature" || k === "build" || k in extra ? "user" : "default"])) as BodySources;
  return { sex, params, sources };
}
const FACE_F = (lips: string, brows: string, liner: 0 | 1 | 2 = 1, shadow: string | null = "#6b4a3a", blush: string | null = "#c96a63"): FaceStyle => ({ lips, brows, liner, shadow, blush, stubble: 0 });
const FACE_M = (brows: string, stubble = 0, lips = "#9a5a4c"): FaceStyle => ({ lips, brows, liner: 0, shadow: null, blush: null, stubble });

const T = (key: string, look: LookId, sex: Sex, stature: number, build: number, skin: string, h: AvatarHair | null, face: FaceStyle, pieces: Look3dPiece[], extra: Partial<LookTemplate> = {}): LookTemplate =>
  ({ key, look, sex, body: body(sex, stature, build), stature, skin, hair: h, face, pieces, ...extra });

/** Modelos por aparência. O primeiro de cada lista é o mais comum (sementes caem mais nele quando há poucos). */
export const LOOKS: Record<LookId, LookTemplate[]> = {
  guestF: [
    T("guestF-0", "guestF", "FEMININO", 1.7, -0.2, SKIN.light, LONG_WAVY(HAIR_C.blonde), FACE_F("#9e1b2c", "#5a4430", 2, "#4a3a36"), gown("gF0"), { tint: { piece: "look-gF0-gown", palette: GOWNS }, jewel: "diamond" }),
    T("guestF-1", "guestF", "FEMININO", 1.74, 0.1, SKIN.deep, CURLY(HAIR_C.black), FACE_F("#7a2a3a", "#1a1210", 1, "#6b3f2a", "#8a3d3a"), gown("gF1", "OFF_SHOULDER"), { tint: { piece: "look-gF1-gown", palette: GOWNS }, jewel: "gold" }),
    T("guestF-2", "guestF", "FEMININO", 1.66, 0, SKIN.medium, LONG_STRAIGHT(HAIR_C.black), FACE_F("#b23a48", "#1e1612", 2, "#5c4038"), gown("gF2"), { tint: { piece: "look-gF2-gown", palette: GOWNS }, jewel: "diamond" }),
    T("guestF-3", "guestF", "FEMININO", 1.68, 0.4, SKIN.porcelain, BOB(HAIR_C.auburn), FACE_F("#c0485a", "#5a3020", 1, "#7a5a4a", "#d98a80"), gown("gF3", "OFF_SHOULDER", "MIDI"), { tint: { piece: "look-gF3-gown", palette: GOWNS }, jewel: "pearl" }),
    T("guestF-4", "guestF", "FEMININO", 1.72, -0.1, SKIN.brown, COILY(HAIR_C.black), FACE_F("#8a2032", "#16100d", 2, "#3a2a2a", "#9a4a40"), gown("gF4"), { tint: { piece: "look-gF4-gown", palette: GOWNS }, jewel: "gold" }),
  ],
  guestM: [
    T("guestM-0", "guestM", "MASCULINO", 1.8, 0.1, SKIN.light, SHORT_M(HAIR_C.brown), FACE_M("#3a2a20", 0.35), tux("gM0"), { tint: { piece: "look-gM0-jacket", palette: JACKETS }, bowtie: true, pocket: true }),
    T("guestM-1", "guestM", "MASCULINO", 1.84, 0.4, SKIN.ebony, COILY(HAIR_C.black), FACE_M("#120c0a", 0.25, "#6a3a32"), tux("gM1"), { tint: { piece: "look-gM1-jacket", palette: JACKETS }, bowtie: true, pocket: true }),
    T("guestM-2", "guestM", "MASCULINO", 1.76, 0, SKIN.tan, SHORT_WAVY_M(HAIR_C.darkBrown), FACE_M("#1e1612", 0.6), tux("gM2"), { tint: { piece: "look-gM2-jacket", palette: JACKETS }, bowtie: true, pocket: true }),
    T("guestM-3", "guestM", "MASCULINO", 1.78, 0.7, SKIN.medium, SHORT_M(HAIR_C.gray), FACE_M("#5a5552", 0.15), tux("gM3"), { tint: { piece: "look-gM3-jacket", palette: JACKETS }, bowtie: true, pocket: true }),
  ],
  guard: [
    T("guard-0", "guard", "MASCULINO", 1.86, 1.0, SKIN.light, BUZZ(HAIR_C.darkBrown), FACE_M("#2a1e18", 0.5), GUARD_SUIT, { earpiece: true }),
    T("guard-1", "guard", "MASCULINO", 1.88, 1.3, SKIN.deep, BUZZ(HAIR_C.black), FACE_M("#120c0a", 0.3, "#6a3a32"), GUARD_SUIT, { earpiece: true }),
    T("guard-2", "guard", "FEMININO", 1.76, 0.6, SKIN.tan, hair({ color: HAIR_C.black, length: "medium", texture: "straight", bottom: -6 }), FACE_F("#8a4a48", "#1a1210", 0, null, null), GUARD_SUIT, { earpiece: true }),
  ],
  guardHeavy: [T("guardHeavy-0", "guardHeavy", "MASCULINO", 1.9, 1.6, SKIN.medium, BUZZ(HAIR_C.black), FACE_M("#1a1210", 0.7), GUARD_HEAVY, { earpiece: true })],
  police: [T("police-0", "police", "MASCULINO", 1.82, 0.9, SKIN.brown, CAP("#18233a", HAIR_C.black), FACE_M("#1a1210", 0.3), POLICE_UNIFORM, { earpiece: true })],
  waiter: [T("waiter-0", "waiter", "MASCULINO", 1.77, 0, SKIN.medium, SHORT_M(HAIR_C.black), FACE_M("#1a1210", 0.1), WAITER_UNIFORM, { bowtie: true })],
  waitress: [T("waitress-0", "waitress", "FEMININO", 1.66, 0, SKIN.light, BOB(HAIR_C.darkBrown), FACE_F("#a84a52", "#2c1e16", 1, null, "#d08a80"), WAITRESS_UNIFORM)],
  hostess: [T("hostess-0", "hostess", "FEMININO", 1.72, -0.2, SKIN.tan, LONG_STRAIGHT(HAIR_C.darkBrown), FACE_F("#a02838", "#1e1612", 2, "#4a3a36"),
    [P("host-dress", "full", "FULL_BODY", "dress", "#0e0e12", DIM("KNEE", "OFF_SHOULDER")), P("host-heels", "shoes", "SHOES", "heels", "#0a0a0a")], { jewel: "pearl" })],
  paparazzo: [
    T("paparazzo-0", "paparazzo", "MASCULINO", 1.78, 0.5, SKIN.light, CAP("#1c1d22", HAIR_C.brown), FACE_M("#3a2a20", 0.8),
      [P("pap-jacket", "outer", "UPPER", "jacket", "#2a2b30"), P("pap-tee", "upper", "UPPER", "t_shirt", "#1b1c1f"), P("pap-pants", "lower", "LOWER", "cargo_pants", "#3b3e44"), P("pap-shoes", "shoes", "SHOES", "casual_sneakers", "#1c1c1c")]),
    T("paparazzo-1", "paparazzo", "FEMININO", 1.68, 0.2, SKIN.brown, hair({ color: HAIR_C.black, length: "medium", texture: "curly", bottom: -9, volume: 1.3 }), FACE_F("#7a3a3a", "#16100d", 0, null, null),
      [P("pap2-jacket", "outer", "UPPER", "jacket", "#1e2a3a"), P("pap2-tee", "upper", "UPPER", "t_shirt", "#d7d4cc"), P("pap2-jeans", "lower", "LOWER", "jeans", "#2a3346"), P("pap2-boots", "shoes", "SHOES", "ankle_boots", "#18120e")]),
  ],
  fan: [
    T("fan-0", "fan", "FEMININO", 1.63, 0.3, SKIN.medium, LONG_WAVY(HAIR_C.chestnut), FACE_F("#b0505a", "#2c1e16", 1, null, "#d08a80"),
      [P("fan0-hoodie", "upper", "UPPER", "hoodie", TINT_BASE), P("fan0-jeans", "lower", "LOWER", "jeans", "#2d3b55"), P("fan0-sneakers", "shoes", "SHOES", "casual_sneakers", "#e8e6e0")], { tint: { piece: "look-fan0-hoodie", palette: STREET } }),
    T("fan-1", "fan", "MASCULINO", 1.75, 0.2, SKIN.deep, COILY(HAIR_C.black), FACE_M("#120c0a", 0.4, "#6a3a32"),
      [P("fan1-tee", "upper", "UPPER", "t_shirt", TINT_BASE), P("fan1-jacket", "outer", "UPPER", "jacket", "#2c2f35"), P("fan1-jeans", "lower", "LOWER", "jeans", "#1f2a3d"), P("fan1-sneakers", "shoes", "SHOES", "high_top_sneakers", "#d8d6d0")], { tint: { piece: "look-fan1-tee", palette: STREET } }),
    T("fan-2", "fan", "FEMININO", 1.6, -0.1, SKIN.porcelain, BOB(HAIR_C.platinum), FACE_F("#c0485a", "#7a6a5a", 2, "#8a6a7a", "#e09a90"),
      [P("fan2-sweater", "upper", "UPPER", "sweater", TINT_BASE), P("fan2-skirt", "lower", "LOWER", "skirt", "#1c1c20", DIM("MINI")), P("fan2-boots", "shoes", "SHOES", "boots", "#121212")], { tint: { piece: "look-fan2-sweater", palette: STREET } }),
  ],
  catering: [T("catering-0", "catering", "MASCULINO", 1.74, 0.6, SKIN.tan, CAP("#efece6", HAIR_C.black), FACE_M("#1a1210", 0.5),
    [P("cat-shirt", "upper", "UPPER", "shirt", "#f2f0ea"), P("cat-pants", "lower", "LOWER", "tailored_pants", "#16161a"), P("cat-shoes", "shoes", "SHOES", "oxford_shoes", "#0c0c0c")])],
  vendor: [T("vendor-0", "vendor", "MASCULINO", 1.79, 0.9, SKIN.light, CAP("#3a2a22", HAIR_C.darkBrown), FACE_M("#2a1e18", 0.9),
    [P("ven-jacket", "outer", "UPPER", "jacket", "#3a2418", { material: "LEATHER" }), P("ven-tee", "upper", "UPPER", "t_shirt", "#2a2a2e"), P("ven-jeans", "lower", "LOWER", "jeans", "#26324a"), P("ven-boots", "shoes", "SHOES", "boots", "#1a120c")])],
  curator: [T("curator-0", "curator", "FEMININO", 1.7, 0, SKIN.porcelain, BOB(HAIR_C.gray), FACE_F("#8a3a42", "#4a4440", 1, "#5a5050", null),
    [P("cur-blouse", "upper", "UPPER", "blouse", "#f0ece4"), P("cur-blazer", "outer", "UPPER", "blazer", "#22242c", LAPEL), P("cur-pants", "lower", "LOWER", "tailored_pants", "#22242c"), P("cur-shoes", "shoes", "SHOES", "loafers", "#141414")])],
  bartender: [T("bartender-0", "bartender", "MASCULINO", 1.78, 0.3, SKIN.brown, SHORT_WAVY_M(HAIR_C.black), FACE_M("#16100d", 0.7, "#7a4a3a"),
    [P("bar-shirt", "upper", "UPPER", "shirt", "#121214"), P("bar-vest", "outer", "UPPER", "vest", "#2a2a30"), P("bar-pants", "lower", "LOWER", "tailored_pants", "#121214"), P("bar-shoes", "shoes", "SHOES", "oxford_shoes", "#0a0a0a")])],
  // DJ da gala: camiseta preta sob blazer de veludo bordô e tênis branco; ou macacão preto de crepe de manga longa. O
  // fone (hold "headphones") vai na cabeça enquanto toca e no pescoço fora do console.
  dj: [
    T("dj-0", "dj", "MASCULINO", 1.8, 0.2, SKIN.deep, SHORT_WAVY_M(HAIR_C.black), FACE_M("#120c0a", 0.45, "#6a3a32"),
      [P("dj0-tee", "upper", "UPPER", "t_shirt", "#111113"), P("dj0-blazer", "outer", "UPPER", "blazer", "#3d0f1c", { material: "WOOL" }),
        P("dj0-pants", "lower", "LOWER", "tailored_pants", "#121214"), P("dj0-sneakers", "shoes", "SHOES", "casual_sneakers", "#ecebe6")]),
    T("dj-1", "dj", "FEMININO", 1.72, 0, SKIN.medium, BOB(HAIR_C.platinum), FACE_F("#7a1f3a", "#3a2a20", 2, "#3a3036", null),
      [P("dj1-jumpsuit", "full", "FULL_BODY", "jumpsuit", "#0d0d10", { material: "WOOL", attributes: { SLEEVE_LENGTH: ["LONG_SLEEVE"] } }), P("dj1-sneakers", "shoes", "SHOES", "casual_sneakers", "#f0efe9")]),
  ],
  // Copa: dólmã branco trespassado (duas fileiras de botões, gola padre), avental (preto do chef, branco da confeiteira),
  // calça escura e sapato fechado; a touca alta plissada vai presa à cabeça (people.tsx), por cima da touca de malha.
  chef: [
    T("chef-0", "chef", "MASCULINO", 1.76, 0.5, SKIN.light, CAP("#f4f2ee", HAIR_C.brown), FACE_M("#2a1e18", 0.3), chefWear("chef0", "#16161a"), { chefHat: true }),
    T("chef-1", "chef", "FEMININO", 1.68, 0.2, SKIN.brown, CAP("#f4f2ee", HAIR_C.black), FACE_F("#8a3a3a", "#1a1210", 0, null, null), chefWear("chef1", "#f3f1ec"), { chefHat: true }),
  ],
  musician: [
    T("musician-0", "musician", "FEMININO", 1.67, 0, SKIN.light, LONG_STRAIGHT(HAIR_C.chestnut), FACE_F("#9a3a48", "#3a2a20", 1, "#5a4038"), [P("mus-gown", "full", "FULL_BODY", "dress", "#0d0d10", { ...DIM("FLOOR_LENGTH", "STRAPLESS"), material: "SATIN" }), P("mus-heels", "shoes", "SHOES", "heels", "#0a0a0a")]),
    T("musician-1", "musician", "MASCULINO", 1.79, 0.1, SKIN.medium, SHORT_M(HAIR_C.black), FACE_M("#1a1210", 0.2), tux("mus1").map((p) => (p.id.endsWith("jacket") ? { ...p, colorHex: "#0f1013" } : p)), { bowtie: true }),
  ],
  crew: [T("crew-0", "crew", "FEMININO", 1.68, 0.3, SKIN.medium, hair({ color: HAIR_C.darkBrown, length: "medium", texture: "wavy", bottom: -10 }), FACE_F("#8a4a4a", "#2c1e16", 0, null, null),
    [P("crew-tee", "upper", "UPPER", "long_sleeve", "#141416"), P("crew-pants", "lower", "LOWER", "cargo_pants", "#141416"), P("crew-sneakers", "shoes", "SHOES", "casual_sneakers", "#1a1a1a")])],
  driver: [T("driver-0", "driver", "MASCULINO", 1.8, 0.8, SKIN.deep, CAP("#0d0e12", HAIR_C.black), FACE_M("#120c0a", 0.2, "#6a3a32"),
    [P("drv-shirt", "upper", "UPPER", "shirt", "#e9e6df"), P("drv-jacket", "outer", "UPPER", "blazer", "#0d0e12", LAPEL), P("drv-pants", "lower", "LOWER", "tailored_pants", "#0d0e12"), P("drv-shoes", "shoes", "SHOES", "oxford_shoes", "#090909")])],
};

/** A jogadora quando o jogo não passa o Avatar 3D dela: mulher de cabelo escuro ondulado, maquiagem de gala. */
export const PLAYER_DEFAULT = {
  sex: "FEMININO" as Sex, body: body("FEMININO", 1.7, 0), stature: 1.7, skin: SKIN.medium,
  hair: hair({ color: HAIR_C.darkBrown, length: "long", texture: "wavy", bottom: -18, fringe: 0.5, fringeStyle: "side" }),
  face: FACE_F("#9a1b2a", "#2a1c14", 2, "#3e3236", "#c4746a"),
};

const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** Modelo da pessoa (pela semente). */
export function templateFor(look: LookId, seed: number): LookTemplate {
  const list = LOOKS[look] ?? LOOKS.guestF;
  return list[Math.floor(hash(seed * 1.37 + 0.5) * list.length) % list.length];
}
/** Cor da peça tingida (ou null). */
export function tintFor(t: LookTemplate, seed: number): string | null {
  if (!t.tint) return null;
  return t.tint.palette[Math.floor(hash(seed * 2.11 + 1.3) * t.tint.palette.length) % t.tint.palette.length];
}
/** Altura relativa da pessoa (±5 %). */
export const scaleFor = (seed: number) => 0.95 + 0.1 * hash(seed * 3.7 + 2.9);

/**
 * Corte de gala das peças que chegam sem decote declarado (as roupas fixas de outfits.ts): vestido longo sem alça,
 * paletó com lapela em V, colete em V e camisa social de colarinho fechado por baixo deles. O decote padrão do molde
 * deixava retalhos nos ombros do vestido sem manga e cortava paletó e colete reto no peito. Vale igual para a jogadora e
 * para os figurantes: o uniforme do disfarce continua idêntico ao dos garçons do salão.
 */
export function tailored(pieces: Look3dPiece[]): Look3dPiece[] {
  const sub = (p: Look3dPiece) => (p.subcategory ?? "").toLowerCase();
  const formal = pieces.some((p) => sub(p) === "blazer" || sub(p) === "vest");
  const cut = (p: Look3dPiece): string | null => {
    if (p.attributes?.NECKLINE?.length) return null;
    if (sub(p) === "dress" && p.attributes?.LENGTH?.some((l) => l === "FLOOR_LENGTH" || l === "MAXI")) return "STRAPLESS";
    if (sub(p) === "blazer") return "PLUNGE";
    if (sub(p) === "vest") return "V_NECK";
    if (sub(p) === "shirt" && formal) return "MOCK_NECK";
    return null;
  };
  return pieces.map((p) => { const n = cut(p); return n ? { ...p, attributes: { ...p.attributes, NECKLINE: [n] } } : p; });
}

/* ---------- rosto sintético (looks-face.ts) ---------- */
export { paintFace } from "./looks-face";

/** Quais modelos uma lista de pessoas usa (ordem de chegada), para carregar primeiro o que aparece primeiro. */
export function templatesFor(people: { look: LookId; seed: number }[]): LookTemplate[] {
  const seen = new Map<string, LookTemplate>();
  for (const p of people) { const t = templateFor(p.look, p.seed); if (!seen.has(t.key)) seen.set(t.key, t); }
  return [...seen.values()];
}
