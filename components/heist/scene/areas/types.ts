/*
 * MET Gala Heist v2 — contrato de um módulo de área do cenário. Cada área (sala ou grupo de salas do plano construtivo)
 * mora no próprio arquivo em areas/ e só mexe nele: a montagem do interior chama o construtor da área, usa os móveis
 * que ela desenha no lugar dos genéricos, troca o acabamento da casca (piso, parede, teto) quando ela pede e acende a
 * luz principal dela. Assim várias áreas evoluem ao mesmo tempo sem disputar os mesmos arquivos.
 */
import type * as THREE from "three";
import type { Prop, PropKind } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import type { PropsCtx } from "../interior-props";
import type { Quality } from "../interior-tex";
import type { InteriorRoom } from "../interior-shell";
import type { RoomsCtx } from "./kit";

/** Acabamento próprio da casca numa sala (no lugar do que STYLE manda em interior-shell.ts). */
export interface SurfaceOverride {
  /** material do piso (o nome vira "floor-<sala>"); `floorTile` = metros por repetição da textura (u, v) */
  floor?: (q: Quality) => THREE.Material; floorTile?: [number, number];
  /** reflexo planar no "high": [força 0–1, refletância de frente] */
  floorMirror?: [number, number];
  /** material das faces das paredes (com `wallTile` em metros por repetição) */
  wall?: (q: Quality) => THREE.Material; wallTile?: [number, number];
  /** material do teto plano; null = a casca não faz teto (a área desenha o seu, com caixotões, vigas, cúpulas…) */
  ceil?: ((q: Quality) => THREE.Material) | null;
  /** false = sem rodapé e sanca da casca (a área desenha as próprias molduras) */
  trims?: boolean;
}
/** Luz principal com sombra de uma sala (a que acompanha a jogadora): posição, alvo, abertura, intensidade e cor. */
export interface KeyDef { p: [number, number, number]; aim: [number, number, number]; angle: number; i: number; color: string }
/** Algo que anima a cada quadro (só roda quando a sala aparece): discos espelhados, luzes da pista, chamas, telas. */
export type Tick = (t: number, dt: number, v: SceneView) => void;

export interface AreaModule {
  /** nome curto da área (vestibulo, salao, lounge…) */
  id: string;
  /** salas que a área decora (InteriorRoom) */
  rooms: InteriorRoom[];
  /** decoração sem colisão, luzes-âncora (c.anchors) e animações (c.ticks) — roda depois da casca e dos móveis */
  dress: (c: RoomsCtx) => void;
  /** móveis da planta desenhados pela área, por tipo (só nas salas dela). "fixture" = móveis próprios (Prop.model) */
  props?: Partial<Record<PropKind, (p: Prop, c: PropsCtx) => void>>;
  /** acabamento próprio da casca por sala */
  surfaces?: Partial<Record<InteriorRoom, SurfaceOverride>>;
  /** luz principal com sombra por sala (substitui a de interior-fx) */
  keys?: Partial<Record<InteriorRoom, KeyDef[]>>;
}
