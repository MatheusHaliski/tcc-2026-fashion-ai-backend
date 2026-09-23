"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

interface MPiece { id: string; name: string; imageUrl?: string; thumbnailUrl?: string; category?: string; subcategory?: string; color?: string; colorHex?: string; addressLabel?: string; }
interface State { slots: Record<string, MPiece | MPiece[] | null>; complete: boolean; missing: { slot: string; action: string; message: string }[]; warnings?: string[]; origin?: string; prompt?: string | null; interpretation?: Record<string, unknown> | null; actions?: string[]; silhouette?: string | null; postIt?: string | null; light?: { kelvin: number; label?: string }; restriction?: { challenge: string } | null; shownCount?: number; }
const SLOT_LABEL: Record<string, string> = { outer_layer: "Camada externa", upper: "Superior", dress: "Vestido", lower: "Inferior", shoes: "Calçados", accessory: "Acessórios" };

function MirrorInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload, setData } = useApi<State>((signal) => api.get("/api/me/mirror", { signal }), []);
  const [prompt, setPrompt] = useState(""); const [keep, setKeep] = useState(false); const [busy, setBusy] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ slot: string; alternatives: MPiece[]; message?: string } | null>(null); const [grwm, setGrwm] = useState<{ steps?: { title?: string; text?: string; pieceId?: string }[]; title?: string } | null>(null); const [saveTitle, setSaveTitle] = useState<string | null>(null);
  useEffect(() => { const pid = sp.get("piece"); if (pid) api.post<State>("/api/me/mirror/pieces", { pieceId: pid }).then(setData).catch((e) => toast.fromError(e)); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (key: string, fn: () => Promise<State | Record<string, unknown>>, ok?: string) => { setBusy(key); try { const r = await fn(); if ((r as State).slots) setData(r as State); else reload(); if (ok) toast.success(ok); if ((r as { message?: string }).message && !(r as State).slots) toast.info(String((r as { message?: string }).message)); return r; } catch (e) { toast.fromError(e); } finally { setBusy(null); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const worn = Object.entries(data.slots).flatMap(([slot, v]) => (Array.isArray(v) ? v.map((p) => ({ slot, p })) : v ? [{ slot, p: v }] : []));
  return (
    <>
      <PageHeader title={t("nav.mirror")} kicker="RF28" lead={data.restriction ? `Desafio ativo: ${data.restriction.challenge} — só as peças permitidas aparecem.` : "Monte o look no espelho ou peça: “Vista-me para um jantar”."} />
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <Card pad={false} className="overflow-hidden">
          <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-1 p-4" style={{ background: `radial-gradient(circle at 50% 20%, ${data.light && data.light.kelvin < 3500 ? "#fff1dc" : data.light && data.light.kelvin > 5000 ? "#e8f2ff" : "#f7f4ec"}, var(--surface-2))` }} aria-label="espelho">
            {worn.length === 0 && <p className="type-body text-muted">Espelho vazio</p>}
            {["outer_layer", "upper", "dress", "lower", "shoes", "accessory"].map((slot) => worn.filter((w) => w.slot === slot).map((w) => <button key={w.p.id} type="button" className="group relative" onClick={() => run("rm", () => api.delete(`/api/me/mirror/pieces/${w.p.id}`))} title={`${w.p.name} — clique para tirar`}><img src={mediaUrl(w.p.imageUrl ?? w.p.thumbnailUrl)} alt={w.p.name} className="h-24 object-contain drop-shadow" /><span className="absolute -right-1 -top-1 hidden rounded-full bg-ink px-1 text-[10px] text-surface group-hover:block">✕</span></button>))}
            {data.postIt && <p className="absolute right-3 top-3 max-w-[150px] rotate-2 bg-chalk-soft p-2 text-[11px] shadow" role="note">📌 {data.postIt}</p>}
            {data.silhouette && <p className="absolute bottom-3 left-3 type-caption text-muted">silhueta: {data.silhouette}</p>}
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            <Button size="sm" onClick={() => run("clear", () => api.delete("/api/me/mirror"))}>Limpar</Button>
            <Button size="sm" onClick={() => run("one", () => api.post("/api/me/mirror/take-one-off"), "Tirei uma coisa.")} disabled={worn.length < 2}><FaiIcon id="ACT-33" size={24} decorative />Tira uma coisa</Button>
            <Button size="sm" onClick={async () => { const r = await run("grwm", () => api.get("/api/me/mirror/grwm")); if (r) setGrwm(r as typeof grwm); }} disabled={!data.complete}>GRWM</Button>
          </div>
        </Card>
        <div className="grid gap-3">
          <Card>
            <h2 className="type-h3 mb-2">Vista-me</h2>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run("vista", () => api.post("/api/me/mirror/vista-me", { prompt, keepMirror: keep }), undefined); }}>
              <Input aria-label="pedido" className="flex-1" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="ex.: algo confortável para trabalhar, com o blazer preto" />
              <Button type="submit" variant="primary" loading={busy === "vista"}><FaiIcon id="ACT-32" size={24} decorative />Vista-me</Button>
            </form>
            <Switch checked={keep} onChange={setKeep} label="Manter o que já está no espelho (âncoras)" />
            {data.prompt && <p className="type-caption text-muted">Último pedido: “{data.prompt}” · {data.shownCount ?? 0} combinações mostradas</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => run("another", () => api.post("/api/me/mirror/another"))} disabled={!data.prompt}>Outro look</Button>{worn.map((w) => <Button key={w.p.id} size="sm" onClick={() => run("swap", () => api.post(`/api/me/mirror/slots/${w.slot}/swap`))}><FaiIcon id="ACT-34" size={24} decorative />Trocar {SLOT_LABEL[w.slot] ?? w.slot}</Button>)}</div>
          </Card>
          <Card>
            <h2 className="type-h3 mb-2">Slots</h2>
            <ul className="divide-y divide-line-soft">{Object.entries(SLOT_LABEL).map(([slot, lbl]) => { const v = data.slots[slot]; const items = Array.isArray(v) ? v : v ? [v] : []; const miss = data.missing.find((m) => m.slot === slot); return <li key={slot} className="flex items-center gap-3 py-2"><span className="w-28 type-label text-muted">{lbl}</span><span className="flex-1 type-body">{items.length ? items.map((p) => p.name).join(", ") : <span className="text-faint">{miss?.message ?? "—"}</span>}</span><Button size="sm" onClick={async () => { const r = await run("sug", () => api.get(`/api/me/mirror/suggestions?slot=${slot}`)); if (r) setSuggest(r as typeof suggest); }}><FaiIcon id={slot === "shoes" ? "ACT-35" : "ACT-34"} size={24} decorative />{miss?.action ?? "Sugerir"}</Button></li>; })}</ul>
            {data.warnings?.length ? <ul className="mt-2 type-caption text-chalk">{data.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" disabled={!data.complete} onClick={() => run("use", () => api.post("/api/me/mirror/use"), "Look do Dia registrado!")}><FaiIcon id="ACT-36" size={24} decorative />Usar este look hoje</Button>
            <Button variant="primary" disabled={worn.length === 0} onClick={() => setSaveTitle("")}><FaiIcon id="ACT-10" size={24} decorative />Salvar como look</Button>
            <Button disabled={worn.length === 0} onClick={async () => { const r = await run("draft", () => api.post("/api/me/mirror/draft", { origin: "MIRROR" })); const id = (r as { schemeId?: string })?.schemeId; if (id) window.location.href = `/schemes/${id}/edit`; }}>Abrir no editor</Button>
            <Link href="/room" className="btn"><FaiIcon id="NAV-16" size={24} decorative />{t("nav.room")}</Link>
          </div>
        </div>
      </div>
      <Dialog open={!!suggest} onClose={() => setSuggest(null)} title={`Sugestões · ${SLOT_LABEL[suggest?.slot ?? ""] ?? ""}`}>
        {suggest?.message && <p className="type-body text-muted mb-2">{suggest.message}</p>}
        <div className="grid grid-cols-3 gap-2">{(suggest?.alternatives ?? []).map((p) => <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2" onClick={() => { run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id })); setSuggest(null); }}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="aspect-square w-full object-contain" /><span className="block truncate type-caption">{p.name}</span></button>)}</div>
      </Dialog>
      <Dialog open={saveTitle !== null} onClose={() => setSaveTitle(null)} title={t("scheme.saved")} footer={<Button variant="primary" onClick={async () => { const r = await run("save", () => api.post("/api/me/mirror/save", { title: saveTitle, publish: false }), t("scheme.saved")); const id = (r as { schemeId?: string })?.schemeId; setSaveTitle(null); if (id) window.location.href = `/schemes/${id}`; }}>{t("common.save")}</Button>}>
        <Field label={t("scheme.title")} id="mtitle"><Input id="mtitle" value={saveTitle ?? ""} onChange={(e) => setSaveTitle(e.target.value)} /></Field>
      </Dialog>
      <Dialog open={!!grwm} onClose={() => setGrwm(null)} title={grwm?.title ?? "GRWM · storyboard"}>
        <ol className="list-decimal pl-5 type-body">{(grwm?.steps ?? []).map((s, i) => <li key={i} className="py-1"><b>{s.title}</b> {s.text}</li>)}</ol>
      </Dialog>
    </>
  );
}
export default function MirrorPage() { return <RequireAuth><Suspense><MirrorInner /></Suspense></RequireAuth>; }
