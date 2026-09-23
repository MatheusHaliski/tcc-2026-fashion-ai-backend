"use client";
import { use } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui";
import { InteractionBar } from "@/components/interactions";
import type { UserCard } from "@/lib/api/types";

interface DnaSchemeDetail { id: string; owner: UserCard; title: string; archetype: string; identityPhrase?: string; palette: string[]; cardLayout: string; targetElement?: string; narrativeType?: string | null; seasonalTheme?: string | null; visibility: string; status: string; background?: Record<string, unknown>; cells: { schemeId: string; eraLabel?: string; milestone?: boolean; scheme?: { title: string; coverImageUrl?: string; hypeScore?: number }; pieces?: { name: string; imageUrl?: string; brand?: string }[] }[]; logos?: { name: string; url?: string }[]; logoCut?: string; narrative?: Record<string, unknown>; counters: { likes: number; comments: number; shares: number; remixes: number }; canEdit: boolean; publishedAt?: string | null; }

export default function DnaSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t } = useI18n(); const { user } = useAuth();
  const { data, loading, error, reload } = useApi<DnaSchemeDetail>((signal) => api.get(`/api/dna-schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-80" />;
  const horizontal = data.cardLayout === "HORIZONTAL" || data.cardLayout === "LATERAL";
  return (
    <>
      <p className="type-label text-muted">DNA de Estilo · {label(data.cardLayout.toLowerCase())} · {data.narrativeType?.replace(/_/g, " ").toLowerCase() ?? data.targetElement}</p>
      <h1 className="type-display">{data.title}</h1>
      <p className="type-body text-muted">por @{data.owner.username} · {data.archetype}{data.identityPhrase ? ` · “${data.identityPhrase}”` : ""}</p>
      <div className="mt-2 flex gap-1">{data.palette.map((c) => <span key={c} className="h-6 w-6 rounded-full border border-line-soft" style={{ background: c.startsWith("#") ? c : undefined }} title={c} />)}</div>
      <Card className="mt-4" pad={false}>
        <div className={`gap-2 p-3 ${horizontal ? "flex overflow-x-auto" : data.cardLayout === "GRADE" ? "grid grid-cols-2 sm:grid-cols-3" : "flex flex-col"}`}>
          {data.cells.map((c, i) => (
            <div key={c.schemeId} className={`${horizontal ? "w-48 shrink-0" : ""} surface p-2`}>
              <div className={`${data.cardLayout === "AMPLIADO" ? "aspect-[4/3]" : "aspect-[4/5]"} overflow-hidden rounded bg-surface-2`}>{c.scheme?.coverImageUrl && <img src={mediaUrl(c.scheme.coverImageUrl)} alt="" className="h-full w-full object-cover" />}</div>
              <p className="mt-1 type-body-sm"><b>{i + 1}.</b> {c.scheme?.title}{c.milestone && <Badge tone="chalk" className="ml-1">marco</Badge>}</p>
              <p className="type-caption text-muted">{c.eraLabel}{c.scheme?.hypeScore != null ? ` · hype ${Math.round(c.scheme.hypeScore)}` : ""}</p>
              {c.pieces?.length ? <p className="type-caption text-faint">{c.pieces.map((p) => p.name).join(" · ")}</p> : null}
            </div>
          ))}
        </div>
        {data.logos?.length ? <div className="flex flex-wrap gap-2 border-t border-line-soft p-3">{data.logos.map((l) => <span key={l.name} className="chip">{l.url && <img src={mediaUrl(l.url)} alt="" className="h-5 w-5" />}{l.name}</span>)}</div> : null}
      </Card>
      {data.narrative && Object.keys(data.narrative).length > 0 && <Card className="mt-4"><p className="label">Narrativa</p><dl className="grid gap-2 sm:grid-cols-2 type-body-sm">{Object.entries(data.narrative).slice(0, 12).map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{typeof v === "object" ? JSON.stringify(v).slice(0, 160) : String(v)}</dd></div>)}</dl></Card>}
      <div className="mt-4"><InteractionBar type="DNA_SCHEME" id={data.id} counters={{ ...data.counters, views: 0, saves: 0, reactions: {} }} viewer={{ liked: false, reactions: [], saved: false, canEdit: data.canEdit, following: false }} ownerId={data.owner.id} onChange={reload} /></div>
      <p className="mt-4 type-caption text-faint">{t("common.visibility")}: {label(data.visibility.toLowerCase())}</p>
    </>
  );
}
