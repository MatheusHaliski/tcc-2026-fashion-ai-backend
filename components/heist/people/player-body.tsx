"use client";
/*
 * MET Gala Heist v2 — o corpo da jogadora (people.tsx): o corpo vestido do FashionAI com a roupa atual (troca de roupa
 * refaz o acerto das peças), animado pelo mesmo quadro das outras pessoas; avisa quando está vestida e com a pele assada.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import { makeRig, newMotionState, syncBase } from "@/lib/avatar3d/human/locomotion";
import type { SceneView } from "@/lib/heist/view";
import { PLAYER_DEFAULT, paintFace, tailored } from "@/lib/heist/looks";
import { fixFabrics, mendGarments } from "./fabric";
import { addMouthMorph } from "./mouth";
import { addBowTie } from "./accessories";
import { longSkirt, step, type Person } from "./person";

export function PlayerBody({ view, pieces: given, quality, onReady }: { view: React.MutableRefObject<SceneView>; pieces: Look3dPiece[]; quality: "high" | "low"; onReady: () => void }) {
  const holder = useRef<THREE.Group>(null);
  const pieces = useMemo(() => tailored(given), [given]);
  const atlas = useMemo(() => paintFace(PLAYER_DEFAULT.skin, PLAYER_DEFAULT.face, 1024), []);
  const s = useRef<{ parts: HumanParts | null; person: Person | null; pieces: Look3dPiece[] | null; sig: number; sync: number; told: boolean; bow: THREE.Object3D | null }>({ parts: null, person: null, pieces: null, sig: 0, sync: 0, told: false, bow: null });
  useFrame((_, rawDt) => {
    const st = s.current, p = st.parts, h = holder.current, a = view.current.player;
    if (!h || !p) return;
    if (!st.person) {
      addMouthMorph(p.human.body, p.asset, p.composed);
      const rig = makeRig(p.human.bones, p.human.rest.joints, (b) => p.pose.base.get(b), p.pose.hips);
      st.person = { id: "player", holder: h, root: p.human.root, rig, st: newMotionState(rig, 7, a.anim as never), body: p.human.body, seed: 7, holds: new Map(), violin: null,
        hold: null, prevHold: null, holdAt: -9, extra: new Map(), meshes: [], shadow: true, frame: 0, acc: 0, y: a.y, init: false, lastSeen: 0, skirt: 0, detail: [], far: false };
    }
    // roupa nova (troca de roupa): a pose de exibição pode ter mudado (braços mais abertos para saia rodada) e as malhas
    // das peças chegam alguns quadros depois — o acerto se refaz quando as peças ou as malhas mudam
    let sig = 0; for (const c of p.human.root.children) sig = (sig * 31 + c.id) | 0;
    if (st.pieces !== pieces || st.sig !== sig) { st.pieces = pieces; st.sig = sig; st.sync = 4; }
    if (st.sync > 0) {
      st.sync--; syncBase(st.person.rig, (b) => p.pose.base.get(b)); mendGarments(p, pieces); fixFabrics(p.human.root, pieces); st.person.skirt = longSkirt(pieces);
      // uniforme de garçom: gravata-borboleta na gola da camisa (some com o vestido)
      if (st.bow) { st.bow.removeFromParent(); st.bow = null; }
      if (pieces.some((x) => x.id === "heist-waiter-shirt")) st.bow = addBowTie(p, pieces);
    }
    const dt = Math.min(0.1, rawDt);
    h.visible = a.visible && p.human.root.userData.dressed === true;
    step(st.person, a, view.current.time, dt);
    if (!st.told && p.human.root.userData.dressed === true && p.human.root.userData.skin === "baked") { st.told = true; onReady(); }
  });
  return <group ref={holder}>
    <HumanAvatar body={PLAYER_DEFAULT.body} stature={PLAYER_DEFAULT.stature} skin={PLAYER_DEFAULT.skin} hair={PLAYER_DEFAULT.hair} atlas={atlas} pieces={pieces}
      externalPose motion hairLod={quality === "high" ? 1 : 2} wind={0.1} onReady={(p) => { s.current.parts = p; s.current.person = null; s.current.bow = null; s.current.pieces = null; }} />
  </group>;
}
