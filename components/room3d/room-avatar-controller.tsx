"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Mannequin } from "@/components/three/mannequin";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import { applyIdle } from "@/lib/avatar3d/human/pose";
import { moveInRoom, RoomInteraction, type Arm } from "@/lib/room3d/interaction";
export interface RoomGameplay { avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; body?: BodyParams | null; pieces: Look3dPiece[]; engine: RoomInteraction }
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
export default function RoomAvatarController({ gameplay, closetRight }: { gameplay: RoomGameplay; closetRight: number }) {
  const { camera, gl } = useThree(), { engine } = gameplay;
  const actor = useRef<THREE.Group>(null), parts = useRef<HumanParts | null>(null);
  const pointer = useRef(new THREE.Vector2(0, 0)), desired = useRef(new THREE.Vector3(0, 1.5, .3));
  const phase = useRef(0), yaw = useRef(Math.PI), lastState = useRef("");
  useEffect(() => {
    const canvas = gl.domElement; canvas.tabIndex = 0; canvas.dataset.roomControls = "true";
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest("input,textarea,select,[contenteditable=true]"));
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) { event.preventDefault(); engine.keyDown(event.code); }
    };
    const up = (event: KeyboardEvent) => {
      const arm = event.code === "KeyA" ? "Left" : "Right";
      engine.keyUp(event.code, parts.current?.human.bone(`${arm}Hand`).getWorldPosition(new THREE.Vector3()));
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(); pointer.current.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      if (engine.grip) engine.grip.progress?.((event.movementY - event.movementX) * .004);
    };
    const focus = () => canvas.focus(), blur = () => engine.blur();
    canvas.addEventListener("pointerdown", focus); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); canvas.addEventListener("blur", blur);
    return () => { canvas.removeEventListener("pointerdown", focus); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("blur", blur); canvas.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); engine.blur(); engine.ready = false; engine.notify(); };
  }, [camera, engine, gl]);
  useFrame(({ clock }, dt) => {
    if (!actor.current || !parts.current) return;
    const p = parts.current, moving = !engine.grip && [...engine.keys].some(k => k.startsWith("Arrow"));
    if (!engine.grip) {
      const heading = moveInRoom(engine.actor, engine.keys, dt, closetRight, engine.solids);
      if (moving && !engine.aiming) yaw.current += Math.atan2(Math.sin(heading - yaw.current), Math.cos(heading - yaw.current)) * Math.min(1, dt * 9);
    }
    actor.current.position.copy(engine.actor); actor.current.rotation.y = yaw.current;
    applyIdle(p.human, p.pose, clock.elapsedTime, moving ? 0 : .3);
    phase.current += moving ? dt * 7 : 0;
    if (moving) for (const [side, offset] of [["Left", 0], ["Right", Math.PI]] as const) {
      const swing = Math.sin(phase.current + offset) * .32;
      p.human.bone(`${side}UpLeg`).rotateX(swing); p.human.bone(`${side}Leg`).rotateX(Math.max(0, -swing) * .8);
      if (!(engine.held && engine.heldArm === side)) p.human.bone(`${side}Arm`).rotateX(-swing * .6);
    }
    actor.current.updateWorldMatrix(true, true);
    if (engine.aiming) {
      const ray = new THREE.Raycaster(); ray.setFromCamera(pointer.current, camera);
      // Reach plane in front of the wardrobe, including low drawer handles.
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -.34), desired.current);
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
    // Stable overview keeps wardrobe, avatar and mirror visible throughout the route.
    camera.position.lerp(new THREE.Vector3(1 + closetRight * .25, 2.65, 5.8), Math.min(1, dt * 3));
    camera.lookAt(closetRight * .25, 1.1, .85);
    const state = JSON.stringify(engine.state); if (state !== lastState.current) { lastState.current = state; engine.notify(); }
  });
  return <group ref={actor} name="room-user-avatar" position={engine.actor.toArray()}>
    <Mannequin mannequin={{ sex: gameplay.sex, head: gameplay.avatar ? "AVATAR" : "PADRAO", avatar: gameplay.avatar }} pieces={gameplay.pieces} body={gameplay.body} still externalPose hairLod={2}
      onHuman={p => { parts.current = p; engine.ready = true; engine.notify(); }} />
  </group>;
}
