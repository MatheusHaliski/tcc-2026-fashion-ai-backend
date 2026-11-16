/**
 * Quem aparece em cada sala do caso, como gente (lib/flair/nucleos/gente): os vigias do servidor (pelo papel) e as
 * personagens do elenco numerado de FASHION_DETECTIVE_HISTORIA.md, cada uma vestida como a história descreve. O corpo,
 * a pele e o cabelo saem da semente da partida; a roupa sai do papel. Ninguém tem arma. Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { Sex } from "@/lib/avatar3d/body-spec";
import { pessoaDaSemente, type PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

const peca = (id: string, slot: string, category: string, subcategory: string, cor: string, extra: Partial<Look3dPiece> = {}): Look3dPiece =>
  ({ id: `dtv-${id}`, name: `dtv-${id}`, slot, category, subcategory, colorHex: cor, imageUrl: null, ...extra });

/** A roupa de cada papel (vigias e elenco). */
const ROUPAS: Record<string, { sexo: Sex; pecas: (id: string) => Look3dPiece[] }> = {
  SEGURANCA: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "shirt", "#F2F0EA"), peca(`${i}-p`, "outer", "UPPER", "blazer", "#121216"), peca(`${i}-l`, "lower", "LOWER", "tailored_pants", "#121216"), peca(`${i}-s`, "shoes", "SHOES", "oxford_shoes", "#0A0A0A")] },
  VIGIA: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "long_sleeve", "#1D2F4F"), peca(`${i}-l`, "lower", "LOWER", "cargo_pants", "#1D2F4F"), peca(`${i}-s`, "shoes", "SHOES", "boots", "#141414")] },
  ASSISTENTE: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "t_shirt", "#151517"), peca(`${i}-l`, "lower", "LOWER", "tailored_pants", "#151517"), peca(`${i}-s`, "shoes", "SHOES", "casual_sneakers", "#EDEBE6")] },
  PORTEIRO: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "t_shirt", "#151517"), peca(`${i}-j`, "outer", "UPPER", "jacket", "#22242A"), peca(`${i}-l`, "lower", "LOWER", "jeans", "#1F2A3D"), peca(`${i}-s`, "shoes", "SHOES", "boots", "#141414")] },
  RAFA: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "t_shirt", "#E9E7E1"), peca(`${i}-j`, "outer", "UPPER", "jacket", "#B9BCC2"), peca(`${i}-l`, "lower", "LOWER", "cargo_pants", "#2B2F36"), peca(`${i}-s`, "shoes", "SHOES", "high_top_sneakers", "#F2F0EA")] },
  TEO: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "shirt", "#5A6E8C"), peca(`${i}-v`, "outer", "UPPER", "vest", "#8A6A3E"), peca(`${i}-l`, "lower", "LOWER", "chino_pants", "#C8B79A"), peca(`${i}-s`, "shoes", "SHOES", "loafers", "#3A2A1E")] },
  IOLANDA: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "blouse", "#F4F1EA"), peca(`${i}-p`, "outer", "UPPER", "blazer", "#D8CBB2"), peca(`${i}-l`, "lower", "LOWER", "tailored_pants", "#D8CBB2"), peca(`${i}-s`, "shoes", "SHOES", "flats", "#6B4A32")] },
  BENTO: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "shirt", "#EEF0F4"), peca(`${i}-p`, "outer", "UPPER", "blazer", "#1B2440"), peca(`${i}-l`, "lower", "LOWER", "tailored_pants", "#1B2440"), peca(`${i}-s`, "shoes", "SHOES", "oxford_shoes", "#D9CFC0")] },
  CLEO: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "cardigan", "#8C8C90"), peca(`${i}-a`, "lower", "LOWER", "skirt", "#B49B72", { attributes: { LENGTH: ["KNEE"] } }), peca(`${i}-s`, "shoes", "SHOES", "loafers", "#2A2A2A")] },
  DALIA: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-v`, "full", "FULL_BODY", "dress", "#141416", { attributes: { LENGTH: ["MIDI"] } }), peca(`${i}-s`, "shoes", "SHOES", "heels", "#B3122A")] },
  OTTO: { sexo: "MASCULINO", pecas: (i) => [peca(`${i}-c`, "upper", "UPPER", "shirt", "#DADCE0"), peca(`${i}-p`, "outer", "UPPER", "blazer", "#0F0F12"), peca(`${i}-l`, "lower", "LOWER", "tailored_pants", "#0F0F12"), peca(`${i}-s`, "shoes", "SHOES", "oxford_shoes", "#0A0A0A")] },
  NINA: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-v`, "full", "FULL_BODY", "dress", "#EFE6D6", { material: "SATIN", attributes: { LENGTH: ["FLOOR_LENGTH"] } }), peca(`${i}-s`, "shoes", "SHOES", "flats", "#F4F1EA")] },
  LIA: { sexo: "FEMININO", pecas: (i) => [peca(`${i}-m`, "full", "FULL_BODY", "jumpsuit", "#0D0D10", { attributes: { SLEEVE_LENGTH: ["LONG_SLEEVE"] } }), peca(`${i}-s`, "shoes", "SHOES", "casual_sneakers", "#F0EFE9")] },
};

export const PAPEIS = Object.keys(ROUPAS);

/** Personagens do elenco paradas em cada sala (só cena; quem age é o vigia do servidor): papel, x, z e giro (graus). */
export const ELENCO_DAS_SALAS: Record<string, [string, number, number, number][]> = {
  ENTRADA: [["IOLANDA", -1.6, 2.6, 160]],
  SALAO: [["BENTO", 3.3, 2.4, 200], ["DALIA", -3.4, 2.5, 150]],
  SEGURANCA: [["OTTO", 3.4, 2.3, 210]],
  CAMARIM: [["NINA", -1.4, 2.6, 170]],
  CLUBE: [["LIA", 1.6, 2.6, 180]],
  ATELIE: [["CLEO", -0.4, -2.9, 10]],
  ARQUIVO: [],
  ESCRITORIO: [],
  PASSARELA: [["IOLANDA", -1.4, -2.6, 20], ["BENTO", 1.6, -2.7, -20]],
};

/** A pessoa de um papel (o corpo varia com a semente e com o id; a roupa é a do papel). */
export function pessoaDoPapel(semente: number, id: string, papel: string): PessoaDoElenco {
  const r = ROUPAS[papel] ?? ROUPAS.ASSISTENTE;
  return pessoaDaSemente(semente, `dtv:${id}`, r.sexo, r.pecas(id));
}
