"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";

export function usePieceCommerceCells(piece: Pick<PieceView, "expiresAt" | "commerce">): Record<"expiry" | "deal", ReactNode> {
  const { t, fmtDate } = useI18n();
  const expiresAt = piece.commerce?.expiresAt ?? piece.expiresAt;
  const username = piece.commerce?.negotiationPartnerUsername;
  return {
    expiry: expiresAt ? fmtDate(expiresAt, { timeZone: "America/Sao_Paulo" }) : null,
    deal: username ? <Link href={`/u/${encodeURIComponent(username)}`}>@{username}</Link> :
      piece.commerce?.negotiationStartedAt && !piece.commerce.negotiationId ? t("marketplace.brand_offer") : null,
  };
}
