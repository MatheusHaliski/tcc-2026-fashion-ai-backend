import { useEffect, type MutableRefObject } from "react";
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import { arrowAnywhere, HAND_KEYS, ROOM_TURN_EVENT, type RoomInteraction } from "@/lib/room3d/interaction";
import type { MirrorSession } from "@/lib/room3d/mirror-session";

/**
 * Controles do personagem no quarto (RoomAvatarController): setas, A/D, X, Q/E e os botões de girar no canvas, o
 * cursor para a mão e, na prova, as setas na página inteira. Na saída devolve a lente de base e solta tudo no motor.
 */
export function useRoomAvatarInput(camera: THREE.Camera, gl: THREE.WebGLRenderer, engine: RoomInteraction, sessionRef: MutableRefObject<MirrorSession | undefined>,
  parts: MutableRefObject<HumanParts | null>, pointer: MutableRefObject<THREE.Vector2>) {
  useEffect(() => {
    const canvas = gl.domElement; canvas.tabIndex = 0; canvas.dataset.roomControls = "true";
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest("input,textarea,select,[contenteditable=true]"));
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code) || (engine.aiming && HAND_KEYS.includes(event.code))) { event.preventDefault(); engine.keyDown(event.code); }
      else if (event.code === "KeyX" && !event.repeat) { event.preventDefault(); engine.interact(); }
      else if ((event.code === "KeyQ" || event.code === "KeyE") && !event.repeat) { event.preventDefault(); engine.turn(event.code === "KeyQ" ? 1 : -1); }   // girar a cena
    };
    // botões de girar a cena (room-scene-controls.tsx)
    const turn = (event: Event) => engine.turn(Math.sign(Number((event as CustomEvent).detail) || 0));
    const up = (event: KeyboardEvent) => engine.keyUp(event.code, arm => parts.current?.human.bone(`${arm}Hand`).getWorldPosition(new THREE.Vector3()));
    // A = o braço que aparece à esquerda da tela, D = o da direita: de frente para a câmera o braço esquerdo do
    // personagem fica à direita e, pelo lado do personagem, as teclas pareceriam invertidas
    engine.armFor = (code) => {
      const human = parts.current?.human; if (!human) return code === "KeyA" ? "Left" : "Right";
      const x = (bone: string) => human.bone(bone).getWorldPosition(new THREE.Vector3()).project(camera).x;
      const leftOnScreenLeft = x("LeftArm") <= x("RightArm");
      return (code === "KeyA") === leftOnScreenLeft ? "Left" : "Right";
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(); pointer.current.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      if (engine.grip) engine.grip.progress?.((event.movementY - event.movementX) * .004);
      if (engine.aiming && (event.movementX || event.movementY)) engine.handTarget = null;   // mexeu o cursor: a mão volta a segui-lo
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
      canvas.removeEventListener("pointerdown", focus); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("blur", blur); canvas.removeEventListener("keydown", down); canvas.removeEventListener(ROOM_TURN_EVENT, turn); window.removeEventListener("keydown", downAnywhere); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); engine.blur(); engine.armFor = null; engine.ready = false; engine.notify(); };
  }, [camera, engine, gl, sessionRef, parts, pointer]);
}
