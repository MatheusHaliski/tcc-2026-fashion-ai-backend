/**
 * Zonas da sala (seção 3, "zonas marcadas"): a zona do avatar, a dos personagens e a de decoração. Nenhuma das duas
 * últimas invade a zona da roupa: a faixa na frente do avatar, do topo da cabeça aos pés, fica sempre livre.
 */
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { partesNoLugar, volumeDaParte } from "@/lib/flair/nucleos/scene/parts";
import type { Movel, Sala, Zona } from "@/lib/flair/nucleos/scene/types";

/** Meia largura da faixa livre e até onde ela vai para trás do avatar (metros). */
export const ROUPA_MEIA_LARGURA = 0.8;
export const ROUPA_ATRAS = -0.5;
/** Abaixo disto um objeto é piso (tapete, marca, tablado baixo) e não cobre a roupa. */
export const ALTURA_DE_PISO = 0.25;
/** Acima disto um objeto está sobre a cabeça (trilho de spots, lustre) e também não cobre. */
export const ALTURA_LIVRE = 2.1;
/** Distância máxima da câmera ao avatar (zoom todo afastado). */
export const CAMERA_MAX = 5.8;

/** Até onde a faixa livre vai para a frente: a posição mais afastada da câmera nesta sala. */
export function limiteDaCamera(sala: Sala): number {
  return Math.min(CAMERA_MAX, sala.cameraMax ?? CAMERA_MAX);
}

export function zonaContem(zona: Zona, x: number, z: number): boolean {
  return x >= zona.x[0] && x <= zona.x[1] && z >= zona.z[0] && z <= zona.z[1];
}

/** A zona (retângulo no piso) entra na faixa livre entre o avatar e a câmera? */
export function zonaInvadeRoupa(zona: Zona, ateZ = CAMERA_MAX): boolean {
  const cruzaX = zona.x[0] < ROUPA_MEIA_LARGURA && zona.x[1] > -ROUPA_MEIA_LARGURA;
  return cruzaX && zona.z[1] > ROUPA_ATRAS && zona.z[0] < ateZ;
}

/** Um retângulo no piso (centro e meias medidas) cobre a roupa? */
export function cobreRoupa(x: number, z: number, meioX: number, meioZ = meioX, ateZ = CAMERA_MAX): boolean {
  return Math.abs(x) - meioX < ROUPA_MEIA_LARGURA && z + meioZ > ROUPA_ATRAS && z - meioZ < ateZ;
}

/** Partes do móvel entre o piso e a cabeça que entram na faixa livre (0 = o móvel respeita a zona da roupa). */
export function partesQueCobremRoupa(m: Movel, ateZ = CAMERA_MAX): number {
  return partesNoLugar(m).filter((p) => {
    const v = volumeDaParte(p);
    return v.topo > ALTURA_DE_PISO && v.base < ALTURA_LIVRE && cobreRoupa(p.pos[0], p.pos[2], v.meioX, v.meioZ, ateZ);
  }).length;
}

/** O móvel inteiro fica acima da cabeça (preso no teto)? */
export function movelNoTeto(m: Movel): boolean {
  return partesNoLugar(m).every((p) => volumeDaParte(p).base >= ALTURA_LIVRE);
}

/** O móvel está dentro de alguma zona do tipo dele? (o que fica no teto não ocupa zona do piso) */
export function movelNaZona(sala: Sala, m: Movel): boolean {
  if (movelNoTeto(m)) return true;
  if (m.zona === "avatar") return zonaContem(sala.zonas.avatar, m.pos[0], m.pos[2]);
  return sala.zonas[m.zona].some((z) => zonaContem(z, m.pos[0], m.pos[2]));
}

export function personagemNaZona(sala: Sala, p: NucleoPersonagem): boolean {
  return sala.zonas.personagens.some((z) => zonaContem(z, p.pos[0], p.pos[2]));
}
