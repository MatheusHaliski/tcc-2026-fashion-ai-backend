/**
 * Prazo de disponibilidade do selo (exercício 11). A API guarda e devolve instantes em UTC (ISO com "Z"); o campo
 * `datetime-local` do formulário trabalha na hora local de quem edita. A conversão acontece só aqui, nos dois sentidos.
 */

/** Estado do período calculado pelo servidor (SealViews.availabilityState). */
export type SealAvailabilityState = "INACTIVE" | "SCHEDULED" | "OPEN" | "ENDED" | "SOLD_OUT";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Instante da API → valor do `datetime-local` na hora local. Vazio ou inválido vira "" (campo em branco), nunca 1970.
 * Cortar o texto ISO ("2026-12-01T12:00") mostraria a hora UTC como se fosse local e, ao salvar, deslocaria o prazo.
 */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor do `datetime-local` (hora local) → instante em UTC para a API; campo vazio ou inválido vira null. */
export function localInputToIso(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fim antes do início (os dois preenchidos): o mesmo critério do servidor, para avisar antes de enviar. */
export function invertedWindow(from?: string | null, until?: string | null): boolean {
  const a = localInputToIso(from);
  const b = localInputToIso(until);
  return !!a && !!b && new Date(b).getTime() < new Date(a).getTime();
}
