// @vitest-environment jsdom
/**
 * Calendário de Momentos: mês (grade com faixas, legenda, "+N", vazio), semana (navegação, "continua"), ano (mês livre)
 * e linha do tempo (ordenada, vazia). O "hoje" é fixado só no relógio (Date), sem congelar os timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen, within } from "@/test-utils/render";
import { MomentCalendar } from "@/components/moments/moment-calendar";
import type { MomentCard, MomentsCalendar } from "@/lib/moments/types";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-25T15:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const time = (localStart: string, localEnd: string) => ({ status: "ACTIVE" as const, now: "2026-10-25T15:00:00Z", startAt: localStart + "T03:00:00Z", endAt: localEnd + "T23:00:00Z", timezone: "America/Sao_Paulo", localStart, localEnd, startsInSeconds: 0, endsInSeconds: 86400 * 3, elapsed: 0.5 });
const card = (id: string, name: string, s: string, e: string): MomentCard => ({ id, slug: id, name, type: "CULTURAL", nature: "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: false, sponsored: false, pointsEnabled: false, basePoints: 0, pointsMultiplier: 1, styleTags: [], occasionTags: [], colorTags: [], theme: { icon: "🎃", accent: "#F57C1F" }, time: time(s, e) });

const HALLOWEEN = card("halloween", "Halloween", "2026-10-20", "2026-10-31");
const OUT = [card("a1", "Alfa", "2026-10-25", "2026-10-25"), card("a2", "Beta", "2026-10-25", "2026-10-26"), card("a3", "Gama", "2026-10-25", "2026-10-25")];
const months = (items: Record<number, MomentCard[]>) => Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, days: 30, items: items[i + 1] ?? [] }));
const DATA: MomentsCalendar = { now: "2026-10-25T15:00:00Z", timezone: "America/Sao_Paulo", year: 2026, months: months({ 10: [HALLOWEEN, ...OUT], 11: [HALLOWEEN] }) };

describe("MomentCalendar", () => {
  it("mês: abre no mês atual, marca hoje, mostra até 3 faixas e '+N', a legenda e navega até os limites", () => {
    renderApp(<MomentCalendar data={DATA} receivedAt={Date.now()} />);
    expect(screen.getByText("Datas no fuso America/Sao_Paulo.")).toBeTruthy();
    const grid = screen.getByRole("grid", { name: "Calendário do mês" });
    const today = grid.querySelector("[aria-current=date]") as HTMLElement;
    expect(today.textContent).toContain("25");
    expect(within(today).getByLabelText("4 Momentos neste dia")).toBeTruthy();
    expect(within(today).getByText("+1")).toBeTruthy();
    const legend = screen.getByRole("list", { name: "Momentos do mês" });
    expect(within(legend).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/moments/halloween", "/moments/a1", "/moments/a2", "/moments/a3"]);
    expect(legend.textContent).toContain("20–31");
    // Navega até dezembro (o Halloween não toca dezembro → vazio) e o botão "próximo" trava em 12
    const next = screen.getByRole("button", { name: "Próximo mês" });
    fireEvent.click(next); fireEvent.click(next);
    expect(screen.getByText("Nenhum Momento neste mês.")).toBeTruthy();
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next);
    expect(screen.getByText(/dezembro/i)).toBeTruthy();
  });

  it("mês inicial explícito em janeiro desabilita o anterior; outro ano começa em janeiro", () => {
    renderApp(<MomentCalendar data={{ ...DATA, year: 2027, months: months({}) }} receivedAt={Date.now()} />);
    expect(screen.getByText(/janeiro/i)).toBeTruthy();
    const prev = screen.getByRole("button", { name: "Mês anterior" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(prev);
    expect(screen.getByText(/janeiro/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText(/fevereiro/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText(/janeiro/i)).toBeTruthy();
  });

  it("semana: cards na primeira aparição, 'continua' nos dias seguintes e navegação ‹ Hoje ›", () => {
    renderApp(<MomentCalendar data={DATA} receivedAt={Date.now()} initialView="week" />);
    const days = document.querySelectorAll(".moment-week-day");
    expect(days.length).toBe(7);
    expect(document.querySelector(".moment-week-day[aria-current=date]")!.textContent).toContain("Hoje");
    expect(screen.getAllByText(/continua/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Halloween" }).length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    expect(document.querySelector(".moment-week-day[aria-current=date]")).toBeNull();
    // semana de 01/11 a 07/11: só o Halloween não aparece mais, dias vazios mostram "—"
    expect(screen.getAllByText("—").length).toBe(7);
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(document.querySelector(".moment-week-day[aria-current=date]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(document.querySelector(".moment-week-day[aria-current=date]")).toBeTruthy();
  });

  it("semana em outro ano começa na semana de 1º de janeiro", () => {
    renderApp(<MomentCalendar data={{ ...DATA, year: 2025, months: months({}) }} receivedAt={Date.now()} initialView="week" />);
    expect(document.querySelector(".moment-week-day[aria-current=date]")).toBeNull();
    expect(document.querySelector(".moment-week")!.textContent).toContain("01");
  });

  it("ano: lista os 12 meses, destaca o atual e marca os livres", () => {
    renderApp(<MomentCalendar data={DATA} receivedAt={Date.now()} initialView="year" />);
    const list = screen.getByRole("list", { name: "Momentos de 2026" });
    expect(list.querySelectorAll(".moment-year-month").length).toBe(12);
    expect(list.querySelector(".is-current")!.textContent).toMatch(/outubro/i);
    expect(screen.getAllByText("mês livre").length).toBe(10);
    expect(list.textContent).toContain("10/20–10/31");
  });

  it("linha do tempo: ordena por início sem duplicar e mostra vazio quando não há nada", () => {
    renderApp(<MomentCalendar data={DATA} receivedAt={Date.now()} initialView="timeline" />);
    const names = Array.from(document.querySelectorAll(".moment-timeline h3")).map((h) => h.textContent);
    expect(names).toEqual(["Halloween", "Alfa", "Beta", "Gama"]);
    cleanup();
    renderApp(<MomentCalendar data={{ ...DATA, months: months({}) }} receivedAt={Date.now()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Linha do tempo" }));
    expect(screen.getByText("Nenhum Momento neste ano.")).toBeTruthy();
  });
});
