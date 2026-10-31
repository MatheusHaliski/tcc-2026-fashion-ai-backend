import { describe, expect, it } from "vitest";
import { applyNavOrder, isNavOrder, move, moveTo, orderBy, snapshot } from "./nav-order";
import type { NavGroup } from "./nav-items";

const G: NavGroup[] = [
  { key: "nav.group.discover", items: [{ href: "/feed", key: "a", icon: "x" }, { href: "/search", key: "b", icon: "x" }] },
  { key: "nav.group.wardrobe", items: [{ href: "/closet", key: "c", icon: "x" }, { href: "/room", key: "d", icon: "x" }, { href: "/atelier", key: "e", icon: "x" }] },
  { key: "nav.group.play", items: [{ href: "/flair", key: "f", icon: "x" }] },
];
const keys = (g: NavGroup[]) => g.map((x) => x.key);

describe("ordem do menu (RF23)", () => {
  it("sem ordem salva, o menu fica na ordem padrão", () => {
    expect(applyNavOrder(G, null)).toBe(G);
  });

  it("guarda-roupa em primeiro e itens do grupo na ordem escolhida", () => {
    const out = applyNavOrder(G, { groups: ["nav.group.wardrobe"], items: { "nav.group.wardrobe": ["/atelier", "/closet"] } });
    expect(keys(out)).toEqual(["nav.group.wardrobe", "nav.group.discover", "nav.group.play"]);
    expect(out[0].items.map((n) => n.href)).toEqual(["/atelier", "/closet", "/room"]);
    expect(out[1].items.map((n) => n.href)).toEqual(["/feed", "/search"]);
  });

  it("ignora grupos e itens que não existem mais e põe os novos no fim", () => {
    expect(orderBy(["a", "b", "c"], ["z", "c", "a"], (s) => s)).toEqual(["c", "a", "b"]);
    expect(orderBy(["a", "b"], [], (s) => s)).toEqual(["a", "b"]);
    expect(orderBy(["a", "b"], undefined, (s) => s)).toEqual(["a", "b"]);
  });

  it("move troca com o vizinho e não sai dos limites", () => {
    expect(move([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    const l = [1, 2];
    expect(move(l, 0, -1)).toBe(l);
    expect(move(l, 1, 1)).toBe(l);
    expect(move(l, 5, 1)).toBe(l);
  });

  it("moveTo leva o item para a posição de destino (arrastar e soltar)", () => {
    expect(moveTo(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveTo(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    const l = ["a", "b"];
    expect(moveTo(l, 1, 1)).toBe(l);
    expect(moveTo(l, 0, 9)).toBe(l);
    expect(moveTo(l, -1, 0)).toBe(l);
  });

  it("snapshot guarda a ordem completa e isNavOrder valida o formato vindo da API", () => {
    const snap = snapshot(G);
    expect(snap).toEqual({ groups: keys(G), items: { "nav.group.discover": ["/feed", "/search"], "nav.group.wardrobe": ["/closet", "/room", "/atelier"], "nav.group.play": ["/flair"] } });
    expect(isNavOrder(snap)).toBe(true);
    expect(isNavOrder({ groups: [] })).toBe(true);
    expect(isNavOrder(null)).toBe(false);
    expect(isNavOrder({ groups: "x" })).toBe(false);
    expect(isNavOrder({ groups: [1] })).toBe(false);
    expect(isNavOrder({ groups: [], items: { a: "x" } })).toBe(false);
  });
});
