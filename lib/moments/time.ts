/**
 * Tempo dos Momentos no cliente (§9, §54). O servidor manda `now`, `startsInSeconds` e `endsInSeconds`; aqui só se anda
 * o relógio a partir do instante em que a resposta chegou (drift local não muda o que é "agora") e se formata.
 * Linguagem informativa: "Termina em 18 h", "Começa em 3 dias" — nunca "última chance".
 */
import type { MomentStatus, MomentTimeView } from "./types";

export interface Countdown { kind: "starts" | "ends" | "ended" | "inactive"; seconds: number; days: number; hours: number; minutes: number }

/** Segundos restantes corrigidos pelo tempo que passou desde a resposta (receivedAt = Date.now() na chegada). */
export function countdown(time: MomentTimeView, receivedAt: number, nowMs: number = Date.now()): Countdown {
  const drift = Math.max(0, Math.floor((nowMs - receivedAt) / 1000));
  if (time.status === "SCHEDULED") return parts("starts", time.startsInSeconds - drift);
  if (time.status === "ACTIVE") {
    const left = time.endsInSeconds - drift;
    return left <= 0 ? parts("ended", 0) : parts("ends", left);
  }
  if (time.status === "ENDED") return parts("ended", 0);
  return parts("inactive", 0);
}

function parts(kind: Countdown["kind"], seconds: number): Countdown {
  const s = Math.max(0, seconds);
  return { kind, seconds: s, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60) };
}

/** Granularidade que faz sentido mostrar: dias quando ≥ 1 dia, horas quando ≥ 1 h, senão minutos. */
export function unitOf(c: Countdown): "days" | "hours" | "minutes" {
  if (c.days >= 1) return "days";
  if (c.hours >= 1) return "hours";
  return "minutes";
}

export function statusAt(time: MomentTimeView, receivedAt: number, nowMs: number = Date.now()): MomentStatus {
  const c = countdown(time, receivedAt, nowMs);
  if (time.status === "SCHEDULED" && c.seconds === 0) return "ACTIVE";
  if (time.status === "ACTIVE" && c.kind === "ended") return "ENDED";
  return time.status;
}

/** Fração decorrida 0–1 para a barra de tempo (continua andando no cliente). */
export function elapsedAt(time: MomentTimeView, receivedAt: number, nowMs: number = Date.now()): number {
  const total = (Date.parse(time.endAt) - Date.parse(time.startAt)) / 1000;
  if (!Number.isFinite(total) || total <= 0) return 1;
  const c = countdown(time, receivedAt, nowMs);
  if (c.kind === "ends") return Math.max(0, Math.min(1, 1 - c.seconds / total));
  if (c.kind === "ended") return 1;
  return 0;
}

/** Data local (AAAA-MM-DD) → partes sem passar pelo fuso do navegador. */
export function ymd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** O Momento toca o dia (datas locais do Momento, inclusivas)? */
export function touchesDay(localStart: string, localEnd: string, day: string): boolean {
  const a = localStart.slice(0, 10), b = localEnd.slice(0, 10), x = day.slice(0, 10);
  return a <= x && x <= b;
}

export function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Dia da semana (0 = domingo) de uma data local, sem fuso: cálculo proleptivo gregoriano. */
export function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Semana (domingo a sábado) que contém o dia, como lista de chaves AAAA-MM-DD. */
export function weekOf(y: number, m: number, d: number): string[] {
  const start = new Date(Date.UTC(y, m - 1, d));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setUTCDate(start.getUTCDate() + i); return dayKey(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); });
}

/** "Hoje" no fuso informado (o do Momento ou o da pessoa), como AAAA-MM-DD; sem fuso válido, o do navegador. */
export function todayIn(tz: string | undefined, nowMs: number = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(nowMs));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    const d = new Date(nowMs);
    return dayKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}

/** O fuso IANA existe neste navegador? (valida o campo do admin antes de salvar) */
export function isValidTimeZone(tz: string | undefined | null): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/**
 * Instante ISO → valor de `<input type="datetime-local">` ("AAAA-MM-DDTHH:mm") na hora de parede do fuso informado (o
 * do Momento), e não no fuso do navegador nem em UTC. O mesmo texto volta ao servidor junto com o fuso, que o lê nesse
 * fuso: editar um Momento sem mexer nas datas nunca desloca os horários.
 */
export function instantToLocalInput(iso: string | undefined | null, tz: string): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
  } catch {
    return at.toISOString().slice(0, 16);   // fuso inválido: UTC, e o formulário avisa antes de salvar
  }
}
