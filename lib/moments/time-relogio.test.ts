import { describe, expect, it } from "vitest";
import { countdown, dayKey, elapsedAt, instantToLocalInput, isValidTimeZone, statusAt, todayIn, unitOf, weekOf, ymd, daysInMonth } from "./time";
import type { MomentTimeView } from "./types";

const base: MomentTimeView = { status: "ACTIVE", now: "", startAt: "2026-10-01T00:00:00Z", endAt: "2026-10-11T00:00:00Z", timezone: "UTC", localStart: "2026-10-01", localEnd: "2026-10-10", startsInSeconds: 0, endsInSeconds: 100, elapsed: 0 };

describe("relógio dos Momentos: casos de borda", () => {
  it("ativo que já passou do fim conta como encerrado e muda o status", () => {
    const c = countdown(base, 0, 200_000);
    expect(c).toEqual({ kind: "ended", seconds: 0, days: 0, hours: 0, minutes: 0 });
    expect(statusAt(base, 0, 200_000)).toBe("ENDED");
    expect(statusAt(base, 0, 0)).toBe("ACTIVE");
  });

  it("encerrado e outros status não contam tempo; agendado que zerou vira ativo", () => {
    expect(countdown({ ...base, status: "ENDED" }, 0, 0).kind).toBe("ended");
    expect(countdown({ ...base, status: "DRAFT" }, 0, 0).kind).toBe("inactive");
    const sched = { ...base, status: "SCHEDULED" as const, startsInSeconds: 10 };
    expect(statusAt(sched, 0, 0)).toBe("SCHEDULED");
    expect(statusAt(sched, 0, 20_000)).toBe("ACTIVE");
    expect(statusAt({ ...base, status: "CANCELLED" }, 0, 0)).toBe("CANCELLED");
  });

  it("drift negativo (relógio voltou) não aumenta o tempo restante", () => {
    expect(countdown(base, 10_000, 0).seconds).toBe(100);
  });

  it("unidade de exibição cai para horas e minutos", () => {
    expect(unitOf(countdown({ ...base, endsInSeconds: 7200 }, 0, 0))).toBe("hours");
    expect(unitOf(countdown({ ...base, endsInSeconds: 120 }, 0, 0))).toBe("minutes");
  });

  it("fração decorrida: inválida ou zero dá 1; agendado 0; ativo proporcional; encerrado 1", () => {
    expect(elapsedAt({ ...base, endAt: "x" }, 0, 0)).toBe(1);
    expect(elapsedAt({ ...base, endAt: base.startAt }, 0, 0)).toBe(1);
    expect(elapsedAt({ ...base, status: "SCHEDULED", startsInSeconds: 50 }, 0, 0)).toBe(0);
    expect(elapsedAt({ ...base, endsInSeconds: 864000 / 4 }, 0, 0)).toBeCloseTo(0.75);
    expect(elapsedAt({ ...base, status: "ENDED" }, 0, 0)).toBe(1);
  });

  it("datas locais sem fuso", () => {
    expect(ymd("2026-02-03T10:00")).toEqual({ y: 2026, m: 2, d: 3 });
    expect(dayKey(2026, 1, 5)).toBe("2026-01-05");
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(weekOf(2026, 1, 1)).toEqual(["2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("hoje no fuso pedido; fuso inválido cai no do navegador", () => {
    const at = Date.parse("2026-10-24T02:00:00Z");
    expect(todayIn("UTC", at)).toBe("2026-10-24");
    expect(todayIn("America/Sao_Paulo", at)).toBe("2026-10-23");
    const d = new Date(at);
    expect(todayIn("Fuso/Inexistente", at)).toBe(dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    expect(todayIn(undefined, at)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("valida fuso e converte instante para o campo datetime-local", () => {
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone("Nada/Aqui")).toBe(false);
    expect(isValidTimeZone("Europe/Lisbon")).toBe(true);
    expect(instantToLocalInput(null, "UTC")).toBe("");
    expect(instantToLocalInput("não é data", "UTC")).toBe("");
    expect(instantToLocalInput("2026-10-24T00:30:00Z", "America/Sao_Paulo")).toBe("2026-10-23T21:30");
    expect(instantToLocalInput("2026-10-24T00:30:00Z", "Fuso/Ruim")).toBe("2026-10-24T00:30");
  });
});
