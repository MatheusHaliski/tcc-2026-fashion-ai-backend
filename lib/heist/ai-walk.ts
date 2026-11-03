/* MET Gala Heist v2 — locomoção de seguranças e civis pelo caminho da navegação (walkTo). */
import type { SimState, Vec } from "./types";
import { collide } from "./world";
import { findPath } from "./nav";
import { CIV_R, GUARD_R, type SimCtx } from "./state";
import { dist, norm, turn, yawOf } from "./math";

export const OPEN_ALL = { doors: {} as Record<string, boolean>, crouch: false };

/** Anda até `goal` pelo caminho da navegação (refeito quando o alvo muda ou a cada 1,5 s). Devolve se chegou. */
export function walkTo(s: SimState, ctx: SimCtx, a: { pos: Vec; vel: Vec; yaw: number; path: Vec[]; pathIdx: number }, goal: Vec, speed: number, dt: number, who: "staff" | "guest", replan: { at: number; goal: Vec | null } | null): boolean {
  if (dist(a.pos, goal) < 0.35) { a.vel.x = a.vel.z = 0; return true; }
  const need = !a.path.length || a.pathIdx >= a.path.length || (replan && (!replan.goal || dist(replan.goal, goal) > 0.8 || s.time > replan.at));
  if (need) {
    const p = findPath(who === "staff" ? ctx.staffNav : ctx.guestNav, a.pos, goal, 9000);
    a.path = p ?? [goal]; a.pathIdx = 0;
    if (replan) { replan.at = s.time + 1.5; replan.goal = { ...goal }; }
  }
  let tgt = a.path[a.pathIdx];
  while (tgt && dist(a.pos, tgt) < 0.3 && a.pathIdx < a.path.length - 1) tgt = a.path[++a.pathIdx];
  if (!tgt) return true;
  const d = norm({ x: tgt.x - a.pos.x, z: tgt.z - a.pos.z });
  a.vel.x = d.x * speed; a.vel.z = d.z * speed;
  a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
  a.yaw = turn(a.yaw, yawOf(d), 7 * dt);
  collide(ctx.world, a.pos, who === "staff" ? GUARD_R : CIV_R, who === "staff" ? "staff" : "guest", OPEN_ALL as never);
  return dist(a.pos, goal) < 0.4;
}
