"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useWebGL, type Look3d } from "@/components/three/common";
import type { RunwayEntry } from "@/components/three/runway-scene";

const RunwayScene = dynamic(() => import("@/components/three/runway-scene"), { ssr: false, loading: () => <div className="showcase-3d-loading">acendendo a passarela…</div> });

interface Runway { date: string; nextUpdate: string; total: number; looks: RunwayEntry[]; you?: { optedOut: boolean; hasLook: boolean; position: number | null } }

/**
 * Passarela 3D (Explorar · card Trello): o desfile do dia com o Look do Dia de cada perfil visível. Cada manequim tem o
 * sexo do cadastro (RF1) e, com foto de perfil, o rosto da pessoa; a ordem segue o Hype Score e muda todo dia.
 */
export function RunwayPanel() {
  const { user } = useAuth(); const { fmtDate } = useI18n(); const webgl = useWebGL();
  const { data, loading, error, reload } = useApi<Runway>((signal) => api.get("/api/explorer/runway?limit=12", { signal, anonymous: !user }), [!!user]);
  const [sel, setSel] = useState<RunwayEntry | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[520px]" />;
  const picked = sel ?? data.looks[0] ?? null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="type-body flex-1">Desfile de {fmtDate(data.date)} · {data.total} look(s) do dia · a passarela troca à meia-noite.</p>
        {data.you && (data.you.optedOut ? <Link className="btn btn-sm" href="/settings">Você saiu da passarela — voltar</Link>
          : data.you.hasLook ? <span className="badge badge-chalk">Você desfila hoje{data.you.position ? ` · #${data.you.position}` : ""}</span>
          : <Link className="btn btn-sm btn-primary" href="/mirror">Marcar meu Look do Dia</Link>)}
      </div>
      {data.looks.length === 0 ? <EmptyState title="Ninguém desfilou hoje ainda." hint="Marque um Look do Dia no Espelho ou no Lookbook e ele entra na passarela." /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="showcase-3d h-[540px]">
            {webgl === false ? <RunwayFallback looks={data.looks} onPick={setSel} /> : <RunwayScene entries={data.looks} date={fmtDate(data.date)} onPick={setSel} selectedId={picked?.look.schemeId} />}
          </div>
          <div className="grid content-start gap-3">
            {picked && <LookCard e={picked} />}
            <Card>
              <p className="label mb-1">Ordem do desfile</p>
              <ol className="divide-y divide-line-soft">{data.looks.map((e) => (
                <li key={e.look.schemeId}><button type="button" className={`flex w-full items-center gap-2 py-1.5 text-left ${picked?.look.schemeId === e.look.schemeId ? "font-semibold" : ""}`} onClick={() => setSel(e)}>
                  <span className="w-7 type-data tabular">#{e.position}</span><Avatar src={mediaUrl(e.look.owner?.avatarUrl)} name={e.look.owner?.displayName} size={24} />
                  <span className="min-w-0 flex-1 truncate type-body-sm">@{e.look.owner?.username}{e.you ? " (você)" : ""}</span>
                  <span className="type-caption text-muted tabular">{e.look.hypeScore != null ? Math.round(Number(e.look.hypeScore)) : "—"}</span>
                </button></li>))}</ol>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function LookCard({ e }: { e: RunwayEntry }) {
  const l: Look3d = e.look;
  return (
    <Card>
      <div className="flex items-center gap-2"><Avatar src={mediaUrl(l.owner?.avatarUrl)} name={l.owner?.displayName} size={36} /><div className="min-w-0"><p className="type-body font-semibold truncate">{l.title}</p><p className="type-caption text-muted">@{l.owner?.username} · manequim {l.mannequin.sex === "MASCULINO" ? "masculino" : "feminino"}{l.mannequin.head === "FOTO" ? " com foto" : " padrão"}</p></div></div>
      <ul className="mt-2 flex flex-wrap gap-1">{l.pieces.map((p) => <li key={p.id} title={p.name} className="h-12 w-12 overflow-hidden rounded bg-surface-2">{p.imageUrl && <img src={mediaUrl(p.imageUrl)} alt={p.name} className="h-full w-full object-contain" />}</li>)}</ul>
      <p className="mt-2 type-caption text-muted tabular">♥ {l.likes ?? 0} · Hype {l.hypeScore != null ? Math.round(Number(l.hypeScore)) : "—"}{e.carriedOver ? " · continua de ontem" : ""}</p>
      {l.schemeId && <Link className="btn btn-sm mt-2" href={`/schemes/${l.schemeId}`}>Abrir o look</Link>}
    </Card>
  );
}

function RunwayFallback({ looks, onPick }: { looks: RunwayEntry[]; onPick: (e: RunwayEntry) => void }) {
  return (
    <div className="flex h-full items-end gap-3 overflow-x-auto bg-[#0b0e16] p-4">
      {looks.map((e) => <button key={e.look.schemeId} type="button" onClick={() => onPick(e)} className="flex shrink-0 flex-col items-center gap-1 text-white">
        {e.look.mannequin.photoUrl && <img src={mediaUrl(e.look.mannequin.photoUrl)} alt="" className="h-10 w-10 rounded-full object-cover" />}
        {e.look.pieces.slice(0, 3).map((p) => p.imageUrl && <img key={p.id} src={mediaUrl(p.imageUrl)} alt={p.name} className="h-16 object-contain" />)}
        <span className="type-caption">#{e.position} @{e.look.owner?.username}</span>
      </button>)}
      <Button size="sm" className="ml-auto self-start" onClick={() => undefined} disabled>sem WebGL: passarela 2D</Button>
    </div>
  );
}
