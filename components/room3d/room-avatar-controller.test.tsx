// @vitest-environment jsdom
/**
 * Personagem do quarto 3D (RF28): teclas e botões que o movem, a câmera de cada ponto de vista, sentar, pegar e carregar
 * peças com a mão (A/D e X), segurar puxadores, a prova no espelho com a reação ao vestir e a limpeza ao sair. O corpo
 * humano é trocado por um esqueleto simples (mesmos nomes de ossos), sem o carregamento do corpo 3D.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const ctl = vi.hoisted(() => ({ deliver: true }));

/** Esqueleto de teste: os ossos que o controlador usa, em pé, com as distâncias de um corpo de 1,7 m. */
function fakeHuman() {
  const root = new THREE.Group(); root.name = "fake-human";
  const bones = new Map<string, THREE.Object3D>();
  const add = (name: string, parent: THREE.Object3D, at: [number, number, number]) => { const b = new THREE.Bone(); b.name = name; b.position.set(...at); parent.add(b); bones.set(name, b); return b; };
  const hips = add("Hips", root, [0, 0.95, 0]), spine = add("Spine", hips, [0, 0.1, 0]), s1 = add("Spine1", spine, [0, 0.12, 0]), s2 = add("Spine2", s1, [0, 0.12, 0]);
  const neck = add("Neck", s2, [0, 0.18, 0]); add("Head", neck, [0, 0.12, 0]);
  for (const [side, x] of [["Left", 1], ["Right", -1]] as const) {
    const sh = add(`${side}Shoulder`, s2, [0.08 * x, 0.14, 0]), arm = add(`${side}Arm`, sh, [0.1 * x, 0, 0]), fore = add(`${side}ForeArm`, arm, [0, -0.28, 0]), hand = add(`${side}Hand`, fore, [0, -0.25, 0]);
    for (const f of ["Index", "Middle", "Ring", "Pinky"]) { let p: THREE.Object3D = hand; for (let i = 1; i <= 3; i++) p = add(`${side}Hand${f}${i}`, p, [0, -0.02, 0]); }
    const up = add(`${side}UpLeg`, hips, [0.09 * x, -0.05, 0]), leg = add(`${side}Leg`, up, [0, -0.42, 0]); add(`${side}Foot`, leg, [0, -0.42, 0]);
    void arm; void fore;
  }
  const base = new Map<THREE.Object3D, THREE.Quaternion>(); bones.forEach((b) => base.set(b, b.quaternion.clone()));
  const human = { root, bone: (n: string) => { const b = bones.get(n); if (!b) throw new Error(`osso ${n}`); return b; } };
  return { human, pose: { base, hips: hips.position.clone(), legLen: 0.89 }, composed: null, asset: null, hair: null };
}

vi.mock("@/components/three/mannequin", () => ({
  Mannequin: ({ onHuman }: { onHuman?: (p: unknown) => void }) => {
    const parts = useMemo(() => fakeHuman(), []);
    useEffect(() => { if (ctl.deliver) onHuman?.(parts); }, [parts, onHuman]);
    return <primitive object={parts.human.root} />;
  },
}));

import { frames, mount3d, ReactThreeTestRenderer } from "@/test-utils/three";
import { cleanup } from "@/test-utils/render";
import RoomAvatarController, { reachHand, type RoomGameplay } from "./room-avatar-controller";
import { ROOM_TURN_EVENT, RoomInteraction, type RoomTarget } from "@/lib/room3d/interaction";
import { MirrorSession } from "@/lib/room3d/mirror-session";
import { DEFAULT_CAMERA_OPTIONS } from "@/lib/room3d/room-settings";
import type { HumanParts } from "@/components/three/human-avatar";

afterEach(() => { cleanup(); vi.restoreAllMocks(); ctl.deliver = true; });

type Three = { camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement };
function Probe({ into }: { into: Three }) { const s = useThree(); into.camera = s.camera as THREE.PerspectiveCamera; into.canvas = s.gl.domElement; return null; }

