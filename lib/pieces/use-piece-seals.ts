"use client";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { toSealBadges, type SealBadge } from "@/components/scheme-card";

/** Um vínculo aprovado de tier PEÇA como GET /api/pieces/seals devolve (o mesmo formato de badge do look). */
export type PieceSealSource = NonNullable<Parameters<typeof toSealBadges>[0]>[number];
/** GET /api/pieces/seals aceita até 60 ids por pedido. */
export const PIECE_SEALS_MAX_IDS = 60;

/**
 * RF53 — selos de marca/celebridade APROVADOS das peças de uma página (guarda-roupa e Lookbook › Peças): UM pedido por
 * página em GET /api/pieces/seals?ids= (até 60 ids); falha = cards sem selo de marca. Os Selos de Hype não vêm daqui:
 * cada PieceCard já os tira do próprio resumo de Hype e junta os dois no SealSlot (withHypeSeals, mesmas vagas em
 * qualquer tela). `anonymous` vale para o perfil aberto por quem não entrou (a rota é pública e respeita a visibilidade).
 */
export function usePieceSeals(pieces: readonly { id: string }[] | null | undefined, opts: { anonymous?: boolean } = {}): (id: string) => SealBadge[] {
  const ids = (pieces ?? []).slice(0, PIECE_SEALS_MAX_IDS).map((p) => p.id).join(",");
  const { data } = useApi<{ items?: Record<string, PieceSealSource[]> }>(
    (signal) => api.get(`/api/pieces/seals?ids=${ids}`, { signal, ...(opts.anonymous ? { anonymous: true } : {}) }),
    [ids, !!opts.anonymous], { enabled: !!ids });
  return (id: string) => toSealBadges(data?.items?.[id]);
}
