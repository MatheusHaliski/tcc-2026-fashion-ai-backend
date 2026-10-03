"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MirrorStage, MirrorWornStrip } from "@/components/mirror/mirror-stage";

interface MPiece { id: string; name: string; imageUrl?: string; thumbnailUrl?: string; category?: string; subcategory?: string; color?: string; colorHex?: string; addressLabel?: string; }
interface State { slots: Record<string, MPiece | MPiece[] | null>; complete: boolean; missing: { slot: string; action: string; message: string }[]; warnings?: string[]; origin?: string; prompt?: string | null; interpretation?: Record<string, unknown> | null; actions?: string[]; silhouette?: string | null; postIt?: string | null; light?: { kelvin: number; label?: string }; restriction?: { challenge: string } | null; shownCount?: number; }
const SLOT_LABEL: Record<string, string> = { get outer_layer() { return tr("common.camada_externa"); }, get upper() { return tr("common.superior"); }, get dress() { return tr("mirror.vestido"); }, get lower() { return tr("common.inferior"); }, get shoes() { return tr("mirror.calcados"); }, get accessory() { return tr("mirror.acessorios"); } };

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
      <PageHeader title={t("nav.mirror")} kicker="RF28" lead={data.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: data.restriction.challenge }) : t("mirror.monte_o_look_no_espelho")} />
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <Card pad={false} className="min-w-0 overflow-hidden">
          <div className="p-3"><MirrorStage slots={data.slots} kelvin={data.light?.kelvin}>
            {worn.length === 0 && (
              <div className="mirror-empty">
                <p className="type-h3">{t("mirror.emptyTitle")}</p>
                <p className="type-body-sm mt-1 text-muted">{t("mirror.emptyHint")}</p>
                <Button size="sm" variant="primary" className="mt-3" onClick={() => document.getElementById("vista-prompt")?.focus()}>{t("mirror.askVistaMe")}</Button>
              </div>
            )}
            {data.postIt && <p className="absolute right-3 top-3 max-w-[150px] rotate-2 bg-chalk-soft p-2 text-xs shadow" role="note">📌 {data.postIt}</p>}
            {data.silhouette && <p className="absolute bottom-3 left-3 type-caption text-muted">{t("mirror.silhueta", { silhouette: data.silhouette })}</p>}
          </MirrorStage></div>
          <div className="px-3 pt-3"><MirrorWornStrip worn={worn} onRemove={(p) => run("rm", () => api.delete(`/api/me/mirror/pieces/${p.id}`))} /></div>
          <div className="flex flex-wrap gap-2 p-3">
            <Button size="sm" onClick={() => run("clear", () => api.delete("/api/me/mirror"))}>{t("common.limpar")}</Button>
            <Button size="sm" onClick={() => run("one", () => api.post("/api/me/mirror/take-one-off"), t("mirror.tirei_uma_coisa"))} disabled={worn.length < 2}><FaiIcon id="ACT-33" size={24} decorative />{t("mirror.tira_uma_coisa")}</Button>
            <Button size="sm" onClick={async () => { const r = await run("grwm", () => api.get("/api/me/mirror/grwm")); if (r) setGrwm(r as typeof grwm); }} disabled={!data.complete}>GRWM</Button>
          </div>
        </Card>
        <div className="grid min-w-0 gap-3">
          <Card>
            <h2 className="type-h3 mb-2">{t("mirror.vista_me")}</h2>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run("vista", () => api.post("/api/me/mirror/vista-me", { prompt, keepMirror: keep }), undefined); }}>
              <Input id="vista-prompt" aria-label={t("mirror.pedido")} className="min-w-0 flex-1 basis-56" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("mirror.ex_algo_confortavel_para_trabalhar")} />
              <Button type="submit" variant="primary" loading={busy === "vista"}><FaiIcon id="ACT-32" size={24} decorative />{t("mirror.vista_me")}</Button>
            </form>
            <Switch checked={keep} onChange={setKeep} label={t("mirror.manter_o_que_ja_esta")} />
            {data.prompt && <p className="type-caption text-muted">{t("mirror.ultimo_pedido_combinacoes_mostradas", { prompt: data.prompt, value: data.shownCount ?? 0 })}</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => run("another", () => api.post("/api/me/mirror/another"))} disabled={!data.prompt}>{t("mirror.outro_look")}</Button>{worn.map((w) => <Button key={w.p.id} size="sm" onClick={() => run("swap", () => api.post(`/api/me/mirror/slots/${w.slot}/swap`))}><FaiIcon id="ACT-34" size={24} decorative />{t("mirror.trocar", { value: SLOT_LABEL[w.slot] ?? w.slot })}</Button>)}</div>
          </Card>
          <Card>
            <h2 className="type-h3 mb-2">{t("mirror.slots")}</h2>
            <ul className="fai-list">{Object.entries(SLOT_LABEL).map(([slot, lbl]) => { const v = data.slots[slot]; const items = Array.isArray(v) ? v : v ? [v] : []; const miss = data.missing.find((m) => m.slot === slot); return <li key={slot} className="flex items-center gap-3 py-2"><span className="w-28 type-label text-muted">{lbl}</span><span className="flex-1 type-body">{items.length ? items.map((p) => p.name).join(", ") : <span className="text-faint">{miss?.message ?? "—"}</span>}</span><Button size="sm" onClick={async () => { const r = await run("sug", () => api.get(`/api/me/mirror/suggestions?slot=${slot}`)); if (r) setSuggest(r as typeof suggest); }}><FaiIcon id={slot === "shoes" ? "ACT-35" : "ACT-34"} size={24} decorative />{miss?.action ?? t("mirror.sugerir")}</Button></li>; })}</ul>
            {data.warnings?.length ? <ul className="fai-list mt-2 type-caption text-chalk">{data.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" disabled={!data.complete} onClick={() => run("use", () => api.post("/api/me/mirror/use"), t("mirror.look_do_dia_registrado"))}><FaiIcon id="ACT-36" size={24} decorative />{t("mirror.usar_este_look_hoje")}</Button>
            <Button variant="primary" disabled={worn.length === 0} onClick={() => setSaveTitle("")}><FaiIcon id="ACT-10" size={24} decorative />{t("common.salvar_como_look")}</Button>
            <Button disabled={worn.length === 0} onClick={async () => { const r = await run("draft", () => api.post("/api/me/mirror/draft", { origin: "MIRROR" })); const id = (r as { schemeId?: string })?.schemeId; if (id) window.location.href = `/schemes/${id}/edit`; }}>{t("mirror.abrir_no_editor")}</Button>
            <Link href="/room" className="btn"><FaiIcon id="NAV-16" size={24} decorative />{t("nav.room")}</Link>
          </div>
        </div>
      </div>
      <Dialog open={!!suggest} onClose={() => setSuggest(null)} title={t("mirror.sugestoes", { value: SLOT_LABEL[suggest?.slot ?? ""] ?? "" })}>
        {suggest?.message && <p className="type-body text-muted mb-2">{suggest.message}</p>}
        <div className="grid grid-cols-3 gap-2">{(suggest?.alternatives ?? []).map((p) => <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2" onClick={() => { run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id })); setSuggest(null); }}><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="aspect-square w-full object-contain" /><span className="block truncate type-caption">{p.name}</span></button>)}</div>
      </Dialog>
      <Dialog open={saveTitle !== null} onClose={() => setSaveTitle(null)} title={t("scheme.saved")} footer={<Button variant="primary" onClick={async () => { const r = await run("save", () => api.post("/api/me/mirror/save", { title: saveTitle, publish: false }), t("scheme.saved")); const id = (r as { schemeId?: string })?.schemeId; setSaveTitle(null); if (id) window.location.href = `/schemes/${id}`; }}>{t("common.save")}</Button>}>
        <Field label={t("scheme.title")} id="mtitle"><Input id="mtitle" value={saveTitle ?? ""} onChange={(e) => setSaveTitle(e.target.value)} /></Field>
      </Dialog>
      <Dialog open={!!grwm} onClose={() => setGrwm(null)} title={grwm?.title ?? t("mirror.grwm_storyboard")}>
        <ol className="fai-list type-body">{(grwm?.steps ?? []).map((s, i) => <li key={i} className="py-1"><b>{s.title}</b> {s.text}</li>)}</ol>
      </Dialog>
    </>
  );
}
export default function MirrorPage() { return <RequireAuth><Suspense><MirrorInner /></Suspense></RequireAuth>; }
