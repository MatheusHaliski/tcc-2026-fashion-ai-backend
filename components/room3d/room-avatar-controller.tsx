"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import { arrowAnywhere, moveInRoom, ROOM_TURN_EVENT, RoomInteraction, type Arm } from "@/lib/room3d/interaction";
import { inputYaw, reachPlane, ROOM, viewYaw } from "@/lib/room3d/room-bounds";
import { MIRROR_NORMAL, MirrorSession, REACTION_MS, cameraFor, facingYaw, mirrorDistance, reactionPose } from "@/lib/room3d/mirror-session";
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
  const { camera, gl, scene } = useThree(), { engine } = gameplay;
  const sessionRef = useRef(gameplay.session); sessionRef.current = gameplay.session;
  const actor = useRef<THREE.Group>(null), parts = useRef<HumanParts | null>(null);
  const pointer = useRef(new THREE.Vector2(0, 0)), desired = useRef(new THREE.Vector3(0, 1.5, .3));
  const phase = useRef(0), yaw = useRef(Math.PI), lastState = useRef("");
  const look = useRef(new THREE.Vector3(closetRight * .25, 1.1, .85));   // alvo da câmera, interpolado (sem salto ao abrir a prova)
  const lastPhase = useRef("room");
  // giro das setas (rad): segue a vista escolhida, mas fica preso enquanto alguma seta está apertada — trocar a vista no
  // meio da caminhada não inverte a direção
  const walkYaw = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement; canvas.tabIndex = 0; canvas.dataset.roomControls = "true";
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest("input,textarea,select,[contenteditable=true]"));
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) { event.preventDefault(); engine.keyDown(event.code); }
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
    const p = parts.current, arrows = [...engine.keys].some(k => k.startsWith("Arrow")), moving = !engine.grip && (arrows || !!engine.goal);
    // zona do espelho: a distância do personagem decide a fase da prova (histerese e tempos em mirror-session.ts)
    const session = gameplay.session, now = Date.now();
    session?.update(mirrorDistance(engine.actor, engine.mirror), now, moving);
    const trying = !!session?.active;
    // ao entrar na prova, o vidro guarda a vista do quarto daquela ocasião: uma foto tirada do espelho para o guarda-roupa,
    // sem o personagem (o reflexo dele é desenhado por cima, em room-scene.tsx)
    const ph = session?.phase ?? "room";
    if (session && ph === "tryon" && lastPhase.current !== "tryon") {
      const canvas = gl.domElement, w = canvas.width || 1, h = canvas.height || 1;
      const eye = new THREE.PerspectiveCamera(58, w / h, .05, 30);
      eye.position.copy(engine.mirror).add(MIRROR_NORMAL.clone().multiplyScalar(.06)).setY(1.15);
      eye.lookAt(engine.mirror.clone().add(MIRROR_NORMAL.clone().multiplyScalar(6)).setY(1.15));
      const visible = actor.current.visible; actor.current.visible = false;
      // as paredes que a câmera principal esconde (estando atrás delas) aparecem inteiras na foto do espelho
      const restore: (() => void)[] = []; scene.traverse((o) => { if (o.userData.wall && typeof o.userData.reveal === "function") restore.push(o.userData.reveal()); });
      try { gl.render(scene, eye); session.setSnapshot({ url: canvas.toDataURL("image/jpeg", .82), aspect: w / h, at: now }); }
      catch { /* sem foto, o vidro segue só com o reflexo */ }
      restore.forEach((r) => r());
      actor.current.visible = visible;
    }
    lastPhase.current = ph;
    // câmera desta fase: a vista do quarto escolhida (Q/E, botões) ou a da prova, sempre dentro das paredes
    const cam = cameraFor(ph, engine.actor, engine.mirror, closetRight, engine.view, ROOM);
    if (!moving) walkYaw.current = ph === "room" ? viewYaw(engine.view) : inputYaw(cam.position, cam.target);
    if (!engine.grip) {
      // as setas mandam; sem elas, um passo da caminhada até o ponto (para ao chegar), virando para onde anda
      const heading = arrows ? moveInRoom(engine.actor, engine.keys, dt, ROOM, engine.solids, walkYaw.current) : engine.followGoal(dt, ROOM);
      if (moving && heading !== null && !engine.aiming) yaw.current += Math.atan2(Math.sin(heading - yaw.current), Math.cos(heading - yaw.current)) * Math.min(1, dt * 9);
      else if (trying && !engine.aiming) {                                   // parado na prova: vira de frente para o espelho
        const want = facingYaw(engine.actor, engine.mirror);
        yaw.current += Math.atan2(Math.sin(want - yaw.current), Math.cos(want - yaw.current)) * Math.min(1, dt * 6);
      }
    }
    actor.current.position.copy(engine.actor); actor.current.rotation.y = yaw.current;
    applyIdle(p.human, p.pose, clock.elapsedTime, moving ? 0 : .3);
    phase.current += moving ? dt * 7 : 0;
    if (moving) for (const [side, offset] of [["Left", 0], ["Right", Math.PI]] as const) {
      const swing = Math.sin(phase.current + offset) * .32;
      p.human.bone(`${side}UpLeg`).rotateX(swing); p.human.bone(`${side}Leg`).rotateX(Math.max(0, -swing) * .8);
      if (!(engine.held && engine.heldArm === side)) p.human.bone(`${side}Arm`).rotateX(-swing * .6);
    }
    // reação à troca de roupa, por lugar do corpo, sobre a pose parada; com movimento reduzido é menor e mais curta
    const reaction = session?.reaction;
    if (reaction && !moving) {
      const reduced = !!gameplay.reduced, tt = (now - reaction.at) / (reduced ? REACTION_MS.reduced : REACTION_MS.normal);
      if (tt < 1) {
        const r = reactionPose(reaction.slot, tt, reduced);
        for (const [side, sign] of [["Left", 1], ["Right", -1]] as const) if (!(engine.held && engine.heldArm === side)) p.human.bone(`${side}Arm`).rotateZ(sign * r.arms);
        p.human.bone("Spine1").rotateY(r.spine);
        p.human.bone("RightUpLeg").rotateX(-r.knee); p.human.bone("RightLeg").rotateX(r.knee * 1.5);
        p.human.bone("RightFoot").rotateX(-r.foot);
        p.human.bone("Head").rotateZ(r.head);
      }
    }
    actor.current.updateWorldMatrix(true, true);
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
      const carry = actor.current.localToWorld(new THREE.Vector3(engine.heldArm === "Left" ? .32 : -.32, 1.05, .3)); reachHand(p, engine.heldArm, carry);
    }
    for (const side of ["Left", "Right"] as const) if ((engine.held && engine.heldArm === side) || (engine.grip && engine.gripArm === side)) {
      for (const finger of ["Index", "Middle", "Ring", "Pinky"]) for (let i = 1; i <= 3; i++) p.human.bone(`${side}Hand${finger}${i}`).rotateX(.55);
    }
    actor.current.updateWorldMatrix(true, true);
    engine.hover = engine.aiming ? engine.nearest(p.human.bone(`${engine.aiming}Hand`).getWorldPosition(new THREE.Vector3()))?.id ?? null : null;
    if (engine.held) {
      const target = engine.targets.get(`carry:${engine.held}`);
      target?.object.position.copy(p.human.bone(`${engine.heldArm}Hand`).getWorldPosition(new THREE.Vector3()));
      if (target) { target.object.rotation.set(0, Math.atan2(camera.position.x - target.object.position.x, camera.position.z - target.object.position.z), Math.sin(clock.elapsedTime * 4) * (moving ? .045 : .008)); }
    }
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
