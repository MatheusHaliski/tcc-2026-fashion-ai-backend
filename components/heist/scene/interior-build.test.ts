// @vitest-environment jsdom
/*
 * Interior do MET Gala Heist v2: a montagem roda sem GPU (texturas de 8 px no jsdom) e o que a cena faz por quadro
 * responde ao estado da simulação — portas giram com view.doors, as salas escondidas seguem as portas abertas, as luzes
 * dinâmicas ficam nas salas acesas, o diamante some fora do pedestal, a Visão contorna os interativos.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DOORS } from "@/lib/heist/level";
import { buildWorld } from "@/lib/heist/world";
import type { DoorId, RoomId } from "@/lib/heist/types";
import { emptyView } from "@/lib/heist/view";
import { buildInterior } from "./interior-build";
import { LightPool, roomsInView, updateAnimated, updateDoors, updateVision } from "./interior-fx";
import { BUILT_KINDS } from "./interior-props";
import { INTERIOR, isInterior } from "./interior-shell";

const b = buildInterior("low", "pt-BR");
const allDoors = (open: boolean) => Object.fromEntries(DOORS.map((d) => [d.id, open])) as Record<DoorId, boolean>;

describe("montagem do interior", () => {
  it("cada sala interna tem o seu grupo com malhas, e cada uma tem luz própria", () => {
    for (const r of INTERIOR) {
      expect(b.rooms.get(r)?.children.length, r).toBeGreaterThan(3);
      expect(b.anchors.some((a) => a.room === r), `âncora em ${r}`).toBe(true);
    }
    expect(b.stats.draws).toBeGreaterThan(100);
  });
  it("pisos de cada sala (o da segurança é o do serviço) e sombra de contato sob os móveis", () => {
    const rooms = new Set(b.floors.map((f) => f.room));
    for (const r of INTERIOR) if (r !== "seguranca") expect(rooms.has(r), r).toBe(true);
    expect(b.shadows.length).toBeGreaterThan(0);
  });
  it("folhas de porta: duplas nos vãos largos, única no cofre e na segurança, ferragem com LED nas trancadas", () => {
    const count = (id: DoorId) => b.doors.leaves.filter((l) => l.id === id).length;
    expect(count("main")).toBe(2); expect(count("gallery")).toBe(2); expect(count("vault")).toBe(1); expect(count("secDoor")).toBe(1);
    expect(count("front")).toBe(0);                                                // fachada: cenário da rua
    expect(new Set(b.doors.leds.map((l) => l.id))).toEqual(new Set(["side", "stage", "staff", "service", "vault"]));
  });
  it("móveis do interior (planta + araras): todo tipo tem construtor próprio, nenhum cai no bloco genérico", () => {
    for (const p of buildWorld().props.filter((x) => isInterior(x.room))) expect(BUILT_KINDS.has(p.kind), `${p.id} (${p.kind})`).toBe(true);
  });
});

describe("por quadro", () => {
  it("as folhas giram até abrir quando a porta abre e voltam ao fechar", () => {
    updateDoors(b.doors, allDoors(true), 0, true);
    for (const l of b.doors.leaves) expect(Math.abs(l.pivot.rotation.y), l.id).toBeGreaterThan(1.4);
    updateDoors(b.doors, allDoors(false), 0, true);
    for (const l of b.doors.leaves) expect(Math.abs(l.pivot.rotation.y), l.id).toBe(0);
    // LED: vermelho fechada, verde aberta
    const led = b.doors.leds[0].mesh.material as THREE.MeshBasicMaterial;
    expect(led.color.r).toBeGreaterThan(led.color.g);
    updateDoors(b.doors, allDoors(true), 0, true);
    expect(led.color.g).toBeGreaterThan(led.color.r);
  });
  it("salas visíveis seguem as portas abertas (do vestíbulo vê o salão e, pelo vão alinhado, a galeria)", () => {
    const v = emptyView(); v.playerRoom = "vestibulo"; v.doors = allDoors(false);
    const seen = new Set<RoomId>(), lit = new Set<RoomId>(), core = new Set<RoomId>();
    roomsInView(v, "vestibulo", seen, lit, core);
    expect([...seen]).toEqual(["vestibulo"]);
    v.doors = allDoors(true);
    roomsInView(v, "vestibulo", seen, lit, core);
    expect(seen.has("salao") && lit.has("salao")).toBe(true);
    expect(seen.has("galeria") && !lit.has("galeria")).toBe(true);
    expect([...core]).toEqual(["vestibulo"]);
  });
  it("o conjunto de luzes usa só âncoras das salas acesas e nunca passa do tamanho", () => {
    const pool = new LightPool(6), lit = new Set<RoomId>(["galeria"]), core = new Set<RoomId>(["galeria"]);
    pool.update(b.anchors, lit, core, new THREE.Vector3(0, 1.6, -14), 0.016, () => 1);
    const on = (pool.group.children as THREE.PointLight[]).filter((l) => l.intensity > 0);
    expect(on.length).toBeGreaterThan(0); expect(on.length).toBeLessThanOrEqual(6);
    for (const l of on) expect(l.position.z).toBeLessThan(-6);                    // todas dentro da galeria (z −22…−6,5)
  });
  it("o diamante só aparece no pedestal e a Visão acende os contornos perto da jogadora", () => {
    const v = emptyView(); v.player.x = -17; v.player.z = -12; v.playerRoom = "cofre";
    const diamond = b.animated.find((a) => a.kind === "diamond")!.mesh;
    v.diamondOnPedestal = true; updateAnimated(b.animated, v, 1); expect(diamond.visible).toBe(true);
    v.diamondOnPedestal = false; updateAnimated(b.animated, v, 1); expect(diamond.visible).toBe(false);
    expect(b.vision.items.length).toBeGreaterThan(15);
    v.vision = true; updateVision(b.vision, v, 1, 1);
    expect(b.vision.group.visible).toBe(true);
    expect(b.vision.items.filter((i) => i.mesh.visible).length).toBeGreaterThan(3);
    v.vision = false; updateVision(b.vision, v, 2, 1); updateVision(b.vision, v, 3, 1);
    expect(b.vision.group.visible).toBe(false);
  });
});
