/**
 * Sequências dos comandos manuais (seção 2, coluna "Manual"): posar, desfilar (A Passarela, Dress the Star, Batalha
 * de Looks) e caminhar (O Labirinto, até o espelho; Around the World, pela calçada).
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { ANIMACOES, poseDaVez } from "@/lib/flair/nucleos/scene/animations";
import type { Sequencia } from "@/lib/flair/nucleos/scene/director";
import { LABIRINTO_ESPELHO } from "@/lib/flair/nucleos/scene/salas/labirinto";
import { AVATAR, Roteiro } from "@/lib/flair/nucleos/scene/script";

/** Até onde o avatar vai na passarela e na calçada (z, em direção à câmera). */
export const PONTA_DA_PASSARELA = 2.0;
const PONTA_DO_PALCO = 0.9;
const TRECHO_DE_RUA = 1.4;

/** Giro (graus) que vira o avatar da origem para um ponto do piso. */
export function giroPara(x: number, z: number): number {
  return (Math.atan2(x, z) * 180) / Math.PI;
}

export function sequenciaDaPose(codigo: NucleoCodigo, n: number): Sequencia {
  return new Roteiro("pose").depois(AVATAR, poseDaVez(codigo, n)).fim();
}

/** Ida do comando manual: desfila até a ponta, para e vira; ou caminha até o espelho, ou pela rua. */
export function sequenciaDeIda(codigo: NucleoCodigo): Sequencia | null {
  const r = new Roteiro("ida");
  switch (codigo) {
    case "PASSARELA":
      return r
        .depois(AVATAR, "CAMINHADA_DE_PASSARELA", { repete: 2, mover: { z: PONTA_DA_PASSARELA } })
        .depois(AVATAR, "PARADA_NA_PONTA")
        .depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 180 } })
        .fim();
    case "DRESS_THE_STAR":
      return r
        .depois(AVATAR, "ENTRADA_NO_PALCO", { repete: 2, mover: { z: PONTA_DO_PALCO } })
        .depois(AVATAR, "POSE_DE_ESTRELA")
        .fim();
    case "BATALHA_LOOKS":
      return r
        .depois(AVATAR, "ENTRADA_NO_PALCO", { mover: { z: 0.6 } })
        .depois(AVATAR, "POSE_LADO_A_LADO")
        .fim();
    case "LABIRINTO": {
      const [x, z] = LABIRINTO_ESPELHO;
      return r
        .depois(AVATAR, "MEIA_VOLTA", { mover: { giro: giroPara(x, z) } })
        .depois(AVATAR, "CAMINHAR", { repete: 2, mover: { x, z } })
        .depois(AVATAR, "PARAR_DIANTE_DO_ESPELHO")
        .depois(AVATAR, "APRESENTAR_O_LOOK")
        .fim();
    }
    case "AROUND_THE_WORLD":
      return r
        .depois(AVATAR, "CAMINHADA_DE_RUA", { repete: 2, mover: { z: TRECHO_DE_RUA } })
        .depois(AVATAR, "OLHAR_A_VITRINE")
        .depois(AVATAR, "ACENAR")
        .fim();
    default:
      return null;
  }
}

/** Volta do comando manual: vira para o ponto de partida, caminha até ele e fica de frente outra vez. */
export function sequenciaDeVolta(codigo: NucleoCodigo): Sequencia | null {
  const manual = ANIMACOES[codigo].manual;
  if (!manual) return null;
  const passo = codigo === "PASSARELA" ? "CAMINHADA_DE_PASSARELA" : codigo === "AROUND_THE_WORLD" ? "CAMINHADA_DE_RUA" : "CAMINHAR";
  const r = new Roteiro("volta");
  if (codigo === "DRESS_THE_STAR") r.depois(AVATAR, "REVERENCIA");
  const deCostas = codigo === "LABIRINTO" ? giroPara(-LABIRINTO_ESPELHO[0], -LABIRINTO_ESPELHO[1]) : 180;
  return r
    .depois(AVATAR, "MEIA_VOLTA", { mover: { giro: deCostas } })
    .depois(AVATAR, passo, { repete: 2, mover: { x: 0, z: 0 } })
    .depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } })
    .fim();
}
