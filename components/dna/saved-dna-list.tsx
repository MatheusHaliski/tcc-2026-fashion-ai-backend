"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { DnaView } from "@/components/dna-card";
import { Card } from "@/components/ui";

const VISIBILITY: Record<string, string> = {
  PRIVATE: "dna.saved.visibility.PRIVATE",
  FOLLOWERS: "dna.saved.visibility.FOLLOWERS",
  PUBLIC: "dna.saved.visibility.PUBLIC",
};
const DATE = { day: "2-digit", month: "short", year: "numeric" } as const;

/**
 * Os DNAs de estilo que a pessoa já salvou, no topo da aba DNA: depois de salvar, a aba não volta a parecer vazia.
 * Cada linha abre o DNA; sem nenhum salvo, a seção não aparece.
 */
export function SavedDnaList() {
  const { t, fmtDate } = useI18n();
  const { data } = useApi<DnaView[]>((signal) => api.get("/api/me/dna-schemes", { signal }), []);
  const saved = (data ?? []).filter((dna) => dna.id);
  if (saved.length === 0) return null;
  return (
    <Card className="mb-4">
      <h2 className="type-h3 mb-2">{t("dna.saved.title")}</h2>
      <ul className="history-list" aria-label={t("dna.saved.title")}>
        {saved.map((dna) => (
          <li key={dna.id} className="history-row">
            <Link href={`/dna-schemes/${dna.id}`} className="history-title underline">{dna.title}</Link>
            <span className="history-meta">
              {[dna.archetypeLabel, t(VISIBILITY[dna.visibility] ?? VISIBILITY.PUBLIC), dna.createdAt ? fmtDate(dna.createdAt, DATE) : null].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted mt-2">{t("dna.saved.hint")}</p>
    </Card>
  );
}
