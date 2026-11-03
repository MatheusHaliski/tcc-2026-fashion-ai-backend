/*
 * MET Gala Heist v2 — os móveis do interior, um construtor por tipo de móvel da planta (lib/heist/level.ts → baseProps e
 * as araras de RACKS). Cada peça é desenhada EXATAMENTE na forma de colisão (caixa ou círculo, giro e variante): o que se
 * vê é o que barra o passo e o olhar. Alturas seguem a regra da planta: "low" fica abaixo de ~1,1 m (esconde quem está
 * agachado), "tall" passa de 1,8 m (tapa a visão), "glass" é vitrine.
 *
 * Tudo vai para os lotes da sala (Batch: geometria mesclada por material; Instances: o que se repete) e devolve pontos de
 * luz (LightAnchor) para o conjunto de luzes dinâmicas do interior.
 *
 * Este arquivo despacha cada móvel para o construtor da família dele: salão e mesas (interior-props-hall), palco e
 * produção (interior-props-stage), mobília (interior-props-furniture), peças em exposição (interior-props-display),
 * segurança e doca (interior-props-security); o referencial e as geometrias comuns ficam em interior-props-kit e os
 * textos e telas desenhados em interior-props-textures.
 */
import * as THREE from "three";
import { areaProp } from "./areas";
import { hasModel } from "@/lib/heist/models";
import type { Prop, RoomId } from "@/lib/heist/types";
import type { Batch, Instances } from "./interior-batch";
import { fabric, type Palette } from "./interior-mats";
import type { Quality } from "./interior-tex";
import { candelabra } from "./interior-hall";
import type { InteriorCopy } from "./interior-copy";
import type { InteriorRoom } from "./interior-shell";
import { box } from "./interior-props-kit";
import { cocktailTable, column, planter, sideTable } from "./interior-props-hall";
import { ledWall, makeupMirror, monitorWall, quartetStage, runwayStage, steamer } from "./interior-props-stage";
import { bar, bench, coatCheck, desk, piano, rack, sofa, wallMirror } from "./interior-props-furniture";
import { jewelCase, mannequin, pedestal, statue, vitrine } from "./interior-props-display";
import { crate, detector, fusePanel, monitorDesk, rope, safe } from "./interior-props-security";

export interface LightAnchor { x: number; y: number; z: number; color: string; intensity: number; distance: number; room: InteriorRoom; flicker?: number; alarm?: boolean }
export interface PropsCtx {
  q: Quality; P: Palette; batch: Batch; inst: Instances; copy: InteriorCopy; anchors: LightAnchor[]; flames: THREE.Vector3[];
  /** malhas que animam (telas, monitores, vapor) e o diamante */
  animated: { kind: "screen" | "cctv" | "steam" | "diamond" | "glint"; mesh: THREE.Object3D; room: InteriorRoom }[];
  group: THREE.Group;
}

/** Pegada do móvel no referencial dele: largura (x local), profundidade (z local, a frente olha para +z local) e giro. */
export interface Foot { cx: number; cz: number; w: number; d: number; yaw: number; r: number }
export function foot(p: Prop): Foot {
  const yaw = p.yaw ?? 0;
  if (p.shape.type === "circle") return { cx: p.shape.x, cz: p.shape.z, w: p.shape.r * 2, d: p.shape.r * 2, yaw, r: p.shape.r };
  const sx = p.shape.x1 - p.shape.x0, sz = p.shape.z1 - p.shape.z0, swap = Math.abs(Math.sin(yaw)) > 0.5;
  return { cx: (p.shape.x0 + p.shape.x1) / 2, cz: (p.shape.z0 + p.shape.z1) / 2, w: swap ? sz : sx, d: swap ? sx : sz, yaw, r: Math.min(sx, sz) / 2 };
}

/* textos desenhados dos móveis e a geometria do diamante, usados também pelas áreas (areas/*) e por interior-fx */
export { callSheetTexture, cctvTexture, placardTexture } from "./interior-props-textures";
export { diamondGeometry } from "./interior-props-display";

/* ======================= construtores por tipo ======================= */
/** Tipos de móvel com construtor próprio (o resto vira um bloco preto — o teste garante que nenhum do interior cai nele). */
export const BUILT_KINDS = new Set<Prop["kind"]>(["column", "table", "stage", "screen", "desk", "sofa", "planter", "bar", "mirror", "piano", "steamer", "mannequin", "case", "bench", "statue", "pedestal", "monitor", "safe", "panel", "crate", "coatcheck", "detector", "rope", "rack", "floral", "fixture"]);
export function buildProp(p: Prop, c: PropsCtx) {
  const f = foot(p), room = p.room as InteriorRoom, P = c.P;
  // móvel com modelo 3D gerado (lib/heist/models.ts): HeistModels carrega o GLB no lugar do desenho procedural
  if (p.kind === "fixture" && hasModel(p.model)) return;
  // a área da sala desenha o móvel (areas/*): móveis próprios ("fixture") e versões dela dos genéricos
  const own = areaProp(p); if (own) return own(p, c);
  switch (p.kind) {
    case "column": return column(c, room, f);
    case "table": return p.room === "lounge" ? sideTable(c, room, f) : cocktailTable(c, room, f, p.id);
    case "stage": return p.variant === 1 ? quartetStage(c, room, f) : runwayStage(c, room, f);
    case "screen": return p.room === "bastidores" ? monitorWall(c, room, f) : ledWall(c, room, f);
    case "desk": return desk(c, room, f, p.variant ?? 0);
    case "sofa": return sofa(c, room, f, p.room === "terraco" ? P.canvasWhite : p.room === "lounge" ? fabric("loungeVelvet", "#3b1f52", c.q) : P.velvetRose);
    case "planter": return planter(c, room, f, p.id);
    case "bar": return bar(c, room, f);
    case "mirror": return p.room === "bastidores" ? makeupMirror(c, room, f) : wallMirror(c, room, f);
    case "piano": return piano(c, room, f);
    case "steamer": return steamer(c, room, f);
    case "mannequin": return mannequin(c, room, f, p.id);
    case "case": return p.room === "cofre" ? jewelCase(c, room, f, p.id) : vitrine(c, room, f, p.variant ?? 0, p.id);
    case "bench": return bench(c, room, f);
    case "statue": return statue(c, room, f, p.id);
    case "pedestal": return pedestal(c, room, f);
    case "monitor": return monitorDesk(c, room, f);
    case "safe": return safe(c, room, f);
    case "panel": return fusePanel(c, room, f);
    case "crate": return crate(c, room, f, p.height, p.variant ?? 0, p.id);
    case "coatcheck": return coatCheck(c, room, f);
    case "detector": return detector(c, room, f);
    case "rope": return rope(c, room, f);
    case "rack": return rack(c, room, f, p.id);
    case "floral": return;                                                       // a instalação floral é de interior-hall
    case "fixture": return box(c, room, P.black, f, 0, 0, 0, f.w, p.height === "tall" ? 2 : 0.9, f.d);   // sem construtor na área ainda
    default: box(c, room, P.black, f, 0, 0, 0, f.w, 1, f.d);
  }
}

export const INTERIOR_PROP_ROOMS: RoomId[] = ["vestibulo", "salao", "galeria", "lounge", "terraco", "bastidores", "servico", "seguranca", "doca", "cofre"];
export { candelabra };
