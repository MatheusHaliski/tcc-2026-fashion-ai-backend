"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { SealAvailabilityState } from "@/lib/seals/availability";

/** O que a leitura do selo traz sobre o prazo de resgate (GET /api/users/{id}/seals). */
export interface SealAvailabilityInfo {
  availableFrom?: string | null;
  availableUntil?: string | null;
  availabilityState?: SealAvailabilityState | null;
}

/**
 * Prazo de resgate do selo na leitura (exercício 11): início e fim com data e hora locais de quem lê, e o estado
 * (agendado, aberto, encerrado...) calculado pelo servidor. Selo sem prazo não mostra nada; início ou fim vazios
 * aparecem como "imediato" / "sem fim", nunca como uma data inventada.
 */
export function SealAvailability({ seal }: { seal: SealAvailabilityInfo }) {
  const { t, fmtDateTime } = useI18n();
  if (!seal.availableFrom && !seal.availableUntil) return null;
  const state = seal.availabilityState ?? null;
  return (
    <span className="block" data-seal-availability data-seal-state={state ?? undefined}>
      {state && <b className="mr-1">{t(`sealAvailability.state.${state}`)}</b>}
      <span>{t("sealAvailability.window", {
        from: seal.availableFrom ? fmtDateTime(seal.availableFrom) : t("sealAvailability.immediate"),
        until: seal.availableUntil ? fmtDateTime(seal.availableUntil) : t("sealAvailability.noEnd"),
      })}</span>
    </span>
  );
}
