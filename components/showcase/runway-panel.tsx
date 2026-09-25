"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { useWebGL, type Look3d } from "@/components/three/common";
import type { RunwayEntry } from "@/components/three/runway-scene";

const RunwayScene = dynamic(() => import("@/components/three/runway-scene"), { ssr: false, loading: () => <div className="showcase-3d-loading">{tr("showcase.runwayPanel.acendendo_a_passarela")}</div> });

interface Facet { value: string; count: number; }
interface Row { position: number; schemeId: string; title: string; owner: { username: string; displayName: string; avatarUrl?: string | null }; hypeScore?: number | null; likes: number; country?: string | null; region: string; you: boolean; }
interface Runway {
  date: string; nextUpdate: string; total: number; totalToday: number; ranking: string; rankings: string[]; looks: (RunwayEntry & { country?: string | null; region?: string })[];
  table: Row[]; batch: { offset: number; limit: number; from: number; to: number; hasNext: boolean; hasPrev: boolean };
  facets: { regions: { code: string; label: string; count: number }[]; countries: Facet[]; colors: Facet[]; occasions: Facet[]; styles: Facet[] };
  you?: { optedOut: boolean; hasLook: boolean; position: number | null; region?: string | null; country?: string | null };
}
const RANKING_LABEL: Record<string, string> = { get TOP100_GLOBAL() { return tr("showcase.runwayPanel.top_100_global"); }, get TOP100_REGIONAL() { return tr("showcase.runwayPanel.top_100_regional"); }, get TOP100_PAIS() { return tr("showcase.runwayPanel.top_100_do_pais"); }, get SEGUINDO() { return tr("showcase.runwayPanel.seguindo"); }, get EM_ALTA() { return tr("showcase.runwayPanel.em_alta"); }, get RECENTES() { return tr("brands.recentes"); } };
const BATCH = 12;

/**
 * Passarela 3D (RF33 · Explorar): o desfile do dia com o Look do Dia de cada perfil visível. Rankings (Top 100 Global,
 * Top 100 Regional por região do mundo, Top 100 do país, Seguindo, Em alta, Recentes) e filtros por região, cores,
 * ocasiões, estilos e manequim. Como é inviável desfilar todo mundo, a passarela mostra um lote de 12 por vez e a
 * tabela ao lado vai até o Top 100.
 */
