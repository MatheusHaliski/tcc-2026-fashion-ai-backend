"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import { arrowAnywhere, CHAIR, moveInRoom, ROOM_TURN_EVENT, RoomInteraction, thighDrop, type Arm } from "@/lib/room3d/interaction";
import { inputYaw, reachPlane, ROOM, viewYaw } from "@/lib/room3d/room-bounds";
import { MirrorSession, REACTION_MS, cameraFor, facingYaw, mirrorDistance, reactionChoreo, reactionKindOf, type ReactionChoreo } from "@/lib/room3d/mirror-session";
import { stepSwing, SWING_REST, type Swing } from "@/lib/room3d/cloth-motion";
export interface RoomGameplay {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; body?: BodyParams | null; pieces: Look3dPiece[]; engine: RoomInteraction;
  /** prova no espelho dentro do quarto (lib/room3d/mirror-session.ts): fase pela distância, trocas e reação */
  session?: MirrorSession; reduced?: boolean;
}
/** CCD solves actual hand bones in world space. Targets remain within arm reach. */
export function reachHand(parts: HumanParts, arm: Arm, desired: THREE.Vector3) {
  const human = parts.human, hand = human.bone(`${arm}Hand`), shoulder = human.bone(`${arm}Arm`);
  const origin = shoulder.getWorldPosition(new THREE.Vector3());
  const fore = human.bone(`${arm}ForeArm`);
  const length = origin.distanceTo(fore.getWorldPosition(new THREE.Vector3())) + fore.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
  const target = desired.clone().sub(origin).clampLength(0, length * .98).add(origin);
  for (let iteration = 0; iteration < 7; iteration++) for (const bone of [fore, shoulder]) {
    human.root.updateWorldMatrix(true, true);
    const pivot = bone.getWorldPosition(new THREE.Vector3());
    const from = hand.getWorldPosition(new THREE.Vector3()).sub(pivot).normalize(), to = target.clone().sub(pivot).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
    const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  }
  human.root.updateWorldMatrix(true, true);
}
/** Abertura mínima da lente (graus) na vista do quarto. */
const ROOM_FOV = 50;
export default function RoomAvatarController({ gameplay, closetRight }: { gameplay: RoomGameplay; closetRight: number }) {
  const { camera, gl } = useThree(), { engine } = gameplay;
  const sessionRef = useRef(gameplay.session); sessionRef.current = gameplay.session;
  const actor = useRef<THREE.Group>(null), parts = useRef<HumanParts | null>(null);
  const pointer = useRef(new THREE.Vector2(0, 0)), desired = useRef(new THREE.Vector3(0, 1.5, .3));
  const phase = useRef(0), yaw = useRef(Math.PI), lastState = useRef("");
  // comprimentos da perna deste esqueleto (coxa, canela, altura do tornozelo), medidos em pé na primeira vez que senta
  const legs = useRef<{ thigh: number; shin: number; ankle: number } | null>(null);
  // peça na mão: posição e velocidade da mão no quadro anterior (para a aceleração) e o balanço do pano no gancho
  const carried = useRef<{ id: string; hand: THREE.Vector3; vel: THREE.Vector3; swing: Swing } | null>(null);
  const look = useRef(new THREE.Vector3(closetRight * .25, 1.1, .85));   // alvo da câmera, interpolado (sem salto ao abrir a prova)
  // giro das setas (rad): segue a vista escolhida, mas fica preso enquanto alguma seta está apertada — trocar a vista no
  // meio da caminhada não inverte a direção
  const walkYaw = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement; canvas.tabIndex = 0; canvas.dataset.roomControls = "true";
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest("input,textarea,select,[contenteditable=true]"));
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) { event.preventDefault(); engine.keyDown(event.code); }
      else if (event.code === "KeyX" && !event.repeat) { event.preventDefault(); engine.interact(); }
      else if ((event.code === "KeyQ" || event.code === "KeyE") && !event.repeat) { event.preventDefault(); engine.turn(event.code === "KeyQ" ? 1 : -1); }   // girar a cena
    };
    // botões de girar a cena (room-scene-controls.tsx)
    const turn = (event: Event) => engine.turn(Math.sign(Number((event as CustomEvent).detail) || 0));
    const up = (event: KeyboardEvent) => {
      const arm = event.code === "KeyA" ? "Left" : "Right";
      engine.keyUp(event.code, parts.current?.human.bone(`${arm}Hand`).getWorldPosition(new THREE.Vector3()));
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(); pointer.current.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      if (engine.grip) engine.grip.progress?.((event.movementY - event.movementX) * .004);
    };
    // na prova (aba espelho dentro do quarto) as setas valem na página inteira: o foco está nos controles ao lado e
    // basta andar para fora do espelho para voltar ao quarto
    const downAnywhere = (event: KeyboardEvent) => {
      if (arrowAnywhere(event, canvas, !!sessionRef.current?.active, editable)) { event.preventDefault(); engine.keyDown(event.code); }
    };
    const focus = () => canvas.focus(), blur = () => engine.blur();
    canvas.addEventListener("pointerdown", focus); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("keydown", down); window.addEventListener("keydown", downAnywhere); window.addEventListener("keyup", up); window.addEventListener("blur", blur); canvas.addEventListener("blur", blur); canvas.addEventListener(ROOM_TURN_EVENT, turn);
    return () => { const lens = camera as THREE.PerspectiveCamera; if (lens.userData.baseFov) { lens.fov = lens.userData.baseFov; lens.updateProjectionMatrix(); }
      canvas.removeEventListener("pointerdown", focus); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("blur", blur); canvas.removeEventListener("keydown", down); canvas.removeEventListener(ROOM_TURN_EVENT, turn); window.removeEventListener("keydown", downAnywhere); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); engine.blur(); engine.ready = false; engine.notify(); };
  }, [camera, engine, gl]);
  useFrame(({ clock }, dt) => {
    if (!actor.current || !parts.current) return;
    // andando: setas/direcional ou a caminhada até um ponto ("Ir ao espelho", "Voltar ao quarto") — as duas contam
    // como movimento para a zona do espelho (afastar-se fecha a prova mesmo aberta à mão)
    const p = parts.current, arrows = engine.moveStick.lengthSq() > 0 || [...engine.keys].some(k => k.startsWith("Arrow")), moving = !engine.grip && (arrows || !!engine.goal);
    // zona do espelho: a distância do personagem decide a fase da prova (histerese e tempos em mirror-session.ts)
    const session = gameplay.session, now = Date.now();
    session?.update(mirrorDistance(engine.actor, engine.mirror), now, moving);
    const trying = !!session?.active;
    // o vidro do espelho reflete o personagem de verdade (Reflector em room-scene.tsx): nada a fotografar ao entrar na prova
    const ph = session?.phase ?? "room";
    // câmera desta fase: a vista do quarto escolhida (Q/E, botões) ou a da prova, sempre dentro das paredes
    engine.cameraYaw += engine.cameraStick.x * dt * 1.1;
    engine.cameraPitch = THREE.MathUtils.clamp(engine.cameraPitch + engine.cameraStick.y * dt * .7, -.6, .7);
    const cam = cameraFor(ph, engine.actor, engine.mirror, closetRight, engine.view, ROOM, camera.position);
    const orbit = new THREE.Spherical().setFromVector3(cam.position.clone().sub(cam.target));
    orbit.theta += engine.cameraYaw; orbit.phi = THREE.MathUtils.clamp(orbit.phi + engine.cameraPitch, .3, Math.PI / 2 - .05);
    cam.position.copy(cam.target).add(new THREE.Vector3().setFromSpherical(orbit));
    cam.position.x = THREE.MathUtils.clamp(cam.position.x, ROOM.minX + .15, ROOM.maxX - .15);
    cam.position.z = THREE.MathUtils.clamp(cam.position.z, ROOM.minZ + .15, ROOM.maxZ - .15);
    cam.position.y = THREE.MathUtils.clamp(cam.position.y, .4, ROOM.height - .15);
    engine.updateNearby();
    if (!moving) walkYaw.current = ph === "room" ? viewYaw(engine.view) + engine.cameraYaw : inputYaw(cam.position, cam.target);
    if (!engine.grip) {
      // as setas mandam; sem elas, um passo da caminhada até o ponto (para ao chegar), virando para onde anda
      const heading = arrows ? moveInRoom(engine.actor, engine.keys, dt, ROOM, engine.solids, walkYaw.current, engine.moveStick) : engine.followGoal(dt, ROOM);
      if (moving && heading !== null && !engine.aiming) yaw.current += Math.atan2(Math.sin(heading - yaw.current), Math.cos(heading - yaw.current)) * Math.min(1, dt * 9);
      else if (trying && !engine.aiming) {                                   // parado na prova: vira de frente para o espelho
        const want = facingYaw(engine.actor, engine.mirror);
        yaw.current += Math.atan2(Math.sin(want - yaw.current), Math.cos(want - yaw.current)) * Math.min(1, dt * 6);
      }
    }
    // sentado: de frente para onde o assento olha (de costas para o espaldar), com o quadril sobre o assento
    if (engine.seated) actor.current.position.set(engine.seated.x, engine.actor.y, engine.seated.z); else actor.current.position.copy(engine.actor);
    actor.current.rotation.y = engine.seated ? engine.seatYaw : yaw.current;
    applyIdle(p.human, p.pose, clock.elapsedTime, moving ? 0 : engine.seated ? .08 : .3);
    if (engine.seated && !moving) {
      actor.current.updateWorldMatrix(true, true);
      const at = (bone: string) => p.human.bone(bone).getWorldPosition(new THREE.Vector3());
      const L = legs.current ?? (legs.current = { thigh: at("LeftUpLeg").distanceTo(at("LeftLeg")), shin: at("LeftLeg").distanceTo(at("LeftFoot")), ankle: at("LeftFoot").y - engine.actor.y });
      const hipY = engine.seated.y + CHAIR.hip, hips = p.human.bone("Hips");
      hips.position.y -= at("Hips").y - hipY;
      // coxa quase na horizontal (o quanto falta para o pé chegar ao chão) e canela na vertical
      const drop = thighDrop(hipY - engine.actor.y, L.thigh, L.shin, L.ankle);
      for (const side of ["Left", "Right"]) { p.human.bone(`${side}UpLeg`).rotateX(-(Math.PI / 2 - drop)); p.human.bone(`${side}Leg`).rotateX(Math.PI / 2 - drop); }
      actor.current.updateWorldMatrix(true, true);
      // mãos apoiadas nas coxas, um palmo antes do joelho
      if (!engine.held) for (const side of ["Left", "Right"] as const) reachHand(p, side, at(`${side}UpLeg`).lerp(at(`${side}Leg`), .62).add(new THREE.Vector3(0, .07, 0)));
    }
    phase.current += moving ? dt * 7 : 0;
    if (moving) for (const [side, offset] of [["Left", 0], ["Right", Math.PI]] as const) {
      const swing = Math.sin(phase.current + offset) * .32;
      p.human.bone(`${side}UpLeg`).rotateX(swing); p.human.bone(`${side}Leg`).rotateX(Math.max(0, -swing) * .8);
      if (!(engine.held && engine.heldArm === side)) p.human.bone(`${side}Arm`).rotateX(-swing * .6);
    }
    // reação ao vestir no espelho (alívio, alegria, ajuste ou conferir, variando entre trocas), sobre a pose parada;
    // com movimento reduzido é menor e mais curta (mirror-session.ts)
    const reaction = session?.reaction;
    let handsTo: { kind: NonNullable<ReactionChoreo["hands"]>; w: number } | null = null;
    if (reaction && !moving) {
      const reduced = !!gameplay.reduced, tt = (now - reaction.at) / (reduced ? REACTION_MS.reduced : REACTION_MS.normal);
      if (tt < 1) {
        const r = reactionChoreo(reactionKindOf(reaction.slot, reaction.n), reaction.slot, tt, reduced);
        for (const [side, sign] of [["Left", 1], ["Right", -1]] as const) if (!(engine.held && engine.heldArm === side)) {
          p.human.bone(`${side}Arm`).rotateZ(sign * r.arms); p.human.bone(`${side}Shoulder`).rotateZ(sign * r.shoulders);
        }
        p.human.bone("Spine1").rotateY(r.spine); p.human.bone("Spine2").rotateX(-r.breath);
        p.human.bone("RightUpLeg").rotateX(-r.knee); p.human.bone("RightLeg").rotateX(r.knee * 1.5);
        p.human.bone("RightFoot").rotateX(-r.foot);
        p.human.bone("Head").rotateZ(r.head); p.human.bone("Head").rotateX(r.look);
        p.human.bone("Hips").position.y += r.bounce;
        actor.current.rotation.y += r.turn;
        if (r.hands && r.handsWeight > 0.02) handsTo = { kind: r.hands, w: r.handsWeight };
      }
    }
    actor.current.updateWorldMatrix(true, true);
    // frente e esquerda do personagem no chão (as mãos da reação e o balanço da peça na mão usam o espaço dele)
    const facing = actor.current.rotation.y, fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)), leftward = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
    if (handsTo && !engine.aiming && !engine.grip) {
      const at = (b: string) => p.human.bone(b).getWorldPosition(new THREE.Vector3());
      for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
        if (engine.held && engine.heldArm === side) continue;
        const target = handsTo.kind === "chest" ? at("Spine2").addScaledVector(fwd, 0.16).addScaledVector(leftward, s * 0.04)
          : handsTo.kind === "collar" ? at("Neck").addScaledVector(fwd, 0.08).addScaledVector(leftward, s * 0.07).add(new THREE.Vector3(0, -0.03, 0))
          : handsTo.kind === "hips" ? at("Hips").addScaledVector(fwd, 0.04).addScaledVector(leftward, s * 0.17).add(new THREE.Vector3(0, 0.04, 0))
          : at("Hips").addScaledVector(fwd, 0.11).addScaledVector(leftward, s * 0.15).add(new THREE.Vector3(0, -0.07, 0));   // barra
        reachHand(p, side, at(`${side}Hand`).lerp(target, handsTo.w));
      }
    }
    if (engine.aiming) {
      const ray = new THREE.Raycaster(); ray.setFromCamera(pointer.current, camera);
      // Reach plane in front of the nearest wardrobe (1 on the north wall, 2 on the west wall), including low drawer handles.
      ray.ray.intersectPlane(reachPlane(engine.actor), desired.current);
      for (const target of engine.targets.values()) {
        if (!target.available()) continue;
        const point = target.object.getWorldPosition(new THREE.Vector3());
        if (ray.ray.distanceToPoint(point) < .065) { desired.current.copy(point); break; }
      }
      const target = desired.current;
      const crouch = THREE.MathUtils.clamp((.95 - target.y) * .85, 0, Math.min(.74, p.pose.legLen * .82));
      p.human.bone("Hips").position.y -= crouch;
      const bend = Math.acos(1 - crouch / p.pose.legLen);
      for (const side of ["Left", "Right"]) { p.human.bone(`${side}UpLeg`).rotateX(-bend); p.human.bone(`${side}Leg`).rotateX(bend * 2); p.human.bone(`${side}Foot`).rotateX(-bend); }
      actor.current.updateWorldMatrix(true, true); reachHand(p, engine.aiming, target);
    } else if (engine.grip) reachHand(p, engine.gripArm, engine.grip.object.getWorldPosition(new THREE.Vector3()));
    if (engine.held && !engine.aiming) {
      // segura o cabide pelo gancho na altura do peito, um pouco à frente e do lado do braço: a roupa pende livre
      const shoulder = actor.current.worldToLocal(p.human.bone(`${engine.heldArm}Arm`).getWorldPosition(new THREE.Vector3()));
      reachHand(p, engine.heldArm, actor.current.localToWorld(new THREE.Vector3(engine.heldArm === "Left" ? .24 : -.24, shoulder.y - .12, .24)));
    }
    for (const side of ["Left", "Right"] as const) if ((engine.held && engine.heldArm === side) || (engine.grip && engine.gripArm === side)) {
      for (const finger of ["Index", "Middle", "Ring", "Pinky"]) for (let i = 1; i <= 3; i++) p.human.bone(`${side}Hand${finger}${i}`).rotateX(.55);
    }
    actor.current.updateWorldMatrix(true, true);
    engine.hover = engine.aiming ? engine.nearest(p.human.bone(`${engine.aiming}Hand`).getWorldPosition(new THREE.Vector3()))?.id ?? null : null;
    if (engine.held) {
      const target = engine.targets.get(`carry:${engine.held}`);
      if (target) {
        // a peça pende do gancho na mão: pêndulo guiado pela aceleração da mão (andar, parar e virar balançam o pano)
        const hand = p.human.bone(`${engine.heldArm}Hand`).getWorldPosition(new THREE.Vector3());
        if (carried.current?.id !== engine.held) carried.current = { id: engine.held, hand: hand.clone(), vel: new THREE.Vector3(), swing: { ...SWING_REST } };
        const c = carried.current, h = Math.max(dt, 1e-3);
        const vel = hand.clone().sub(c.hand).divideScalar(h), acc = vel.clone().sub(c.vel).divideScalar(h).clampLength(0, 30);
        c.hand.copy(hand); c.vel.lerp(vel, 0.5);
        c.swing = gameplay.reduced ? { ...SWING_REST } : stepSwing(c.swing, { x: acc.dot(leftward), z: acc.dot(fwd) }, dt);
        target.object.position.copy(hand);
        target.object.rotation.set(c.swing.ax, facing, c.swing.az, "YXZ");
      }
    } else carried.current = null;
    // câmera: a vista do quarto (guarda-roupa, personagem e espelho; Q/E giram de 90° em 90°); na prova, de frente para
    // o espelho com o personagem no quadro — sempre por interpolação (com movimento reduzido, direto, sem o percurso)
    const k = gameplay.reduced ? 1 : Math.min(1, dt * 3);
    camera.position.lerp(cam.position, k); look.current.lerp(cam.target, k); camera.lookAt(look.current);
    // no quarto a lente abre um pouco (dentro das paredes a câmera fica mais perto); na prova, a abertura de sempre
    const lens = camera as THREE.PerspectiveCamera, base = lens.userData.baseFov ?? lens.fov, fov = base + (ph === "room" ? Math.max(0, ROOM_FOV - base) : 0);
    if (Math.abs(lens.fov - fov) > .01) { lens.fov += (fov - lens.fov) * k; lens.updateProjectionMatrix(); }
    const state = JSON.stringify(engine.state); if (state !== lastState.current) { lastState.current = state; engine.notify(); }
  });
  return <group ref={actor} name="room-user-avatar" position={engine.actor.toArray()}>
    <Mannequin mannequin={{ sex: gameplay.sex, head: gameplay.avatar ? "AVATAR" : "PADRAO", avatar: gameplay.avatar }} pieces={gameplay.pieces} body={gameplay.body} still externalPose hairLod={2}
      onHuman={p => { parts.current = p; engine.ready = true; engine.notify(); }} />
  </group>;
}
