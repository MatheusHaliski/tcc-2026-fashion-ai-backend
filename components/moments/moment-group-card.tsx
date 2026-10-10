"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import type { MomentCard as MomentCardData } from "@/lib/moments/types";
import { MomentIcon, MomentThemed, useLocalRange } from "./moment-shared";
export { MomentCard } from "./moment-shared";

/** Memória resumida de um Momento do grupo (§34): participantes, looks, votos e o look vencedor. */
export function MomentMemoryViewLite({ m, at }: { m: MomentCardData; at: number }) {
  const { t } = useI18n(); const range = useLocalRange(); void at;
  const mem = m.memory;
  return (
    <MomentThemed as="article" theme={m.theme} className="moment-card is-ended">
      <div className="moment-card-head"><MomentIcon theme={m.theme} /><div className="min-w-0 flex-1"><h4 className="type-h3 truncate"><Link href={`/moments/${m.slug}`} className="moment-link">{m.name}</Link></h4><p className="type-caption text-muted">{range(m.time)}</p></div></div>
      {mem ? <dl className="moment-memory-stats mt-2"><div><dt>{t("moments.memory.participants")}</dt><dd className="tabular">{mem.participants ?? 0}</dd></div><div><dt>{t("moments.memory.looks")}</dt><dd className="tabular">{mem.looks ?? 0}</dd></div><div><dt>{t("moments.memory.votes")}</dt><dd className="tabular">{mem.votes ?? 0}</dd></div>{mem.winner && <div><dt>{t("moments.memory.winner")}</dt><dd className="truncate">{mem.winner.title ?? "—"}</dd></div>}</dl> : <p className="type-caption text-muted mt-2">{t("moments.memory.pending")}</p>}
    </MomentThemed>
  );
}
