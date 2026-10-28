/*
 * MET Gala Heist v2 — roupas fixas da partida (peças do provador sem foto: molde pela subcategoria, cor pelo colorHex).
 * O catálogo de figurantes (looks.ts) usa as mesmas peças para garçons e seguranças, então o uniforme que a jogadora
 * veste é o mesmo que ela vê nos garçons do salão — é isso que faz o disfarce funcionar aos olhos de quem joga.
 * Vestidos de gala: LENGTH = FLOOR_LENGTH dá a saia até o chão (garment-fit.ts).
 */
import type { Look3dPiece } from "@/components/three/common";

const piece = (id: string, slot: string, category: string, subcategory: string, colorHex: string, extra: Partial<Look3dPiece> = {}): Look3dPiece =>
  ({ id: `heist-${id}`, name: `heist-${id}`, slot, category, subcategory, colorHex, imageUrl: null, ...extra });
const LONG = { attributes: { LENGTH: ["FLOOR_LENGTH"] } };

/** Com o que a jogadora chega à avenida: vestido longo preto de alça e scarpin (disfarce de convidada, salto barulhento). */
export const PLAYER_ARRIVAL: Look3dPiece[] = [
  piece("gown-noir", "full", "FULL_BODY", "dress", "#16161c", { ...LONG, material: "SATIN" }),
  piece("heels-noir", "shoes", "SHOES", "heels", "#0e0e10"),
];
/** Uniforme do bufê (caminhão do bufê, armário do labirinto ou revendedor): camisa branca, colete e calça pretos. */
export const WAITER_UNIFORM: Look3dPiece[] = [
  piece("waiter-shirt", "upper", "UPPER", "shirt", "#f3f1ec"),
  piece("waiter-vest", "outer", "UPPER", "vest", "#141416"),
  piece("waiter-pants", "lower", "LOWER", "tailored_pants", "#141416"),
  piece("waiter-shoes", "shoes", "SHOES", "oxford_shoes", "#0c0c0c"),
];
/** Garçonete: o mesmo uniforme com saia lápis. */
export const WAITRESS_UNIFORM: Look3dPiece[] = [WAITER_UNIFORM[0], WAITER_UNIFORM[1], piece("waitress-skirt", "lower", "LOWER", "skirt", "#141416", { attributes: { LENGTH: ["KNEE"] } }), piece("waitress-flats", "shoes", "SHOES", "flats", "#0c0c0c")];
/** Segurança da gala: terno preto, camisa preta. O pesado (Sala das Joias) usa jaqueta tática e coturno. */
export const GUARD_SUIT: Look3dPiece[] = [
  piece("guard-shirt", "upper", "UPPER", "shirt", "#1c1d22"),
  piece("guard-blazer", "outer", "UPPER", "blazer", "#0d0e12"),
  piece("guard-pants", "lower", "LOWER", "tailored_pants", "#0d0e12"),
  piece("guard-shoes", "shoes", "SHOES", "oxford_shoes", "#070707"),
];
export const GUARD_HEAVY: Look3dPiece[] = [
  piece("heavy-tee", "upper", "UPPER", "long_sleeve", "#15171a"),
  piece("heavy-jacket", "outer", "UPPER", "jacket", "#1e2126"),
  piece("heavy-pants", "lower", "LOWER", "cargo_pants", "#16181b"),
  piece("heavy-boots", "shoes", "SHOES", "combat_boots", "#0b0b0b"),
];
export const POLICE_UNIFORM: Look3dPiece[] = [
  piece("police-shirt", "upper", "UPPER", "shirt", "#1d2b45"),
  piece("police-pants", "lower", "LOWER", "tailored_pants", "#141c2c"),
  piece("police-boots", "shoes", "SHOES", "boots", "#090909"),
];
/** Roupa de quem está na rua sem gala (sem uniforme e sem vestido): chama atenção lá dentro. */
export const STREET_CASUAL: Look3dPiece[] = [
  piece("casual-hoodie", "upper", "UPPER", "hoodie", "#2b2f36"),
  piece("casual-jeans", "lower", "LOWER", "jeans", "#2c3d58"),
  piece("casual-sneakers", "shoes", "SHOES", "casual_sneakers", "#d9d9d6"),
];
