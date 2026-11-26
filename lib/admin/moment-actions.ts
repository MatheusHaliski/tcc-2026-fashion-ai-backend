export type MomentAction = "schedule" | "feature" | "unfeature" | "cancel" | "archive" | "draft" | "end";

const BY_STATUS: Record<string, MomentAction[]> = {
  DRAFT: ["schedule", "archive"],
  SCHEDULED: ["feature", "unfeature", "draft", "cancel"],
  ACTIVE: ["feature", "unfeature", "end", "cancel"],
  ENDED: ["archive"],
  CANCELLED: ["draft", "archive"],
  ARCHIVED: ["draft"],
};

/**
 * Ações que cabem no estado do Momento: um Momento no ar não oferece "Rascunho" nem "Agendar"; um rascunho não oferece
 * "Encerrar". "Destacar" e "Tirar destaque" nunca aparecem juntos. Estado desconhecido mostra todas (como antes).
 */
export function momentActions(status: string | null | undefined, featured: boolean): MomentAction[] {
  const all: MomentAction[] = ["schedule", "feature", "unfeature", "cancel", "archive", "draft", "end"];
  const allowed = BY_STATUS[String(status ?? "").toUpperCase()] ?? all;
  return allowed.filter((action) => (action === "feature" ? !featured : action === "unfeature" ? featured : true));
}

/** Opções de data no fuso do próprio Momento (25/11 23h em São Paulo não vira 26/11 em outro fuso); fuso inválido cai no do navegador. */
export function momentDateOptions(timezone: string | null | undefined): Intl.DateTimeFormatOptions {
  const base: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  if (!timezone) return base;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
    return { ...base, timeZone: timezone };
  } catch {
    return base;
  }
}
