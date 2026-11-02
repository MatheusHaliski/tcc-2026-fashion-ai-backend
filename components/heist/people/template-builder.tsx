"use client";
/*
 * MET Gala Heist v2 — montagem de um modelo (people.tsx): veste o corpo de uma aparência de looks.ts uma vez (escondido),
 * prende os acabamentos, conserta os tecidos, prepara a boca e o esqueleto, e entrega o modelo pronto para ser clonado.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import { makeRig } from "@/lib/avatar3d/human/locomotion";
import { paintFace, tailored, type LookTemplate } from "@/lib/heist/looks";
import { fixFabrics, mendGarments } from "./fabric";
import { makeEarpiece, makePocketSquare } from "./holds";
import { addMouthMorph } from "./mouth";
import { addBowTie, addChefHat, addJewelry, frontOf, tameHairShell } from "./accessories";
import { longSkirt, type Template } from "./person";

export function TemplateBuilder({ t, hairLod, onDone }: { t: LookTemplate; hairLod: HairLod; onDone: (tp: Template) => void }) {
  const atlas = useMemo(() => paintFace(t.skin, t.face, 1024), [t]);
  const pieces = useMemo(() => tailored(t.pieces), [t]);
  const parts = useRef<HumanParts | null>(null);
  const done = useRef(false);
  useFrame(() => {
    const p = parts.current; if (!p || done.current) return;
    const ud = p.human.root.userData;
    // pronto = vestido, pele assada, olhos com textura e cabelo preso (quem tem cabelo)
    if (ud.dressed !== true || ud.skin !== "baked" || !ud.eyesReady || (t.hair && !p.hair)) return;
    done.current = true;
    if (t.earpiece) p.human.bone("Head").add(makeEarpiece());
    mendGarments(p, pieces);
    if (t.bowtie) addBowTie(p, pieces);
    if (t.chefHat) addChefHat(p, pieces);
    if (p.hair && t.hair?.color) tameHairShell(p.hair, t.hair.color);
    if (t.jewel) addJewelry(p, t.jewel);
    const jacket = t.pocket ? pieces.find((x) => x.slot === "outer") : null, pocket = jacket ? frontOf(p, jacket.id, 0.085, 0.76, "Spine2") : null;
    if (pocket) p.human.bone("Spine2").add(makePocketSquare(pocket.add(new THREE.Vector3(0, 0, 0.002))));
    fixFabrics(p.human.root, pieces, t.tint ? new Set([...collectNames(p.human.root, t.tint.piece)]) : undefined);
    addMouthMorph(p.human.body, p.asset, p.composed);
    const rig = makeRig(p.human.bones, p.human.rest.joints, (b) => p.pose.base.get(b), p.pose.hips);
    const tint = new Set<string>();
    if (t.tint) { const id = t.tint.piece; p.human.root.traverse((o) => { if (o.name.endsWith(id)) tint.add(o.name); }); }
    onDone({ key: t.key, root: p.human.root, rig, tint, skirt: longSkirt(pieces) });
  });
  return <HumanAvatar body={t.body} stature={t.stature} skin={t.skin} hair={t.hair} atlas={atlas} pieces={pieces} externalPose motion hairLod={hairLod} wind={0.08}
    onReady={(p) => { parts.current = p; }} />;
}

function collectNames(root: THREE.Object3D, id: string): string[] { const out: string[] = []; root.traverse((o) => { if (o.name.endsWith(id)) out.push(o.name); }); return out; }
