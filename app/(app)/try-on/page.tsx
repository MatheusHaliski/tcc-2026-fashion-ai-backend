"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Chip, ErrorState, Field, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface State { mannequin: { silhouetteUrl?: string; svg?: string; width?: number; height?: number; skinTone?: string; build?: string; [k: string]: unknown }; sex: "MASCULINO" | "FEMININO"; skinTones: (string | { id: string; hex?: string; label?: string })[]; builds: string[]; layers: string[]; pieces: Record<string, PieceView[]>; externalAvailable: boolean; preferences?: { skinTone?: string; build?: string }; }
interface Render { imageUrl: string; photoId?: string; pieceIds: string[]; placements?: unknown[]; warnings?: string[]; replaced?: unknown; stages?: { name: string; provider?: string; ms?: number }[]; costUsd?: number; totalMs?: number; fallbackUsed?: boolean; message?: string; explanation?: { provider?: string }; }

function TryOnInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const [sex, setSex] = useState<"MASCULINO" | "FEMININO" | undefined>(undefined);
  const { data, loading, error, reload } = useApi<State>((signal) => api.get(`/api/try-on${sex ? `?sex=${sex}` : ""}`, { signal }), [sex]);
  const [selected, setSelected] = useState<string[]>([]); const [render, setRender] = useState<Render | null>(null); const [busy, setBusy] = useState(false); const [title, setTitle] = useState("");
  useEffect(() => { const s = sp.get("scheme"); if (s) api.get<{ scheme: { items: { wardrobeItemId: string }[] } }>(`/api/schemes/${s}`).then((r) => setSelected(r.scheme.items.map((i) => i.wardrobeItemId))).catch(() => undefined); }, [sp]);
  async function doRender() { setBusy(true); try { const r = await api.post<Render>("/api/try-on/renders", { sex: data?.sex, pieceIds: selected }); setRender(r); if (r.message) toast.info(r.message); r.warnings?.forEach((w) => toast.info(w)); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function savePrefs(patch: { skinTone?: string; build?: string }) { try { await api.put("/api/try-on/preferences", { sex: data?.sex, skinTone: patch.skinTone ?? data?.preferences?.skinTone ?? data?.mannequin.skinTone, build: patch.build ?? data?.preferences?.build ?? data?.mannequin.build }); reload(); } catch (e) { toast.fromError(e); } }
  async function saveScheme() { try { const r = await api.post<{ scheme?: { id: string } }>("/api/try-on/schemes", { pieceIds: selected, title: title || "Look do provador", tryOnUrl: render?.imageUrl ?? null }); toast.success(t("scheme.saved")); if (r.scheme?.id) window.location.href = `/schemes/${r.scheme.id}`; } catch (e) { toast.fromError(e); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const tones = data.skinTones.map((x) => (typeof x === "string" ? { id: x, hex: x, label: x } : { id: x.id, hex: x.hex ?? x.id, label: x.label ?? x.id }));
  return (
    <>
      <PageHeader title={t("nav.tryon")} kicker="RF18" lead={data.externalAvailable ? "Try-on por IA (FASHN) com compositor local de reserva." : "Compositor local por camadas (IA externa desligada ou sem chave)."} />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="grid gap-3">
          <Card pad={false}>
            <div className="relative flex aspect-[3/4] items-center justify-center bg-surface-2">
              {render?.imageUrl ? <img src={mediaUrl(render.imageUrl)} alt="look provado" className="h-full w-full object-contain" /> : data.mannequin.silhouetteUrl ? <img src={mediaUrl(data.mannequin.silhouetteUrl)} alt="manequim" className="h-full object-contain opacity-80" /> : <svg viewBox="0 0 120 240" className="h-full" aria-label="manequim"><ellipse cx="60" cy="28" rx="18" ry="22" fill={tones.find((x) => x.id === (data.preferences?.skinTone ?? data.mannequin.skinTone))?.hex ?? "#d9b99b"} /><path d="M35 55 h50 l10 70 h-15 l-5 105 h-30 l-5 -105 h-15 z" fill={tones.find((x) => x.id === (data.preferences?.skinTone ?? data.mannequin.skinTone))?.hex ?? "#d9b99b"} opacity=".9" /></svg>}
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              <Chip active={data.sex === "MASCULINO"} onClick={() => setSex("MASCULINO")}><FaiIcon id="ACT-22" size={24} decorative />Masculino</Chip>
              <Chip active={data.sex === "FEMININO"} onClick={() => setSex("FEMININO")}><FaiIcon id="ACT-23" size={24} decorative />Feminino</Chip>
              <Button size="sm" variant="ghost" onClick={() => { setSelected([]); setRender(null); }}><FaiIcon id="ACT-24" size={24} decorative />Limpar</Button>
            </div>
          </Card>
          <Card>
            <p className="label">Tom de pele</p><div className="mb-2 flex flex-wrap gap-1.5">{tones.map((x) => <button key={x.id} type="button" aria-label={x.label} aria-pressed={(data.preferences?.skinTone ?? data.mannequin.skinTone) === x.id} className={`h-7 w-7 rounded-full border-2 ${(data.preferences?.skinTone ?? data.mannequin.skinTone) === x.id ? "border-mark" : "border-line-soft"}`} style={{ background: x.hex }} onClick={() => savePrefs({ skinTone: x.id })} />)}</div>
            <Field label="Biotipo" id="build"><Select id="build" value={(data.preferences?.build as string) ?? (data.mannequin.build as string) ?? ""} onChange={(e) => savePrefs({ build: e.target.value })}>{data.builds.map((b) => <option key={b} value={b}>{b.toLowerCase()}</option>)}</Select></Field>
          </Card>
          {render && <Card><p className="label">Render</p><p className="type-caption text-muted">{render.fallbackUsed ? "compositor local" : render.explanation?.provider ?? ""} · {render.totalMs ?? 0} ms{render.costUsd ? ` · US$ ${render.costUsd}` : ""}</p>{render.stages?.length ? <ul className="type-caption">{render.stages.map((s, i) => <li key={i}>{s.name} · {s.provider ?? ""} {s.ms ? `${s.ms} ms` : ""}</li>)}</ul> : null}</Card>}
        </div>
        <div>
          {data.layers.map((layer) => { const list = data.pieces[layer] ?? []; if (!list.length) return null; return (
            <section key={layer} className="mb-4"><h2 className="type-h3 mb-2">{layer === "BASE" ? "Base" : layer === "INTERMEDIATE" ? "Intermediária" : layer === "OUTER" ? "Externa" : "Acessórios"}</h2>
              <div className="flex flex-wrap gap-2">{list.map((p) => <button key={p.id} type="button" aria-pressed={selected.includes(p.id)} onClick={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} className={`w-24 rounded-md border-2 p-1 text-left ${selected.includes(p.id) ? "border-mark" : "border-line-soft"}`}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="aspect-square w-full object-contain" /><span className="block truncate type-caption">{p.name}</span></button>)}</div></section>); })}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={doRender} loading={busy} disabled={selected.length === 0}><FaiIcon id="NAV-07" size={24} decorative />Provar ({selected.length})</Button>
            {render && <><Input aria-label="título" className="max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do look" /><Button onClick={saveScheme}><FaiIcon id="ACT-25" size={24} decorative />Salvar como look</Button></>}
          </div>
        </div>
      </div>
    </>
  );
}
export default function TryOnPage() { return <RequireAuth><Suspense><TryOnInner /></Suspense></RequireAuth>; }
