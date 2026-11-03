/*
 * Avatar 3D (RF40) — fios de cabelo: o contexto que penteado e fitas compartilham (quadro da cabeça, colisão, ossos,
 * rosto e pele nua livres).
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { AvatarHair } from "../model";
import type { HairTexture } from "../hair";
import { hairline, headFrame, type HairBuild, type HeadFrame } from "./hair-geometry";
import { Shell } from "./strand-shell";
import { lerp, smooth, type V3 } from "./strand-math";

// ------------------------------------------------------------------ contexto (cabeça, colisão, ossos)

export interface StrandContext {
  fr: HeadFrame; shell: Shell; O: V3; k: number; hv: number;
  texture: HairTexture; long: boolean; yBottom: number; shoulderY: number;
  bones: { head: number; neck: number; spine2: number };
  /** frente do rosto abaixo da sobrancelha (canônico ≈ 5,1): nenhum fio passa por ali */
  inFace: (q: V3) => boolean;
  /** ponto deitado na pele nua (testa, têmpora, bochecha — abaixo da linha do cabelo): fio ali vira risco no rosto */
  onSkin: (q: V3) => boolean;
  browY: number;
  variation: number;          // 0–1: variação de tom medida no cabelo (AvatarHair.variation) → amplitude do tom por fio
}

/** Prepara o que penteado e fios precisam. Sem fios (raspado, careca, cobertura, base sem calota): null. */
export function strandContext(a: BodyAsset, c: Composed, hair: AvatarHair, base: HairBuild, volume = 1): StrandContext | null {
  const len0 = hair.length;
  if (!hair.present || hair.cover || !len0 || len0 === "bald" || len0 === "buzz" || base.calotaIndex === undefined) return null;
  const fr = headFrame(a, c); const nb = a.meta.counts.body;
  const texture = hair.texture ?? "straight"; const long = len0 === "medium" || len0 === "long";
  const hv = Math.min(1.9, Math.max(0.7, hair.volume ?? 1)) * Math.min(1.6, Math.max(0.6, volume));
  const bone = (n: string) => a.meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
  const armBones = new Set(a.meta.bones.map((b, i) => (/(Arm|ForeArm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const headB = bone("Head"), neckB = bone("Neck");
  const bpos = (base.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  const headVerts: number[] = [], torso: number[] = [];
  for (let v = 0; v < nb; v++) {
    const x = c.body[v * 3], y = c.body[v * 3 + 1], z = c.body[v * 3 + 2];
    // braços fora da colisão (eles se mexem), menos o alto do ombro (deltoide, osso do braço): sem ele o cabelo longo
    // que cai no ombro atravessava a pele
    // (só a parte perto do pescoço: o ombro inteiro fazia o empurrão radial jogar o cabelo para fora numa "prateleira")
    const b0 = a.body.skinIndex[v * 4]; if (armBones.has(b0) && (y < fr.chinY - 0.135 || Math.hypot(x - fr.cx, z - fr.cz) > 0.145)) continue;
    if (b0 === headB || b0 === neckB) headVerts.push(x, y, z); else torso.push(x, y, z);
    if (y < fr.chinY + 0.02) torso.push(x, y, z);
  }
  const O: V3 = [fr.cx, fr.earY + 0.3 * (fr.headTop - fr.earY), fr.cz];
  const bottomC = long ? Math.min(hair.bottom ?? -12, -4) : 0;
  const yBottom = long ? fr.toY(bottomC) : fr.chinY; const shoulderY = fr.chinY - 0.09;
  const clr = (y: number) => lerp(0.012, 0.03, smooth(fr.chinY - 0.02, shoulderY + 0.02, y));
  const shell = new Shell(O, fr, [bpos, Float32Array.from(headVerts)], [{ p: Float32Array.from(torso), clr }, { p: bpos, clr: () => 0.001 }], yBottom - 0.08);
  const browY = fr.toY(5.1), faceHalf = fr.halfW * 0.8;
  const inFace = (q: V3) => q[1] < browY + 0.008 && q[1] > fr.chinY - 0.05 && q[2] > fr.cz + 0.01 && Math.abs(q[0] - fr.cx) < faceHalf;
  const onSkin = (q: V3) => {
    if (q[1] < fr.chinY - 0.01) return false;
    const phi = Math.atan2(q[0] - fr.cx, q[2] - fr.cz); if (Math.abs(phi) > 1.75) return false;     // nuca: cabelo deitado é normal
    return q[1] < hairline(fr, hair, phi, false) - 0.004 && shell.skinGap(q) < 0.007;
  };
  return { fr, shell, O, k: fr.k, hv, texture, long, yBottom, shoulderY, bones: { head: headB, neck: neckB, spine2: bone("Spine2") }, inFace, onSkin, browY, variation: Math.min(1, Math.max(0, hair.variation ?? 0)) };
}