export function RunwayPanel() {
  const { user } = useAuth(); const { fmtDate, t } = useI18n(); const webgl = useWebGL();
  const [ranking, setRanking] = useState("TOP100_GLOBAL"); const [region, setRegion] = useState(""); const [country, setCountry] = useState("");
  const [colors, setColors] = useState<string[]>([]); const [occasions, setOccasions] = useState<string[]>([]); const [styles, setStyles] = useState<string[]>([]);
  const [sex, setSex] = useState(""); const [offset, setOffset] = useState(0);
  const query = useMemo(() => {
    const q = new URLSearchParams({ limit: String(BATCH), offset: String(offset), ranking });
    if (region) q.set("region", region); if (country) q.set("country", country); if (sex) q.set("sex", sex);
    colors.forEach((c) => q.append("colors", c)); occasions.forEach((c) => q.append("occasions", c)); styles.forEach((c) => q.append("styles", c));
    return q.toString();
  }, [ranking, region, country, colors, occasions, styles, sex, offset]);
  const { data, loading, error, reload } = useApi<Runway>((signal) => api.get(`/api/explorer/runway?${query}`, { signal, anonymous: !user }), [!!user, query]);
  const [sel, setSel] = useState<RunwayEntry | null>(null);
  // O 3D é pesado para celular: a passarela abre em 2D e o desfile em 3D carrega quando a pessoa pede (e fica lembrado).
  const [want3d, setWant3d] = useState(false);
  useEffect(() => { try { setWant3d(localStorage.getItem("fai.runway3d") === "1"); } catch { /* sem armazenamento */ } }, []);
  const play3d = () => { setWant3d(true); try { localStorage.setItem("fai.runway3d", "1"); } catch { /* sem armazenamento */ } };
  const toggle = (xs: string[], x: string, set: (v: string[]) => void) => { set(xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]); setOffset(0); };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-[520px]" />;
  const picked = sel && data.looks.some((l) => l.look.schemeId === sel.look.schemeId) ? sel : data.looks[0] ?? null;
  const anyFilter = region || country || colors.length || occasions.length || styles.length || sex;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="type-body flex-1">{t("showcase.runwayPanel.desfile_de_look_s_do", { date: fmtDate(data.date), totalToday: data.totalToday, RANKING_LABEL: RANKING_LABEL[data.ranking], total: data.total })}</p>
        {data.you && (data.you.optedOut ? <Link className="btn btn-sm" href="/settings">{t("showcase.runwayPanel.voce_saiu_da_passarela_voltar")}</Link>
          : data.you.hasLook ? <span className="badge badge-chalk">{t("showcase.runwayPanel.voce_desfila_hoje", { value: data.you.position ? t("showcase.runwayPanel.no", { position: data.you.position, RANKING_LABEL: RANKING_LABEL[data.ranking] }) : "" })}</span>
          : <Link className="btn btn-sm btn-primary" href="/mirror">{t("showcase.runwayPanel.marcar_meu_look_do_dia")}</Link>)}
      </div>
      <FilterBar
        quick={{ key: "ranking", label: t("showcase.runwayPanel.filtros_da_passarela"), options: data.rankings.filter((r) => user || r !== "SEGUINDO").map((r) => ({ value: r, label: RANKING_LABEL[r] ?? r })) }}
        filters={[
          { key: "region", label: t("showcase.runwayPanel.regiao_do_mundo"), options: data.facets.regions.map((r) => ({ value: r.code, label: `${r.label} (${r.count})` })) },
          { key: "country", label: t("auth.country"), options: data.facets.countries.map((c) => ({ value: c.value, label: `${c.value} (${c.count})` })) },
          { key: "sex", label: t("common.manequim"), options: [{ value: "FEMININO", label: t("common.feminino") }, { value: "MASCULINO", label: t("common.masculino") }] },
          { key: "colors", label: t("showcase.runwayPanel.cores"), multi: true, options: data.facets.colors.slice(0, 16).map((c) => ({ value: c.value, label: `${label(c.value)} (${c.count})` })) },
          { key: "occasions", label: t("common.ocasioes"), multi: true, options: data.facets.occasions.slice(0, 16).map((c) => ({ value: c.value, label: `${label(c.value)} (${c.count})` })) },
          { key: "styles", label: t("common.estilos"), multi: true, options: data.facets.styles.slice(0, 16).map((c) => ({ value: c.value, label: `${label(c.value)} (${c.count})` })) },
        ]}
        values={{ ranking, region, country, sex, colors: colors.join(","), occasions: occasions.join(","), styles: styles.join(",") }}
        onChange={(k, v) => {
          setOffset(0);
          const list = v ? v.split(",") : [];
          if (k === "ranking") { setRanking(v || "TOP100_GLOBAL"); if (v !== "TOP100_REGIONAL") setRegion(""); if (v !== "TOP100_PAIS") setCountry(""); }
          else if (k === "region") { setRegion(v); if (v && ranking === "TOP100_GLOBAL") setRanking("TOP100_REGIONAL"); }
          else if (k === "country") setCountry(v);
          else if (k === "sex") setSex(v);
          else if (k === "colors") setColors(list);
          else if (k === "occasions") setOccasions(list);
          else if (k === "styles") setStyles(list);
        }}
        resultCount={data.total} />
      {data.looks.length === 0 ? <EmptyState title={anyFilter || ranking !== "TOP100_GLOBAL" ? t("showcase.runwayPanel.nenhum_look_com_esses_filtros") : t("showcase.runwayPanel.ninguem_desfilou_hoje_ainda")} hint={t("showcase.runwayPanel.marque_um_look_do_dia")} /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="showcase-3d h-[540px]" aria-busy={loading}>
              {webgl !== false && want3d
                ? <RunwayScene entries={data.looks} date={fmtDate(data.date)} onPick={setSel} selectedId={picked?.look.schemeId} />
                : <RunwayFallback looks={data.looks} onPick={setSel} can3d={webgl !== false} onPlay={play3d} />}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button size="sm" disabled={!data.batch.hasPrev} onClick={() => setOffset(Math.max(0, offset - BATCH))}>{t("showcase.runwayPanel.lote_anterior")}</Button>
              <span className="type-caption tabular">{t("showcase.runwayPanel.desfilando_de", { from: data.batch.from, to: data.batch.to, total: data.total })}</span>
              <Button size="sm" disabled={!data.batch.hasNext} onClick={() => setOffset(offset + BATCH)}>{t("showcase.runwayPanel.proximo_lote")}</Button>
            </div>
          </div>
          <div className="grid content-start gap-3">
            {picked && <LookCard e={picked} />}
            <Card>
              <p className="label mb-1">{RANKING_LABEL[data.ranking]} · {data.total}</p>
              <ol className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">{data.table.map((r) => {
                const inBatch = r.position >= data.batch.from && r.position <= data.batch.to;
                return (
                  <li key={r.schemeId}><button type="button" className={`flex w-full items-center gap-2 py-1.5 text-left ${picked?.look.schemeId === r.schemeId ? "font-semibold" : ""} ${inBatch ? "" : "opacity-70"}`}
                    onClick={() => { const hit = data.looks.find((l) => l.look.schemeId === r.schemeId); if (hit) setSel(hit); else setOffset(Math.floor((r.position - 1) / BATCH) * BATCH); }}>
                    <span className="w-8 type-data tabular">#{r.position}</span><Avatar src={mediaUrl(r.owner?.avatarUrl)} name={r.owner?.displayName} size={24} />
                    <span className="min-w-0 flex-1 truncate type-body-sm">@{r.owner?.username}{r.you ? t("showcase.runwayPanel.voce") : ""}<span className="type-caption text-muted"> · {r.country ?? "—"}</span></span>
                    <span className="type-caption text-muted tabular">{r.hypeScore != null ? Math.round(Number(r.hypeScore)) : "—"}</span>
                  </button></li>);
              })}</ol>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function LookCard({ e }: { e: RunwayEntry }) {
  const { t } = useI18n();
  const l: Look3d = e.look;
  return (
    <Card>
      <div className="flex items-center gap-2"><Avatar src={mediaUrl(l.owner?.avatarUrl)} name={l.owner?.displayName} size={36} /><div className="min-w-0"><p className="type-body font-semibold truncate">{l.title}</p><p className="type-caption text-muted">{t("showcase.runwayPanel.manequim", { username: l.owner?.username, value: l.mannequin.sex === "MASCULINO" ? t("common.masculino_2") : t("common.feminino_2"), value2: l.mannequin.head === "FOTO" ? t("showcase.runwayPanel.com_foto") : t("common.padrao") })}</p></div></div>
      <ul className="mt-2 flex flex-wrap gap-1">{l.pieces.map((p) => <li key={p.id} title={p.name} className="h-12 w-12 overflow-hidden rounded bg-surface-2">{p.imageUrl && <img src={mediaUrl(p.imageUrl)} alt={p.name} className="h-full w-full object-contain" />}</li>)}</ul>
      <p className="mt-2 type-caption text-muted tabular">{t("showcase.runwayPanel.hype", { value: l.likes ?? 0, value2: l.hypeScore != null ? Math.round(Number(l.hypeScore)) : "—", value3: e.carriedOver ? t("showcase.runwayPanel.continua_de_ontem") : "" })}</p>
      {l.schemeId && <Link className="btn btn-sm mt-2" href={`/schemes/${l.schemeId}`}>{t("showcase.runwayPanel.abrir_o_look")}</Link>}
    </Card>
  );
}

