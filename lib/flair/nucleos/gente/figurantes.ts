/**
 * Os figurantes das salas dos jogos (plateia, fotógrafos, adversário, cliente, torcida, convidados) como gente
 * (pedido da dona de 15/11/2026): cada personagem do arquivo do núcleo vira uma pessoa do elenco humano, com a roupa do
 * papel na cor que o arquivo dá, e um movimento (sentada na plateia, torcendo, fotografando, parada). Manequim, câmera e
 * claquete continuam objetos. O corpo varia com a semente do jogo e com o lugar. Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { Sex } from "@/lib/avatar3d/body-spec";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { pessoaDaSemente, sorteio, type PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";

/** Papéis que não são gente (objetos de cena desenhados como silhueta). */
export const NAO_HUMANOS = new Set(["MANEQUIM", "CAMERA", "CLAQUETE"]);

const peca = (id: string, slot: string, category: string, subcategory: string, cor: string, extra: Partial<Look3dPiece> = {}): Look3dPiece =>
  ({ id: `fig-${id}`, name: `fig-${id}`, slot, category, subcategory, colorHex: cor, imageUrl: null, ...extra });

/** A roupa do papel, com a cor do arquivo do núcleo na peça principal; no esporte, colegas e adversários de uniforme. */
export function roupaDoPapel(id: string, papel: string, cor: string, sexo: Sex, esporte = false): Look3dPiece[] {
  if (esporte && (papel === "COLEGA" || papel === "ADVERSARIO" || papel === "RESERVA")) {
    return [peca(`${id}-c`, "upper", "UPPER", "t_shirt", cor), peca(`${id}-l`, "lower", "LOWER", "shorts", "#F5F4F0", { attributes: { LENGTH: ["MID_THIGH"] } }), peca(`${id}-s`, "shoes", "SHOES", "casual_sneakers", "#151515")];
  }
  switch (papel) {
    case "FOTOGRAFO":
    case "FOTOGRAFA":
      return [peca(`${id}-c`, "upper", "UPPER", "t_shirt", "#1B1C1F"), peca(`${id}-j`, "outer", "UPPER", "jacket", cor), peca(`${id}-l`, "lower", "LOWER", "cargo_pants", "#3B3E44"), peca(`${id}-s`, "shoes", "SHOES", "casual_sneakers", "#1C1C1C")];
    case "TORCIDA":
    case "TORCEDOR":
      return [peca(`${id}-c`, "upper", "UPPER", "t_shirt", cor), peca(`${id}-l`, "lower", "LOWER", "jeans", "#26324A"), peca(`${id}-s`, "shoes", "SHOES", "casual_sneakers", "#EDEBE6")];
    case "SEGURANCA":
      return [peca(`${id}-c`, "upper", "UPPER", "shirt", "#F2F0EA"), peca(`${id}-p`, "outer", "UPPER", "blazer", "#121216"), peca(`${id}-l`, "lower", "LOWER", "tailored_pants", "#121216"), peca(`${id}-s`, "shoes", "SHOES", "oxford_shoes", "#0A0A0A")];
    case "VENDEDORA":
      // o uniforme da loja: camisa clara, calça de alfaiataria na cor da casa e sapato baixo, para qualquer pessoa
      return [peca(`${id}-c`, "upper", "UPPER", "shirt", "#F4EFE6"), peca(`${id}-l`, "lower", "LOWER", "tailored_pants", cor), peca(`${id}-s`, "shoes", "SHOES", "loafers", "#1A1A1C")];
    case "ESTRELA":
      return [peca(`${id}-v`, "full", "FULL_BODY", "dress", cor, { material: "SATIN", attributes: { LENGTH: ["FLOOR_LENGTH"] } }), peca(`${id}-s`, "shoes", "SHOES", "heels", "#141414")];
    default:
      return sexo === "FEMININO"
        ? [peca(`${id}-v`, "full", "FULL_BODY", "dress", cor, { attributes: { LENGTH: ["MIDI"] } }), peca(`${id}-s`, "shoes", "SHOES", "heels", "#141414")]
        : [peca(`${id}-c`, "upper", "UPPER", "shirt", "#EEF0F4"), peca(`${id}-p`, "outer", "UPPER", "blazer", cor), peca(`${id}-l`, "lower", "LOWER", "tailored_pants", "#1E1E24"), peca(`${id}-s`, "shoes", "SHOES", "oxford_shoes", "#0A0A0A")];
  }
}

/** O id de cena do figurante: o papel e o índice dele no papel (o mesmo nome de ator do diretor de cena). */
export function idDoFigurante(lista: NucleoPersonagem[], i: number): string {
  const p = lista[i];
  return `fig:${p.papel}:${lista.slice(0, i).filter((x) => x.papel === p.papel).length}`;
}

export function ehGente(p: NucleoPersonagem): boolean {
  return !NAO_HUMANOS.has(p.papel) && p.postura !== "busto";
}

/** As pessoas dos figurantes humanos, pelo id de cena. */
export function pessoasDosFigurantes(semente: number, lista: NucleoPersonagem[], esporte = false): Map<string, PessoaDoElenco> {
  const out = new Map<string, PessoaDoElenco>();
  lista.forEach((p, i) => {
    if (!ehGente(p)) return;
    const id = idDoFigurante(lista, i);
    const sexo: Sex = sorteio(semente, `${id}:sexo`) < 0.5 ? "FEMININO" : "MASCULINO";
    out.set(id, pessoaDaSemente(semente, id, sexo, roupaDoPapel(id, p.papel, p.cor, sexo, esporte)));
  });
  return out;
}

/** O movimento de cada papel: sentada na plateia, torcendo, fotografando, parada. */
export function movimentoDoPapel(p: NucleoPersonagem): Motion {
  if (p.postura === "sentada") return "sit";
  if (p.papel === "TORCIDA") return "cheer";
  if (p.papel === "FOTOGRAFO" || p.papel === "FOTOGRAFA") return "photo";
  if (p.papel === "PLATEIA" || p.papel === "CONVIDADO" || p.papel === "TORCEDOR") return "talk";
  if (p.papel === "CLIENTE_DA_LOJA") return "look";
  return "idle";
}

/** Os atores de cena dos figurantes humanos (lugar e giro do arquivo do núcleo). */
export function atoresDosFigurantes(lista: NucleoPersonagem[]): AtorDeCena[] {
  return lista.flatMap((p, i) => (ehGente(p) ? [{ id: idDoFigurante(lista, i), x: p.pos[0], z: p.pos[2], altura: p.pos[1], giro: ((p.giro ?? 0) * Math.PI) / 180, anim: movimentoDoPapel(p), velocidade: 0 }] : []));
}