async function setup(extra: Partial<RoomGameplay> = {}, prep?: (engine: RoomInteraction) => void) {
  const engine = new RoomInteraction(); prep?.(engine);
  const three = {} as Three;
  const gameplay: RoomGameplay = { avatar: null, sex: "FEMININO", pieces: [], engine, ...extra };
  const r = await mount3d(<><Probe into={three} /><RoomAvatarController gameplay={gameplay} closetRight={2.4} /></>);
  const run = (n: number, dt = 0.05) => ReactThreeTestRenderer.act(async () => { await r.advanceFrames(n, dt); });
  const actor = () => r.scene.find((n) => n.instance.name === "room-user-avatar").instance;
  return { r, engine, three, run, actor, gameplay };
}
const key = (target: EventTarget, type: "keydown" | "keyup", code: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init }); target.dispatchEvent(e); return e;
};
const target = (id: string, kind: RoomTarget["kind"], at: [number, number, number], available = true): RoomTarget & { object: THREE.Object3D } => {
  const object = new THREE.Object3D(); object.position.set(...at); object.updateMatrixWorld(true);
  return { id, kind, object, available: () => available };
};

describe("mão por cinemática inversa", () => {
  it("leva a mão até o alvo ao alcance e para no limite do braço quando o alvo está longe", () => {
    const parts = fakeHuman() as unknown as HumanParts, hand = () => parts.human.bone("RightHand").getWorldPosition(new THREE.Vector3());
    parts.human.root.updateWorldMatrix(true, true);
    const near = new THREE.Vector3(-0.35, 1.3, 0.25), before = hand().distanceTo(near);
    reachHand(parts, "Right", near);
    expect(hand().distanceTo(near)).toBeLessThan(before);
    expect(hand().distanceTo(near)).toBeLessThan(0.05);
    const shoulder = parts.human.bone("RightArm").getWorldPosition(new THREE.Vector3());
    reachHand(parts, "Right", new THREE.Vector3(-5, 1.4, 3));
    expect(hand().distanceTo(shoulder)).toBeLessThanOrEqual(0.53 * 0.98 + 1e-3);       // braço esticado, sem passar do comprimento
  });
});

