/**
 * Prova no quarto: a zona do espelho com histerese e tempo mínimo nas bordas, abrir/fechar à mão, trocas em que a
 * seleção mais recente prevalece e uma falha mantém a roupa anterior, as "roupas em mãos" por lugar do corpo, a câmera
 * e a reação por categoria (menor com movimento reduzido).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MIRROR_ZONE, MirrorSession, assetStateOf, cameraFor, facingYaw, handSlotOf, handsOf, reactionPose, snapshotCrop } from "./mirror-session";

describe("zona do espelho", () => {
  it("entra perto, só sai mais longe e espera o tempo mínimo em cada borda (sem piscar na divisa)", () => {
    const s = new MirrorSession(); let changes = 0; s.listeners.add(() => changes++);
    expect(s.update(3, 0)).toBe(false); expect(s.phase).toBe("room");
    expect(s.update(1.0, 100)).toBe(true); expect(s.phase).toBe("approach");                  // dentro do raio de entrada
    expect(s.update(1.0, 200)).toBe(false); expect(s.phase).toBe("approach");                 // ainda no tempo mínimo
    expect(s.update(1.4, 100 + MIRROR_ZONE.dwellMs)).toBe(true); expect(s.phase).toBe("tryon"); // entre os raios: continua
    expect(s.update(1.6, 1000)).toBe(false); expect(s.phase).toBe("tryon");                   // na divisa de saída: nada muda
    expect(s.update(1.8, 1100)).toBe(true); expect(s.phase).toBe("exit");                     // passou do raio de saída
    expect(s.update(1.0, 1200)).toBe(true); expect(s.phase).toBe("tryon");                    // voltou a tempo: segue na prova
    s.update(1.8, 2000); expect(s.phase).toBe("exit");
    expect(s.update(2.5, 2000 + MIRROR_ZONE.exitMs)).toBe(true); expect(s.phase).toBe("room");
    expect(changes).toBe(6); expect(MIRROR_ZONE.exit).toBeGreaterThan(MIRROR_ZONE.enter);
  });
  it("abrir à mão fica aberto longe do espelho; Voltar ao quarto dentro da zona não reabre sozinho até sair dela", () => {
    const s = new MirrorSession();
    s.open(); expect(s.phase).toBe("tryon"); expect(s.manual).toBe(true);
    s.update(3, 0); expect(s.phase).toBe("tryon");                                             // aberta à mão: a distância não fecha
    s.back(3); expect(s.phase).toBe("room"); expect(s.manual).toBe(false);
    s.update(0.8, 100); s.update(0.8, 100 + MIRROR_ZONE.dwellMs); expect(s.phase).toBe("tryon"); // chegou: abre sozinha
    s.back(0.8); expect(s.phase).toBe("room");
    s.update(0.8, 2000); s.update(0.8, 3000); expect(s.phase).toBe("room");                    // ainda na zona: trava
    s.update(2.0, 3100); s.update(0.8, 3200); expect(s.phase).toBe("approach");                // saiu e voltou: abre de novo
  });
});

describe("trocas", () => {
  it("a seleção mais recente prevalece: a resposta de um pedido antigo é ignorada", () => {
    const s = new MirrorSession();
    const a = s.request("upper"); const b = s.request("upper");
    expect(s.busy).toBe("upper");
    expect(s.settle(a, true, "upper", 1000)).toBe(false); expect(s.busy).toBe("upper"); expect(s.reaction).toBeNull();
    expect(s.settle(b, true, "upper", 1200)).toBe(true); expect(s.busy).toBeNull(); expect(s.applied).toBe(b);
    expect(s.reaction).toEqual({ slot: "upper", at: 1200 });
  });
  it("falha: sem reação, com a mensagem, e nada do estado anterior muda (a roupa anterior continua)", () => {
    const s = new MirrorSession(); s.settle(s.request("shoes"), true, "shoes", 10);
    const before = { applied: s.applied, reaction: s.reaction };
    const n = s.request("lower"); expect(s.settle(n, false, "lower", 20, "sem rede")).toBe(true);
    expect(s.error).toBe("sem rede"); expect(s.busy).toBeNull();
    expect(s.applied).toBe(before.applied); expect(s.reaction).toEqual(before.reaction);
    s.request("lower"); expect(s.error).toBeNull();                                             // novo pedido limpa o aviso
  });
});

describe("roupas em mãos", () => {
  const piece = (id: string, category: string, extra: Record<string, unknown> = {}) => ({ id, name: id, category, subcategory: category === "upper_piece" ? "t_shirt" : category === "lower_piece" ? "jeans" : category === "shoes_piece" ? "casual_sneakers" : "crossbody_bag", imageUrl: `/m/${id}.png`, ...extra });
  it("mapeia os slots do espelho nos quatro lugares e marca a peça segurada como por vestir", () => {
    const lookup = (id: string) => ({ jaqueta: piece("jaqueta", "upper_piece", { subcategory: "jacket" }), tee: piece("tee", "upper_piece"), jeans: piece("jeans", "lower_piece"), tenis: piece("tenis", "shoes_piece"), bolsa: piece("bolsa", "accessory_piece") } as Record<string, ReturnType<typeof piece>>)[id] ?? null;
    const hands = handsOf({ outer_layer: { id: "jaqueta" }, upper: { id: "tee" }, lower: { id: "jeans" }, shoes: { id: "tenis" }, accessory: [{ id: "bolsa" }] }, piece("vestido", "full_body_piece", { subcategory: "dress" }), lookup);
    expect(hands.upper.map((p) => [p.id, p.worn])).toEqual([["vestido", false], ["jaqueta", true], ["tee", true]]);
    expect(hands.lower[0]).toMatchObject({ id: "jeans", worn: true, apiSlot: "lower", asset: "MOULD_3D" });
    expect(hands.shoes[0].asset).toBe("MOULD_3D");
    expect(hands.accessory[0]).toMatchObject({ id: "bolsa", asset: "IMAGE_2D" });
    // a peça segurada que já está vestida não aparece duas vezes
    expect(handsOf({ upper: { id: "tee" } }, piece("tee", "upper_piece"), lookup).upper).toHaveLength(1);
    expect(handSlotOf({ category: "lower_piece" }, "upper")).toBe("upper");                   // o slot do espelho decide
    expect(handSlotOf({ category: "lower_piece" })).toBe("lower");                            // sem slot: a categoria
  });
  it("lista do espelho (QUARTO-ESPELHO): o vestido, depois o resto da lista, depois a peça na mão — cada peça uma vez", () => {
    const rack = [{ id: "tee", name: "tee", slot: "upper", category: "upper_piece" }, { id: "saia", name: "saia", slot: "lower", category: "lower_piece", subcategory: "skirt" },
      { id: "bolsa", name: "bolsa", slot: "accessory", category: "accessory_piece" }];
    const lookup = () => null;                                       // a lista do servidor já traz a peça
    const hands = handsOf({ upper: { id: "tee" } }, piece("saia", "lower_piece"), lookup, rack);
    expect(hands.upper).toMatchObject([{ id: "tee", worn: true, listed: true }]);
    expect(hands.lower).toMatchObject([{ id: "saia", worn: false, listed: true }]);          // segurada e já na lista: não duplica
    expect(hands.accessory).toMatchObject([{ id: "bolsa", worn: false, listed: true }]);
    const solta = handsOf({}, piece("jeans", "lower_piece"), lookup, rack).lower;
    expect(solta.map((p) => [p.id, p.listed])).toEqual([["jeans", false], ["saia", true]]);    // na mão, fora da lista
  });
  it("estado do asset: modelo 3D próprio, molde 3D, só imagem 2D ou foto pendente", () => {
    expect(assetStateOf({ model3dUrl: "/m.glb", category: "upper_piece", subcategory: "t_shirt" })).toBe("MODEL_3D");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt" })).toBe("MOULD_3D");
    expect(assetStateOf({ category: "accessory_piece", subcategory: "necklace" })).toBe("IMAGE_2D");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt", photoProcessingStatus: "PROCESSING" })).toBe("PENDING");
    expect(assetStateOf({ category: "upper_piece", subcategory: "t_shirt", photoProcessingStatus: "COMPLETED" })).toBe("MOULD_3D");
  });
});

describe("câmera, orientação e reação", () => {
  it("na prova a câmera fica de frente para o espelho com o personagem no quadro; no quarto, a visão geral", () => {
    const mirror = new THREE.Vector3(2.0, 0, 1.1), actor = new THREE.Vector3(1.4, 0, 1.6);
    const room = cameraFor("room", actor, mirror, 1.2); expect(room.position.y).toBeCloseTo(2.65); expect(room.target.z).toBeCloseTo(0.85);
    const tryon = cameraFor("tryon", actor, mirror, 1.2);
    expect(tryon.target.x).toBeCloseTo(1.7); expect(tryon.target.z).toBeCloseTo(1.35);
    expect(tryon.position.z).toBeGreaterThan(mirror.z + 2);                                   // na frente do vidro (normal +z girada 28°)
    expect(tryon.position.x).toBeGreaterThan(tryon.target.x);
    expect(tryon.position.distanceTo(tryon.target)).toBeGreaterThan(2.5);
    expect(cameraFor("approach", actor, mirror, 1.2).position).toEqual(tryon.position);
    // o personagem vira para o espelho: frente = (sin yaw, 0, cos yaw)
    const yaw = facingYaw(actor, mirror); expect(Math.sin(yaw)).toBeCloseTo(0.6 / Math.hypot(0.6, -0.5)); expect(Math.cos(yaw)).toBeCloseTo(-0.5 / Math.hypot(0.6, -0.5));
  });
  it("reação por lugar do corpo, que começa e termina em zero e fica bem menor com movimento reduzido", () => {
    for (const slot of ["upper", "lower", "shoes", "accessory"] as const) {
      const start = reactionPose(slot, 0, false), end = reactionPose(slot, 1, false);
      const size = (p: ReturnType<typeof reactionPose>) => Math.abs(p.arms) + Math.abs(p.spine) + Math.abs(p.knee) + Math.abs(p.foot) + Math.abs(p.head);
      const peak = (reduced: boolean) => Math.max(...[0.15, 0.25, 0.35, 0.5, 0.75].map((t) => size(reactionPose(slot, t, reduced))));
      expect(peak(false)).toBeGreaterThan(0.2); expect(size(start)).toBeLessThan(1e-9); expect(size(end)).toBeLessThan(1e-9);
      expect(peak(true)).toBeLessThan(peak(false) * 0.5);
    }
    expect(reactionPose("upper", 0.5, false).arms).toBeGreaterThan(0); expect(reactionPose("lower", 0.5, false).knee).toBeGreaterThan(0);
    expect(reactionPose("shoes", 1 / 6, false).foot).toBeGreaterThan(0); expect(reactionPose("accessory", 0.25, false).head).toBeGreaterThan(0);
  });
});

describe("sair do espelho pelas setas (QUARTO-ESPELHO)", () => {
  it("aberta pelo botão, a prova fica aberta parada em qualquer distância, mas andar para fora da zona fecha", () => {
    const s = new MirrorSession(); s.open(); s.update(3, 0); expect(s.phase).toBe("tryon");
    s.update(1.4, 100, true); expect(s.phase).toBe("tryon");                                    // andando dentro da zona: segue
    s.update(2.2, 200, true); expect(s.phase).toBe("exit"); expect(s.manual).toBe(false);        // saiu andando: fecha como sempre
    s.update(2.5, 200 + MIRROR_ZONE.exitMs); expect(s.phase).toBe("room");
    s.update(1.0, 300); s.update(1.0, 300 + MIRROR_ZONE.dwellMs); expect(s.phase).toBe("tryon"); // chegar de novo reabre sozinha
  });
});
describe("foto do quarto no vidro (QUARTO-ESPELHO)", () => {
  it("a foto tirada ao abrir a prova fica na sessão e some ao sair do espelho pelas setas ou por Voltar ao quarto", () => {
    const s = new MirrorSession(); let changes = 0; s.listeners.add(() => changes++);
    s.update(1.0, 0); s.update(1.0, MIRROR_ZONE.dwellMs); expect(s.phase).toBe("tryon");
    s.setSnapshot({ url: "data:image/jpeg;base64,AAA", aspect: 16 / 9, at: 10 });
    expect(s.snapshot?.url).toBe("data:image/jpeg;base64,AAA"); expect(changes).toBe(3);
    s.update(1.8, 1000); expect(s.phase).toBe("exit"); expect(s.snapshot).not.toBeNull();     // na divisa a foto ainda vale
    s.update(2.5, 1000 + MIRROR_ZONE.exitMs); expect(s.phase).toBe("room"); expect(s.snapshot).toBeNull();
    s.open(); s.setSnapshot({ url: "x", aspect: 1, at: 20 }); s.back(3); expect(s.snapshot).toBeNull();
  });
  it("o recorte mantém o miolo da foto sem esticar: foto larga perde as laterais, foto alta perde topo e base", () => {
    const wide = snapshotCrop(0.82 / 1.7, 16 / 9);                                               // canvas paisagem no vidro estreito
    expect(wide.repeat[1]).toBe(1); expect(wide.repeat[0]).toBeCloseTo((0.82 / 1.7) / (16 / 9), 6);
    expect(wide.offset[0]).toBeCloseTo((1 - wide.repeat[0]) / 2, 6); expect(wide.offset[1]).toBe(0);
    const tall = snapshotCrop(0.82 / 1.7, 0.3);
    expect(tall.repeat[0]).toBe(1); expect(tall.repeat[1]).toBeCloseTo(0.3 / (0.82 / 1.7), 6); expect(tall.offset[1]).toBeCloseTo((1 - tall.repeat[1]) / 2, 6);
    expect(snapshotCrop(0.5, 0.5)).toEqual({ repeat: [1, 1], offset: [0, 0] });
    expect(snapshotCrop(0, 1)).toEqual({ repeat: [1, 1], offset: [0, 0] });                     // proporção inválida: sem recorte
  });
});
