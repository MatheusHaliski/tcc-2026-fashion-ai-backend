import { describe, expect, it } from "vitest";
import { STILL_GIVE_UP_MS, STILL_LATE_MS, STILL_STABLE_FRAMES, StillCache, stillKey, stillReady, stillTick, type StillInput } from "@/lib/avatar3d/still";
import type { AvatarModel } from "@/lib/avatar3d/model";
import type { Look3dPiece } from "@/components/three/common";

const model = (over: Partial<AvatarModel> = {}): AvatarModel => ({
  v: 1, shape: Array.from({ length: 468 * 3 }, (_, i) => Math.sin(i) * 5), skin: "#c08a6a",
  hair: { length: "medium", texture: "wavy", volume: "medium", color: "#3b2a20" } as AvatarModel["hair"],
  metrics: {} as AvatarModel["metrics"], views: [], warnings: [], ...over,
});
const shirt: Look3dPiece = { id: "p1", name: "T-shirt navy", slot: "upper", category: "TOP", subcategory: "camiseta", imageUrl: "/media/p1.webp", colorHex: "#1b2a4a" };
const jeans: Look3dPiece = { id: "p2", name: "Jeans", slot: "lower", category: "BOTTOM", subcategory: "jeans", imageUrl: "/media/p2.webp", colorHex: "#3a6ea5" };
const base = (over: Partial<StillInput> = {}): StillInput => ({
  avatar: { model: model(), adjust: null, textureUrl: "/api/me/avatar3d/texture" }, sex: "FEMININO", body: null, pieces: [shirt, jeans], background: "#EEEAE2", ...over,
});

describe("stillKey (Prévia 2D)", () => {
  it("é estável e não depende da ordem das peças", () => {
    expect(stillKey(base())).toBe(stillKey(base()));
    expect(stillKey(base({ pieces: [jeans, shirt] }))).toBe(stillKey(base()));
  });
  it("muda quando muda o que aparece na foto", () => {
    const k = stillKey(base());
    expect(stillKey(base({ pieces: [shirt] }))).not.toBe(k);                                               // tirou uma peça
    expect(stillKey(base({ pieces: [{ ...shirt, imageUrl: "/media/p1-v2.webp" }, jeans] }))).not.toBe(k);  // nova foto da peça
    expect(stillKey(base({ background: "#E4ECF3" }))).not.toBe(k);                                        // luz do espelho
    expect(stillKey(base({ avatar: { model: model({ skin: "#8d5a3b" }), textureUrl: "/api/me/avatar3d/texture" } }))).not.toBe(k);
    expect(stillKey(base({ avatar: { model: model(), adjust: { hairTone: 3 }, textureUrl: "/api/me/avatar3d/texture" } }))).not.toBe(k);
    expect(stillKey(base({ avatar: null }))).not.toBe(k);                                                 // manequim de referência
    expect(stillKey(base({ avatar: null, sex: "MASCULINO" }))).not.toBe(stillKey(base({ avatar: null })));
  });
  it("não carrega forma do rosto, cor de pele nem URL em claro", () => {
    const k = stillKey(base());
    expect(k).toMatch(/^still-[0-9a-z]+-[0-9a-z]+$/);
    expect(k).not.toContain("c08a6a"); expect(k).not.toContain("/media/"); expect(k.length).toBeLessThan(32);
  });
});

describe("StillCache", () => {
  it("guarda as últimas e descarta a menos usada", () => {
    const c = new StillCache(2);
    c.set("a", "A"); c.set("b", "B");
    expect(c.get("a")).toBe("A");          // "a" passa a ser a mais recente
    c.set("c", "C");
    expect(c.get("b")).toBeNull(); expect(c.get("a")).toBe("A"); expect(c.get("c")).toBe("C"); expect(c.size).toBe(2);
  });
});

describe("stillReady / stillTick", () => {
  const ready = { dressed: true, outfitReady: true, eyesReady: true, skin: "baked" };
  it("só fotografa vestido, com as fotos do look atual, olhos e (quando há foto) o rosto assado", () => {
    expect(stillReady(ready, true)).toBe(true);
    expect(stillReady({ ...ready, dressed: false }, true)).toBe(false);       // nunca sem roupa
    expect(stillReady({ ...ready, outfitReady: false }, true)).toBe(false);   // fotos do look anterior
    expect(stillReady({ ...ready, eyesReady: undefined }, true)).toBe(false);
    expect(stillReady({ ...ready, skin: "color" }, true)).toBe(false);        // rosto ainda não chegou
    expect(stillReady({ ...ready, skin: "pending" }, false)).toBe(false);
    expect(stillReady({ ...ready, skin: "color" }, false)).toBe(true);        // manequim sem foto
    expect(stillReady(undefined, false)).toBe(false);
  });
  it("espera quadros seguidos prontos e recomeça a contar se algo mudou", () => {
    let st = 0; let shoot = false;
    for (let i = 0; i < STILL_STABLE_FRAMES - 1; i++) ({ stable: st, shoot } = stillTick(ready, true, st, 100));
    expect(shoot).toBe(false);
    expect(stillTick({ ...ready, outfitReady: false }, true, st, 100).stable).toBe(0);
    expect(stillTick(ready, true, st, 100).shoot).toBe(true);
  });
  it("não fica preso: corpo vestido com uma foto fora do ar, ou corpo que nunca carregou", () => {
    const stuck = { ...ready, outfitReady: false };
    expect(stillTick(stuck, true, STILL_STABLE_FRAMES - 1, STILL_LATE_MS - 1).shoot).toBe(false);
    expect(stillTick(stuck, true, STILL_STABLE_FRAMES - 1, STILL_LATE_MS + 1).shoot).toBe(true);
    expect(stillTick({ ...ready, dressed: false }, true, STILL_STABLE_FRAMES - 1, STILL_LATE_MS + 1).shoot).toBe(false);
    expect(stillTick(undefined, true, STILL_STABLE_FRAMES - 1, STILL_GIVE_UP_MS + 1).shoot).toBe(true);
  });
});
