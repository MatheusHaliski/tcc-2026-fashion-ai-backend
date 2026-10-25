// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp } from "@/test-utils/render";
import { GuideDemo } from "./guide-demos";
import type { GuideDemo as DemoId } from "@/lib/guides/registry";
import pt from "@/lib/i18n/messages/pt-BR.json";

const M = pt as Record<string, string>;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function show(demo: DemoId) {
  const { calls } = mockApi({});
  const { container } = renderApp(<GuideDemo demo={demo} />);
  return { container, calls };
}

const ALL: DemoId[] = ["games", "cbc", "calendar", "challenge", "feed", "schemeSeal", "seal", "copilot", "autopilot", "explore", "hype", "brandVisitor", "brandOperator",
  "points", "shop", "pointsEarn", "highlights", "flairMatch", "flairCards", "flairDecks", "flairShops", "flairWallet", "flairQuests"];

describe("exemplos ilustrados dos tutoriais", () => {
  it.each(ALL)("o exemplo %s desenha texto traduzido e não chama a API", (demo) => {
    const { container, calls } = show(demo);
    expect(container.firstElementChild).not.toBeNull();
    expect(container.textContent).not.toMatch(/guide\.demo\.[a-z]/);
    expect(calls.filter((c) => !c.path.startsWith("/bff/auth") && c.path !== "/api/me")).toEqual([]);
  });

  it("id desconhecido não desenha nada", () => {
    const { container } = show("nada" as DemoId);
    expect(container.querySelector("[class^='gd-']")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("modos: quatro blocos, só o primeiro selecionado", () => {
    const { container } = show("games");
    const tiles = container.querySelectorAll(".gd-tile");
    expect(tiles).toHaveLength(4);
    expect(tiles[0].className).toContain("is-on");
    expect(tiles[1].className).not.toContain("is-on");
    expect(container.textContent).toContain(M["guide.demo.games.cbc_hint"]);
  });

  it("como ganhar: a primeira ação aparece animada e só ela mostra o limite diário", () => {
    const { container } = show("pointsEarn");
    const rows = container.querySelectorAll(".gd-ledger li");
    expect(rows[0].className).toBe("gd-anim-show");
    expect(rows[1].className).toBe("");
    expect(rows[0].querySelector("small")?.textContent).toContain(M["guide.demo.earn.cap"]);
    expect(rows[1].querySelector("small")).toBeNull();
    expect(rows[1].textContent).toContain("+20");
  });

  it("FAI Points: créditos com + e débito com sinal de menos e classe própria", () => {
    const { container } = show("points");
    const values = Array.from(container.querySelectorAll(".gd-ledger b")).map((b) => [b.textContent, b.className]);
    expect(values).toEqual([["+20", "tabular"], ["+10", "tabular"], ["−180", "is-debit tabular"]]);
    expect(container.textContent).toContain("1.240");
  });

  it("Hype: o fator indisponível mostra travessão e a nota", () => {
    const { container } = show("hype");
    const dds = Array.from(container.querySelectorAll(".gd-factors dd"));
    expect(dds).toHaveLength(4);
    expect(dds[0].querySelector("small")).toBeNull();
    expect(dds[3].textContent).toContain("—");
    expect(dds[3].querySelector("small")?.textContent).toContain(M["guide.demo.hype.unavailable"]);
  });

  it("marca: visitante vê coleções ativas e a dica; operador vê FLAIR ativo e os estados", () => {
    const visitor = show("brandVisitor").container;
    expect(visitor.querySelector(".gd-brand-tabs .is-active")?.textContent).toBe(M["common.colecoes"]);
    expect(visitor.textContent).toContain(M["guide.demo.brand.visitor_hint"]);
    expect(visitor.querySelector(".gd-states")).toBeNull();
    cleanup();
    const op = show("brandOperator").container;
    expect(op.querySelector(".gd-brand-tabs .is-active")?.textContent).toBe("FLAIR");
    const states = Array.from(op.querySelectorAll(".gd-states li"));
    expect(states).toHaveLength(4);
    expect(states[1].className).toBe("is-on");
    expect(op.textContent).not.toContain(M["guide.demo.brand.visitor_hint"]);
  });

  it("calendário: dias 20 a 26 marcados e o chip só no dia 20", () => {
    const { container } = show("calendar");
    expect(container.querySelectorAll(".gd-cal-day.is-event")).toHaveLength(7);
    expect(container.querySelectorAll(".gd-cal-chip")).toHaveLength(1);
  });

  it("explorar e piloto automático marcam o item certo", () => {
    const ex = show("explore").container;
    expect(ex.querySelectorAll(".gd-result.is-picked")).toHaveLength(1);
    cleanup();
    const ap = show("autopilot").container;
    expect(ap.querySelector(".gd-week .is-gap")?.textContent).toBe(M["guide.demo.autopilot.day3"]);
  });
});