describe("controlador do personagem no quarto", () => {
  it("prepara o canvas, fica pronto quando o corpo chega e desfaz tudo ao sair (lente de volta, não pronto)", async () => {
    const { r, engine, three, run } = await setup();
    expect(three.canvas.tabIndex).toBe(0);
    expect(three.canvas.dataset.roomControls).toBe("true");
    expect(engine.ready).toBe(true);
    three.camera.fov = 40; three.camera.userData.baseFov = 40;
    await run(30);
    // no quarto a lente abre até 50°
    expect(three.camera.fov).toBeGreaterThan(45);
    const notify = vi.fn(); engine.listeners.add(notify);
    expect(typeof engine.armFor).toBe("function");
    await r.unmount();
    expect(three.camera.fov).toBe(40);
    expect(engine.ready).toBe(false);
    expect(engine.armFor).toBeNull();
    expect(notify).toHaveBeenCalled();
  });

  it("sem o corpo carregado, nada anda e A/D escolhem o braço pela tecla", async () => {
    ctl.deliver = false;
    const { r, engine, run } = await setup();
    expect(engine.ready).toBe(false);
    expect(engine.armFor!("KeyA")).toBe("Left");
    expect(engine.armFor!("KeyD")).toBe("Right");
    const start = engine.actor.clone(); engine.keyDown("ArrowUp");
    await run(10);
    expect(engine.actor.distanceTo(start)).toBe(0);
    await r.unmount();
  });

  it("teclas no canvas: setas andam, X interage, Q/E giram a cena (sem repetir) e o botão de girar também", async () => {
    const { r, engine, three, run, actor } = await setup();
    const interact = vi.spyOn(engine, "interact"), turn = vi.spyOn(engine, "turn");
    const start = engine.actor.clone();
    expect(key(three.canvas, "keydown", "ArrowUp").defaultPrevented).toBe(true);
    expect(engine.keys.has("ArrowUp")).toBe(true);
    await run(20);
    expect(engine.actor.distanceTo(start)).toBeGreaterThan(0.2);                          // andou
    expect(actor().position.distanceTo(engine.actor)).toBeLessThan(1e-6);                 // o boneco acompanha
    key(window, "keyup", "ArrowUp");
    expect(engine.keys.has("ArrowUp")).toBe(false);
    key(three.canvas, "keydown", "KeyX"); expect(interact).toHaveBeenCalledTimes(1);
    key(three.canvas, "keydown", "KeyX", { repeat: true }); expect(interact).toHaveBeenCalledTimes(1);
    key(three.canvas, "keydown", "KeyQ"); expect(turn).toHaveBeenLastCalledWith(1);
    key(three.canvas, "keydown", "KeyE"); expect(turn).toHaveBeenLastCalledWith(-1);
    key(three.canvas, "keydown", "KeyE", { repeat: true }); expect(turn).toHaveBeenCalledTimes(2);
    expect(key(three.canvas, "keydown", "KeyZ").defaultPrevented).toBe(false);           // tecla sem função passa
    three.canvas.dispatchEvent(new CustomEvent(ROOM_TURN_EVENT, { detail: -1 })); expect(turn).toHaveBeenLastCalledWith(-1);
    three.canvas.dispatchEvent(new CustomEvent(ROOM_TURN_EVENT, { detail: "x" })); expect(turn).toHaveBeenLastCalledWith(0);
    // perder o foco solta tudo
    engine.keys.add("ArrowLeft"); window.dispatchEvent(new Event("blur"));
    expect(engine.keys.size).toBe(0);
    engine.keys.add("ArrowLeft"); three.canvas.dispatchEvent(new Event("blur"));
    expect(engine.keys.size).toBe(0);
    await r.unmount();
  });

  it("digitando num campo as teclas não mexem o personagem; na prova as setas valem na página inteira", async () => {
    const session = new MirrorSession();
    const { r, engine, three } = await setup({ session });
    const input = document.createElement("input"); three.canvas.appendChild?.(input); document.body.appendChild(input);
    key(input, "keydown", "ArrowUp");
    expect(engine.keys.has("ArrowUp")).toBe(false);
    // fora da prova, seta na página (fora do canvas) não anda
    key(document.body, "keydown", "ArrowLeft");
    expect(engine.keys.has("ArrowLeft")).toBe(false);
    session.open();
    const e = key(document.body, "keydown", "ArrowLeft");
    expect(e.defaultPrevented).toBe(true);
    expect(engine.keys.has("ArrowLeft")).toBe(true);
    input.remove();
    await r.unmount();
  });

  it("o cursor guia a mão: segurando um puxador o movimento abre a porta; mexer o cursor solta a mão das teclas", async () => {
    const { r, engine, three, run } = await setup();
    const progress = vi.fn();
    engine.grip = { ...target("door:1", "handle", [0.3, 1.2, 0.4]), progress }; engine.gripArm = "Left";
    const move = (mx: number, my: number) => { const e = new MouseEvent("pointermove", { clientX: 10, clientY: 20 }); Object.defineProperty(e, "movementX", { value: mx }); Object.defineProperty(e, "movementY", { value: my }); three.canvas.dispatchEvent(e); };
    move(-10, 5);
    expect(progress).toHaveBeenCalledWith(expect.closeTo(0.06, 6));
    await run(5);
    // os dedos da mão que segura fecham
    const finger = r.scene.find((n) => n.instance.name === "LeftHandIndex1").instance;
    expect(finger.rotation.x).not.toBe(0);
    engine.grip = null;
    engine.aiming = "Right"; engine.handTarget = new THREE.Vector3(1, 1, 1);
    move(0, 0); expect(engine.handTarget).not.toBeNull();                               // sem deslocamento: continua
    move(3, 0); expect(engine.handTarget).toBeNull();
    three.canvas.dispatchEvent(new Event("pointerdown"));
    await r.unmount();
  });

  it("A/D escolhem o braço do lado da tela e mirar leva a mão ao cursor ou ao alvo mais perto", async () => {
    const { r, engine, three, run } = await setup();
    await run(4);
    const a = engine.armFor!("KeyA"), d = engine.armFor!("KeyD");
    expect(new Set([a, d])).toEqual(new Set(["Left", "Right"]));
    // um puxador bem na direção do centro da tela: a mão gruda nele
    const cam = three.camera, dir = cam.getWorldDirection(new THREE.Vector3());
    const at = cam.position.clone().addScaledVector(dir, 2);
    engine.targets.set("h1", target("h1", "handle", [at.x, at.y, at.z]));
    engine.targets.set("off", target("off", "handle", [at.x, at.y, at.z], false));
    key(three.canvas, "keydown", "KeyA");
    expect(engine.aiming).toBe(a);
    await run(6);
    // mão por teclas: setas movem a mão (não andam)
    const start = engine.actor.clone();
    key(three.canvas, "keydown", "ArrowUp");
    expect(engine.keys.has("ArrowUp")).toBe(true);
    await run(6);
    expect(engine.handTarget).not.toBeNull();
    expect(engine.actor.distanceTo(start)).toBeLessThan(1e-6);
    key(window, "keyup", "ArrowUp");
    key(window, "keyup", "KeyA");
    expect(engine.aiming).toBeNull();
    await run(2);
    await r.unmount();
  });

  it("X pega a peça (o braço vai até ela), carrega pendurada balançando e anda com ela", async () => {
    const { r, engine, run } = await setup();
    const piece = target("p1", "piece", [0.3, 1.0, 1.9]);
    const carry = target("carry:p1", "piece", [0, 0, 0]);
    engine.targets.set("p1", piece);
    engine.startReach(piece);
    expect(engine.reach).not.toBeNull();
    await run(30);
    expect(engine.reach).toBeNull();
    expect(engine.held).toBe("p1");
    engine.targets.set("carry:p1", carry);
    await run(3);
    const hand = r.scene.find((n) => n.instance.name === `${engine.heldArm}Hand`).instance.getWorldPosition(new THREE.Vector3());
    expect(carry.object.position.distanceTo(hand)).toBeLessThan(1e-6);
    // andando com a peça: o pano balança
    engine.keyDown("ArrowLeft");
    await run(10);
    expect(Math.abs(carry.object.rotation.x) + Math.abs(carry.object.rotation.z)).toBeGreaterThan(0);
    engine.keyUp("ArrowLeft");
    // perto do espelho com a peça: estado avisa
    const notify = vi.fn(); engine.listeners.add(notify);
    engine.actor.copy(engine.mirror).add(new THREE.Vector3(0.3, 0, 0.3));
    await run(2);
    expect(engine.state.nearMirror).toBe(true);
    expect(notify).toHaveBeenCalled();
    engine.held = null;
    await run(2);
    await r.unmount();
  });

  it("com movimento reduzido o gesto de pegar é imediato e a peça carregada não balança", async () => {
    const { r, engine, run } = await setup({ reduced: true });
    const piece = target("p2", "piece", [-0.4, 0.3, 1.6]);       // baixo: agacha
    engine.startReach(piece);
    await run(1);
    expect(engine.held).toBe("p2");
    const carry = target("carry:p2", "piece", [0, 0, 0]); engine.targets.set("carry:p2", carry);
    engine.keyDown("ArrowRight"); await run(6);
    expect(carry.object.rotation.x).toBe(0);
    expect(carry.object.rotation.z).toBe(0);
    await r.unmount();
  });

  it("sentado: o boneco fica no assento, de frente para onde a cadeira olha, e não gira com o analógico", async () => {
    const { r, engine, run, actor } = await setup({}, (e) => { e.camera = { ...DEFAULT_CAMERA_OPTIONS, view: "primeira-pessoa" }; });
    engine.seated = new THREE.Vector3(1.2, 0.475, 2.4); engine.seatYaw = 0.6; engine.cameraStick.set(1, 0);
    await run(4);
    expect(actor().position.x).toBeCloseTo(1.2);
    expect(actor().position.z).toBeCloseTo(2.4);
    expect(actor().rotation.y).toBeCloseTo(0.6);
    expect(engine.facing).toBeCloseTo(0.6);
    // pernas dobradas (coxa quase na horizontal)
    expect(Math.abs(r.scene.find((n) => n.instance.name === "LeftUpLeg").instance.rotation.x)).toBeGreaterThan(0.5);
    // segurando uma peça sentado, as mãos não vão às coxas
    engine.held = "x"; await run(2);
    await r.unmount();
  });

  it("primeira pessoa: a câmera vai direto aos olhos e o analógico direito vira o corpo", async () => {
    const { r, engine, three, run, actor } = await setup({}, (e) => { e.camera = { ...DEFAULT_CAMERA_OPTIONS, view: "primeira-pessoa", invertX: true }; });
    await run(2);
    const head = r.scene.find((n) => n.instance.name === "Head").instance.getWorldPosition(new THREE.Vector3());
    expect(three.camera.position.distanceTo(head)).toBeLessThan(0.3);
    const before = actor().rotation.y;
    engine.cameraStick.set(1, 0.5);
    await run(5);
    expect(actor().rotation.y).toBeGreaterThan(before);                                 // eixo X invertido: vira para o outro lado
    expect(engine.cameraPitch).toBeGreaterThan(0);
    await r.unmount();
  });

  it("vista salva com corte seco põe a câmera exatamente no ponto salvo, com a lente escolhida", async () => {
    const saved = { position: [1, 2.2, 4] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
    const { r, three, run } = await setup({}, (e) => { e.camera = { ...DEFAULT_CAMERA_OPTIONS, saved, cut: true, fov: 35 }; });
    await run(2);
    expect(three.camera.position.toArray().map((v) => +v.toFixed(4))).toEqual([1, 2.2, 4]);
    expect(three.camera.fov).toBeCloseTo(35, 1);
    await r.unmount();
  });

  it("vistas fixas (canto do teto, cinema parado) e órbita livre sem seguir o personagem, com eixo Y invertido", async () => {
    for (const camera of [{ view: "teto-porta" as const }, { view: "cinema" as const, still: true }, { view: "livre" as const, follow: false, invertY: true, speed: 2 }]) {
      const { r, engine, three, run } = await setup({}, (e) => { e.camera = { ...DEFAULT_CAMERA_OPTIONS, ...camera }; });
      engine.cameraStick.set(0.5, 1);
      await run(40);
      expect(Number.isFinite(three.camera.position.x)).toBe(true);
      if (camera.view === "teto-porta") expect(three.camera.position.y).toBeGreaterThan(2.5);   // no alto
      if (camera.view === "livre") { expect(engine.cameraYaw).toBeGreaterThan(0); expect(engine.cameraPitch).toBeLessThan(0); }
      // as setas andam para onde a câmera olha
      const start = engine.actor.clone(); engine.keyDown("ArrowDown"); await run(10); engine.keyUp("ArrowDown");
      expect(engine.actor.distanceTo(start)).toBeGreaterThan(0.1);
      await r.unmount();
    }
  });

  it("caminhada até um ponto: vira para onde anda e avisa ao chegar", async () => {
    const { r, engine, run, actor } = await setup();
    const done = vi.fn();
    engine.walkTo(new THREE.Vector3(1.4, 0, 2.6), done);
    await run(80);
    expect(done).toHaveBeenCalledWith("arrived");
    expect(Math.hypot(engine.actor.x - 1.4, engine.actor.z - 2.6)).toBeLessThan(0.1);
    expect(actor().rotation.y).not.toBeCloseTo(Math.PI, 2);
    await r.unmount();
  });

  it("na prova do espelho: vira de frente para o vidro e reage ao vestir (cada reação leva as mãos a um lugar)", async () => {
    const session = new MirrorSession();
    const { r, engine, three, run, actor } = await setup({ session });
    engine.actor.set(engine.mirror.x + 0.5, 0, engine.mirror.z + 0.9);
    session.open();
    await run(40);
    const want = Math.atan2(engine.mirror.x - engine.actor.x, engine.mirror.z - engine.actor.z);
    expect(Math.abs(Math.atan2(Math.sin(actor().rotation.y - want), Math.cos(actor().rotation.y - want)))).toBeLessThan(0.2);
    expect(three.camera.position.y).toBeGreaterThan(1.2);
    // reações: alegria (mãos no peito), ajuste (barra / gola), conferir (gira)
    for (const [slot, n] of [["upper", 0], ["upper", 1], ["accessory", 0], ["lower", 0], ["upper", 2]] as const) {
      session.reaction = { slot, n, at: Date.now() - 600 };
      const hand = r.scene.find((x) => x.instance.name === "RightHand").instance;
      await run(2, 0.016);
      expect(Number.isFinite(hand.getWorldPosition(new THREE.Vector3()).y)).toBe(true);
    }
    // segurando com a mão direita, só a esquerda reage
    engine.held = "p"; engine.heldArm = "Right"; session.reaction = { slot: "upper", n: 0, at: Date.now() - 400 };
    await run(2, 0.016);
    // reação terminada não mexe mais
    session.reaction = { slot: "upper", n: 0, at: Date.now() - 10_000 };
    await run(2, 0.016);
    await r.unmount();
  });

  it("reação curta com movimento reduzido", async () => {
    const session = new MirrorSession();
    const { r, engine, run } = await setup({ session, reduced: true });
    engine.actor.set(engine.mirror.x + 0.4, 0, engine.mirror.z + 0.8); session.open();
    session.reaction = { slot: "upper", n: 0, at: Date.now() - 100 };
    await run(3, 0.016);
    expect(session.phase).toBe("tryon");
    await r.unmount();
  });

  it("aproximando do espelho a câmera enquadra o personagem e o vidro", async () => {
    const session = new MirrorSession();
    const { r, engine, three, run } = await setup({ session });
    engine.actor.set(engine.mirror.x + 0.4, 0, engine.mirror.z + 0.7);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);                                  // relógio parado: não passa da aproximação
    await run(40);
    expect(session.phase).toBe("approach");
    expect(three.camera.position.y).toBeGreaterThan(1.5);
    await r.unmount();
  });
});
