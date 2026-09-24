"use client";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Button, Card, ErrorState, Skeleton, useToast } from "@/components/ui";
import { InteractionBar } from "@/components/interactions";
import { DnaCard, dnaLayoutLabel, dnaNarrativeLabel, type DnaView } from "@/components/dna-card";
import { useDetailModal } from "@/components/detail-modal";

/** RF13 — Esquema de DNA aberto: card sempre ampliado + esquemas referenciados (abrem o detalhe RF7 em modal). */
export default function DnaSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtDate } = useI18n(); const { user } = useAuth(); const router = useRouter(); const toast = useToast(); const detail = useDetailModal();
  const { data, loading, error, reload } = useApi<DnaView>((signal) => api.get(`/api/dna-schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const kind = data.targetElement === "DNA_COMPLETO" && data.narrativeType ? `narrativa ${dnaNarrativeLabel(data.narrativeType)}` : `anatomia ${dnaLayoutLabel(data.cardLayout)}`;
  async function remove() { try { await api.delete(`/api/dna-schemes/${id}`); toast.success("DNA excluído."); router.push("/dna"); } catch (e) { toast.fromError(e); } }
  return (
    <>
      <p className="type-label text-muted">RF13 · DNA de estilo · {kind}</p>
      <h1 className="type-display">{data.title}</h1>
      <p className="type-body text-muted">por @{data.owner.username} · {data.archetypeLabel ?? data.archetype}{data.publishedAt ? ` · publicado em ${fmtDate(data.publishedAt)}` : " · rascunho"}</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,460px)_1fr]">
        <DnaCard dna={data} expanded />
        <div className="grid content-start gap-3">
          <Card>
            <p className="label">Esquemas referenciados ({data.cells.length})</p>
            <ul className="divide-y divide-line-soft">{data.cells.map((c, i) => (
              <li key={c.schemeId}><button type="button" className="flex w-full items-center gap-2 py-2 text-left hover:bg-surface-2" onClick={() => detail ? detail.openScheme(c.schemeId) : router.push(`/schemes/${c.schemeId}`)}>
                <span className="badge">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate type-body-sm font-medium">{c.title}{c.milestone && " ★"}</span><span className="block truncate type-caption text-muted">{[c.eraLabel, ...(c.occasion ?? []).map((o) => label(o)), c.dominantBrand].filter(Boolean).join(" · ")}</span></span><span className="type-caption text-muted">abrir ↗</span>
              </button></li>))}</ul>
          </Card>
          <Card><p className="label">Identidade</p><p className="type-body-sm">{data.identityPhrase ? `“${data.identityPhrase}”` : "—"}</p><div className="mt-2 flex gap-1">{data.palette.map((c) => <span key={c} className="h-6 w-6 rounded-full border border-line-soft" style={{ background: c }} title={c} />)}</div></Card>
          <InteractionBar type="DNA_SCHEME" id={data.id ?? id} counters={{ ...data.counters, views: 0, saves: 0, reactions: {} }} viewer={{ liked: false, reactions: [], saved: false, canEdit: data.canEdit, following: false }} ownerId={data.owner.id} onChange={reload} />
          {data.canEdit && <div className="flex flex-wrap gap-2"><Link href={`/dna-schemes/${id}/edit`} className="btn btn-primary">{t("common.edit")}</Link><Button variant="danger" onClick={remove}>{t("common.delete")}</Button><Link href="/dna" className="btn">Meus DNAs</Link></div>}
          <p className="type-caption text-faint">{t("common.visibility")}: {label(data.visibility.toLowerCase())}</p>
        </div>
      </div>
    </>
  );
}
