import { describe, expect, it } from "vitest";
import { countdown, daysInMonth, elapsedAt, statusAt, touchesDay, unitOf, weekOf, weekday } from "./time";
import { momentIcon, momentStyle, momentTone, safeGradient } from "./theme";
import type { MomentTimeView } from "./types";

const active: MomentTimeView = { status: "ACTIVE", now: "2026-10-25T12:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "America/Sao_Paulo", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 6 * 86400 + 3 * 3600, elapsed: 0.45, daysLeft: 7 };
const scheduled: MomentTimeView = { ...active, status: "SCHEDULED", startsInSeconds: 3 * 86400, endsInSeconds: 0, elapsed: 0, daysLeft: null };

describe("tempo dos Momentos: o servidor decide, o cliente só anda o relógio", () => {
  it("corrige a contagem pelo tempo passado desde a resposta", () => {
    const received = 1_000_000;
    const c = countdown(active, received, received + 3 * 3600 * 1000);
    expect(c.kind).toBe("ends");
    expect(c.days).toBe(6);
    expect(c.hours).toBe(0);
    expect(unitOf(c)).toBe("days");
    expect(countdown(scheduled, received, received).kind).toBe("starts");
  });
  it("vira ACTIVE/ENDED sozinho quando a contagem zera, sem esperar o servidor", () => {
    const received = 0;
    expect(statusAt(scheduled, received, 3 * 86400 * 1000 + 1)).toBe("ACTIVE");
    expect(statusAt(active, received, 30 * 86400 * 1000)).toBe("ENDED");
    expect(statusAt(active, received, 1000)).toBe("ACTIVE");
    expect(countdown(active, received, 30 * 86400 * 1000).kind).toBe("ended");
  });
  it("fração decorrida continua andando", () => {
    const a = elapsedAt(active, 0, 0); const b = elapsedAt(active, 0, 2 * 86400 * 1000);
    expect(b).toBeGreaterThan(a);
    expect(elapsedAt(scheduled, 0, 0)).toBe(0);
  });
  it("calendário por datas locais, sem fuso do navegador", () => {
    expect(touchesDay("2026-10-20", "2026-10-31", "2026-10-31")).toBe(true);
    expect(touchesDay("2026-10-20", "2026-10-31", "2026-11-01")).toBe(false);
    expect(weekday(2026, 10, 25)).toBe(0);   // domingo
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(weekOf(2026, 10, 28)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });
});

describe("tema do Momento é uma camada segura sobre a identidade FashionAI", () => {
  it("só aceita cores hex e gradientes simples", () => {
    const s = momentStyle({ accent: "#F57C1F", background: "#1A1020", gradient: "linear-gradient(135deg,#1A1020,#F57C1F)" }) as Record<string, string>;
    expect(s["--moment-accent"]).toBe("#F57C1F");
    expect(s["--moment-gradient"]).toContain("linear-gradient");
    expect(momentStyle({ accent: "red; background:url(x)", gradient: "url(javascript:alert(1))" })).toEqual({});
    expect(safeGradient("linear-gradient(90deg, #fff, #000)")).toBeDefined();
  });
  it("tom escuro só com fundo escuro ou tom declarado", () => {
    expect(momentTone({ background: "#1A1020" })).toBe("dark");
    expect(momentTone({ background: "#FFF6EC" })).toBe("light");
    expect(momentTone({ tone: "dark" })).toBe("dark");
    expect(momentIcon({ icon: "🎃" })).toBe("🎃");
    expect(momentIcon({ icon: "<script>" })).toBe("◌");
  });
});
