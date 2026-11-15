/**
 * Quem joga a partida do Fashion Sports, como gente (lib/flair/nucleos/gente/elenco.ts): cada jogador dos dois times tem
 * corpo, altura, pele e cabelo próprios, tirados da semente da partida, e veste o uniforme do time (camisa, calção e
 * calçado nas cores dele). O goleiro do futebol veste camisa de manga longa em outra cor, como manda a regra. Os dois
 * times têm o mesmo sexo, sorteado pela semente. Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import type { Sex } from "@/lib/avatar3d/body-spec";
import { pessoaDaSemente, sorteio, type PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import { UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";
import type { Figura, Gesto } from "@/lib/flair/esporte/timeline";
import type { Lado } from "@/lib/flair/esporte/types";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";

/** Camisas de goleiro: cores que não se confundem com nenhum dos dois uniformes. */
const GOLEIRO = { NOS: "#E8C547", ELES: "#4FB3D9" } as const;

const peca = (id: string, slot: string, category: string, subcategory: string, cor: string, extra: Partial<Look3dPiece> = {}): Look3dPiece =>
  ({ id: `elenco-${id}`, name: `elenco-${id}`, slot, category, subcategory, colorHex: cor, imageUrl: null, ...extra });

/** O uniforme do time como peças do corpo 3D. */
export function pecasDoUniforme(id: string, u: Uniforme, goleiro: string | null = null): Look3dPiece[] {
  const camisa = goleiro
    ? peca(`${id}-camisa`, "upper", "UPPER", "long_sleeve", goleiro, { material: "POLYESTER", attributes: { SLEEVE_LENGTH: ["LONG_SLEEVE"] } })
    : peca(`${id}-camisa`, "upper", "UPPER", "t_shirt", u.camisa, { material: "POLYESTER", attributes: { SLEEVE_LENGTH: ["SHORT_SLEEVE"] } });
  return [
    camisa,
    peca(`${id}-calcao`, "lower", "LOWER", "shorts", u.calcao, { material: "POLYESTER", attributes: { LENGTH: ["MID_THIGH"] } }),
    peca(`${id}-calcado`, "shoes", "SHOES", "casual_sneakers", u.calcado),
  ];
}

export const chaveDoJogador = (time: Lado, n: number) => `${time}-${n}`;

/** O elenco dos dois times da partida: jogador ("NOS-1", "ELES-3"…) → pessoa. */
export function elencoDaPartida(semente: number, campo: Campo, uniforme: Uniforme): Map<string, PessoaDoElenco> {
  const sexo: Sex = sorteio(semente, "sexo-dos-times") < 0.5 ? "FEMININO" : "MASCULINO";
  const out = new Map<string, PessoaDoElenco>();
  for (const time of ["NOS", "ELES"] as const) {
    const u = time === "NOS" ? uniforme : UNIFORME_VISITANTE;
    for (let n = 1; n <= campo.jogadores; n++) {
      const goleiro = campo.alvo === "trave" && n === 1 ? GOLEIRO[time] : null;
      const chave = chaveDoJogador(time, n);
      out.set(chave, pessoaDaSemente(semente, chave, sexo, pecasDoUniforme(chave, u, goleiro), goleiro ? [1.78, 1.95] : [1.62, 1.9]));
    }
  }
  return out;
}

/** Velocidade da corrida (m/s): a passada do corpo humano acompanha. */
const CORRIDA = 4.5;
/** O gesto da linha do tempo na locomoção do corpo humano. */
const MOVIMENTO: Record<Gesto, Motion> = { parado: "idle", corre: "run", chuta: "idle", defende: "crouch", mergulha: "idle", comemora: "celebrate", lamenta: "tired" };

/** Um jogador do quadro como ator de cena: lugar no mundo, giro do corpo, movimento e o que vai por cima dele. */
export function atorDoJogador(f: Figura, noMundo: (x: number, y: number) => [number, number], naJogada: boolean): AtorDeCena {
  const [x, z] = noMundo(f.x, f.y);
  return {
    id: chaveDoJogador(f.time, f.n),
    x,
    z,
    // giro 0 olha para +x no campo do servidor; o corpo humano olha para +z
    giro: -f.giro + Math.PI / 2,
    anim: MOVIMENTO[f.gesto],
    velocidade: f.gesto === "corre" ? CORRIDA : 0,
    oculto: f.oculto,
    naJogada,
    tombo: f.gesto === "mergulha" ? 1.15 : 0,
    altura: f.gesto === "mergulha" ? 0.25 : 0,
    chute: f.gesto === "chuta" ? 1 : 0,
  };
}