function RunwayFallback({ looks, onPick, can3d, onPlay }: { looks: RunwayEntry[]; onPick: (e: RunwayEntry) => void; can3d: boolean; onPlay: () => void }) {
  const { t } = useI18n();
  return (
    <div className="runway-2d">
      <ol className="runway-2d-line">
        {looks.map((e) => (
          <li key={e.look.schemeId}>
            <button type="button" onClick={() => onPick(e)} className="runway-2d-look" aria-label={t("showcase.runwayPanel.lookAt", { position: e.position, username: e.look.owner?.username ?? "" })}>
              <span className="runway-2d-pos tabular">#{e.position}</span>
              <span className="runway-2d-pieces">{e.look.pieces.slice(0, 3).map((p) => p.imageUrl && <img key={p.id} src={mediaUrl(p.imageUrl)} alt="" loading="lazy" decoding="async" />)}</span>
              <span className="runway-2d-name">@{e.look.owner?.username}</span>
            </button>
          </li>
        ))}
      </ol>
      {can3d ? <Button variant="primary" className="runway-2d-play" onClick={onPlay}>{t("showcase.runwayPanel.play3d")}</Button>
        : <p className="runway-2d-note">{t("showcase.runwayPanel.sem_webgl_passarela_2d")}</p>}
    </div>
  );
}
