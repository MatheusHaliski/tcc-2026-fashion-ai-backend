/**
 * Prévia 2D (RF28, PROV-2D): o mesmo Avatar 3D do espelho, de frente e parado, guardado como imagem.
 *
 * Este módulo é a parte sem WebGL:
 *  - stillKey: o que muda a imagem (avatar, ajustes, corpo, peças, fundo). Mesma chave, mesma foto.
 *  - StillCache: as últimas fotos, só em memória (a foto tem o rosto da pessoa: nunca vai para localStorage, servidor
 *    ou log).
 *  - stillReady: a cena só é fotografada quando o corpo está vestido, as fotos das peças do look atual chegaram, os
 *    olhos têm textura e a pele já tem o rosto da foto (quando o avatar tem foto).
 */
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";

export interface StillInput {
  avatar: Avatar3dRef | null;
  sex: "FEMININO" | "MASCULINO";
  body: BodyParams | null;
  pieces: Look3dPiece[];
  background: string;
}

/** FNV-1a de 32 bits em base 36: chave curta e estável (não reversível; não guarda medidas nem forma do rosto). */
export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** Impressão do modelo: amostra da forma do rosto, pele, cabelo, corpo e sexo (o suficiente para mudar quando ele muda). */
function modelPrint(a: Avatar3dRef | null): string {
  const m = a?.model; if (!m) return "sem-avatar";
  const shape = Array.isArray(m.shape) ? m.shape : [];
  let acc = 0; for (let i = 0; i < shape.length; i += 7) acc = (acc * 31 + Math.round(shape[i] * 10)) | 0;
  return [m.v, shape.length, acc, m.skin, JSON.stringify(m.hair ?? null), JSON.stringify(m.body ?? null), m.sex ?? "", a?.version ?? ""].join("~");
}

export function stillKey(i: StillInput): string {
  const pieces = i.pieces.map((p) => [p.id, p.slot, p.category ?? "", p.subcategory ?? "", p.imageUrl ?? "", p.studioUrl ?? "", p.colorHex ?? ""].join(":")).sort();
  const raw = [modelPrint(i.avatar), i.avatar?.textureUrl ?? "", JSON.stringify(i.avatar?.adjust ?? null), i.sex, JSON.stringify(i.body ?? null), pieces.join("|"), i.background].join("#");
  return `still-${fnv(raw)}-${raw.length.toString(36)}`;
}

/** Últimas fotos (LRU), só em memória. */
export class StillCache {
  private m = new Map<string, string>();
  constructor(private readonly max = 12) {}
  get(k: string): string | null {
    const v = this.m.get(k); if (v === undefined) return null;
    this.m.delete(k); this.m.set(k, v);                       // usada agora: vai para o fim
    return v;
  }
  set(k: string, v: string): void {
    this.m.delete(k); this.m.set(k, v);
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
  }
  get size(): number { return this.m.size; }
  clear(): void { this.m.clear(); }
}

export const STILLS = new StillCache();

/** A cena pode ser fotografada? (userData do corpo humano, preenchido por HumanAvatar e HumanOutfit.) */
export function stillReady(ud: Record<string, unknown> | null | undefined, expectFace: boolean): boolean {
  if (!ud || ud.dressed !== true || ud.outfitReady !== true || ud.eyesReady !== true) return false;
  return expectFace ? ud.skin === "baked" : ud.skin === "color" || ud.skin === "baked";
}

/** Quadros seguidos prontos antes da foto (a textura nova sobe para a GPU no quadro seguinte ao needsUpdate). */
export const STILL_STABLE_FRAMES = 3;
/** Limites: corpo pronto mas algo não chegou (foto de peça fora do ar) e corpo que nem carregou (manequim de reserva). */
export const STILL_LATE_MS = 20_000;
export const STILL_GIVE_UP_MS = 25_000;

/**
 * Decide, a cada quadro, se é hora da foto. `elapsed` em ms desde a montagem; `stable` é quantos quadros seguidos
 * estavam prontos. Devolve o novo `stable` e se deve fotografar.
 */
export function stillTick(ud: Record<string, unknown> | null | undefined, expectFace: boolean, stable: number, elapsed: number): { stable: number; shoot: boolean } {
  const ready = stillReady(ud, expectFace);
  const late = (!!ud && ud.dressed === true && elapsed > STILL_LATE_MS) || elapsed > STILL_GIVE_UP_MS;
  const next = ready || late ? stable + 1 : 0;
  return { stable: next, shoot: next >= STILL_STABLE_FRAMES };
}
