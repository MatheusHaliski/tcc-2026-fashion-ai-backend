"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Button, Card, Dialog, ErrorState, Field, Input, Select, Switch, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { LookScores, type LookScoreValues } from "@/components/hype/look-scores";

/*
 * Opções de vestimenta do espelho (RF28) — o MESMO painel na aba Espelho e no modo Espelho dentro do Meu Quarto
 * (QUARTO-ESPELHO: a prova abre ao se aproximar do espelho e fecha ao se afastar; nada de trocar de página).
 * Fonte única da verdade: o estado do espelho no servidor; aqui só pedidos e a apresentação.
 */
export interface MirrorPieceRef { id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; category?: string | null; subcategory?: string | null; colorHex?: string | null; addressLabel?: string | null; inMirror?: boolean }
export interface MirrorData {
  tipoLook?: TipoLook | null; slots: Record<string, MirrorPieceRef | MirrorPieceRef[] | null>; complete: boolean;
  missing?: { slot: string; action: string; message: string }[]; warnings?: string[]; prompt?: string | null; shownCount?: number;
  scores?: LookScoreValues | null; restriction?: { challenge: string } | null; postIt?: string | null; silhouette?: string | null;
  light?: { kelvin?: number } | null; rack?: unknown[];
}
export type WornEntry = { slot: string; p: MirrorPieceRef };
export const SLOT_LABEL: Record<string, string> = { get outer_layer() { return tr("common.camada_externa"); }, get upper() { return tr("common.superior"); }, get dress() { return tr("mirror.vestido"); }, get lower() { return tr("common.inferior"); }, get shoes() { return tr("mirror.calcados"); }, get accessory() { return tr("mirror.acessorios"); } };
export const wornOf = (data: MirrorData | null | undefined): WornEntry[] => Object.entries(data?.slots ?? {}).flatMap(([slot, v]) => (Array.isArray(v) ? v.map((p) => ({ slot, p })) : v ? [{ slot, p: v }] : []));

/** Pedidos ao espelho: a resposta com `slots` substitui o estado; sem ela, recarrega. `busy` é a chave do pedido em andamento. */
export function useMirrorActions<T extends MirrorData>(setData: (d: T) => void, reload: () => void) {
  const toast = useToast(); const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<T | Record<string, unknown>>, ok?: string): Promise<T | Record<string, unknown> | null> => {
    setBusy(key);
    try {
      const r = await fn();
      if ((r as T).slots) setData(r as T); else reload();
      if (ok) toast.success(ok);
      if ((r as { message?: string }).message && !(r as T).slots) toast.info(String((r as { message?: string }).message));
      return r;
    } catch (e) { toast.fromError(e); return null; } finally { setBusy(null); }
  };
  return { run, busy };
}

export function MirrorControls<T extends MirrorData>({ data, setData, reload, compact = false, children }: {
  data: T; setData: (d: T) => void; reload: () => void;
  /** dentro do quarto: sem o link para o quarto e sem o cabeçalho de página */
  compact?: boolean; children?: ReactNode;
}) {
  const { t } = useI18n(); const toast = useToast();
  const { run, busy } = useMirrorActions<T>(setData, reload);
  const tipos = useApi<TipoLook[]>((signal) => api.get("/api/tipos-look", { signal }), []);
  const [prompt, setPrompt] = useState(""); const [keep, setKeep] = useState(false);
  const [suggest, setSuggest] = useState<{ slot: string; alternatives: MirrorPieceRef[]; message?: string } | null>(null);
  // escolher à mão, do guarda-roupa (sem IA): todas as peças que podem ir para o slot
  const [pick, setPick] = useState<{ slot: string; pieces: MirrorPieceRef[]; message?: string; href?: string } | null>(null);
  const [saveTitle, setSaveTitle] = useState<string | null>(null); const [picking, setPicking] = useState(false);
  const worn = wornOf(data);
  // tipos de look fora do ar (servidor antigo, 404): a escolha some com um aviso curto — não uma "página não encontrada"
  const tiposMissing = tipos.error instanceof ApiError && (tipos.error.status === 404 || tipos.error.status === 405);
  return (
    <div className={compact ? "mirror-controls grid min-w-0 gap-2" : "mirror-controls grid min-w-0 gap-3"} data-testid="mirror-controls">
      {children}
      <Card>
        <Field id="mirror-tipo-look" label={t("lookType.label")} hint={tiposMissing ? undefined : t("lookType.hint")}>
          <Select id="mirror-tipo-look" value={data.tipoLook?.id ?? ""} disabled={tipos.loading || !!tipos.error || busy === "tipo-look"}
            onChange={(e) => run("tipo-look", () => api.put("/api/me/mirror/tipo-look", { tipoLookId: e.target.value }))}>
            <option value="" disabled>{tipos.loading ? t("common.loading") : t("lookType.select")}</option>
            {(tipos.data ?? []).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
          </Select>
        </Field>
        {tiposMissing && <p className="type-caption text-muted" role="status">{t("lookType.unavailable")}</p>}
        {tipos.error && !tiposMissing && <ErrorState error={tipos.error} onRetry={tipos.reload} />}
      </Card>
      <Card>
        <h2 className="type-h3 mb-2">{t("mirror.vista_me")}</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run("vista", () => api.post("/api/me/mirror/vista-me", { prompt, keepMirror: keep }), undefined); }}>
          <Input id="vista-prompt" aria-label={t("mirror.pedido")} className="min-w-0 flex-1 basis-56" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("mirror.ex_algo_confortavel_para_trabalhar")} />
          <Button type="submit" variant="primary" loading={busy === "vista"}><FaiIcon id="ACT-32" size={24} decorative />{t("mirror.vista_me")}</Button>
        </form>
        <Switch checked={keep} onChange={setKeep} label={t("mirror.manter_o_que_ja_esta")} />
        {data.prompt && <p className="type-caption text-muted">{t("mirror.ultimo_pedido_combinacoes_mostradas", { prompt: data.prompt, value: data.shownCount ?? 0 })}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run("another", () => api.post("/api/me/mirror/another"))} disabled={!data.prompt}>{t("mirror.outro_look")}</Button>
          {worn.map((w) => <Button key={w.p.id} size="sm" onClick={() => run("swap", () => api.post(`/api/me/mirror/slots/${w.slot}/swap`))}><FaiIcon id="ACT-34" size={24} decorative />{t("mirror.trocar", { value: SLOT_LABEL[w.slot] ?? w.slot })}</Button>)}
        </div>
      </Card>
      <Card>
        <h2 className="type-h3 mb-2">{t("mirror.slots")}</h2>
        <ul className="fai-list">{Object.entries(SLOT_LABEL).map(([slot, lbl]) => {
          const v = data.slots[slot]; const items = Array.isArray(v) ? v : v ? [v] : []; const miss = (data.missing ?? []).find((m) => m.slot === slot);
          return (
            <li key={slot} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <span className="w-28 type-label text-muted">{lbl}</span>
              <span className={compact ? "min-w-0 flex-1 type-body-sm" : "min-w-[12rem] flex-1 type-body"}>{items.length ? items.map((p) => p.name).join(", ") : <span className="text-faint">{miss?.message ?? "—"}</span>}</span>
              <span className="flex flex-wrap gap-2">
                <Button size="sm" disabled={picking} onClick={async () => { setPicking(true); try { setPick({ slot, ...(await api.get<{ pieces: MirrorPieceRef[]; message?: string; href?: string }>(`/api/me/mirror/wardrobe?slot=${slot}`)) }); } catch (e) { toast.fromError(e); } finally { setPicking(false); } }}><FaiIcon id="ACT-32" size={24} decorative />{t("mirror.do_guarda_roupa")}</Button>
                <Button size="sm" onClick={async () => { const r = await run("sug", () => api.get(`/api/me/mirror/suggestions?slot=${slot}`)); if (r) setSuggest({ slot, ...(r as { alternatives: MirrorPieceRef[]; message?: string }) }); }}><FaiIcon id={slot === "shoes" ? "ACT-35" : "ACT-34"} size={24} decorative />{miss?.action ?? t("mirror.sugerir")}</Button>
              </span>
            </li>
          );
        })}</ul>
        {data.warnings?.length ? <ul className="fai-list mt-2 type-caption text-chalk">{data.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
      </Card>
      {worn.length > 0 && data.scores && (
        <Card>
          <h2 className="type-h3 mb-2">{t("mirror.scoresTitle")}</h2>
          <LookScores scores={data.scores} />
          <p className="mt-2 type-caption text-faint">{t("mirror.scoresNote")}</p>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" disabled={!data.complete} onClick={() => run("use", () => api.post("/api/me/mirror/use"), t("mirror.look_do_dia_registrado"))}><FaiIcon id="ACT-36" size={24} decorative />{t("mirror.usar_este_look_hoje")}</Button>
        <Button variant="primary" disabled={worn.length === 0} onClick={() => setSaveTitle("")}><FaiIcon id="ACT-10" size={24} decorative />{t("common.salvar_como_look")}</Button>
        <Button disabled={worn.length === 0} onClick={async () => { const r = await run("draft", () => api.post("/api/me/mirror/draft", { origin: "MIRROR" })); const id = (r as { schemeId?: string } | null)?.schemeId; if (id) window.location.href = `/schemes/${id}/edit`; }}>{t("mirror.abrir_no_editor")}</Button>
        {!compact && <Link href="/room" className="btn"><FaiIcon id="NAV-16" size={24} decorative />{t("nav.room")}</Link>}
      </div>
      <Dialog open={!!pick} onClose={() => setPick(null)} title={t("mirror.escolher_do_guarda_roupa", { value: SLOT_LABEL[pick?.slot ?? ""] ?? "" })}>
        {pick?.message && <p className="type-body text-muted mb-2">{pick.message} {pick.href && <Link href={pick.href} className="underline">{t("mirror.adicionar_peca")}</Link>}</p>}
        <div className="grid grid-cols-3 gap-2" data-testid="mirror-wardrobe-picker">{(pick?.pieces ?? []).map((p) => (
          <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2 disabled:opacity-60" disabled={p.inMirror} aria-pressed={p.inMirror}
            onClick={() => { run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id }), t("room.peca_no_espelho")); setPick(null); }}>
            <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl ?? undefined)} alt="" className="aspect-square w-full object-contain" />
            <span className="block truncate type-caption">{p.name}</span>
            {p.inMirror ? <span className="block type-caption text-muted">{t("mirror.ja_no_espelho")}</span> : p.addressLabel && <span className="block truncate type-caption text-faint">{p.addressLabel}</span>}
          </button>))}</div>
      </Dialog>
      <Dialog open={!!suggest} onClose={() => setSuggest(null)} title={t("mirror.sugestoes", { value: SLOT_LABEL[suggest?.slot ?? ""] ?? "" })}>
        {suggest?.message && <p className="type-body text-muted mb-2">{suggest.message}</p>}
        <div className="grid grid-cols-3 gap-2">{(suggest?.alternatives ?? []).map((p) => (
          <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2" onClick={() => { run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id })); setSuggest(null); }}>
            <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl ?? undefined)} alt="" className="aspect-square w-full object-contain" />
            <span className="block truncate type-caption">{p.name}</span>
          </button>))}</div>
      </Dialog>
      <Dialog open={saveTitle !== null} onClose={() => setSaveTitle(null)} title={t("scheme.saved")}
        footer={<Button variant="primary" onClick={async () => { const r = await run("save", () => api.post("/api/me/mirror/save", { title: saveTitle, publish: false }), t("scheme.saved")); const id = (r as { schemeId?: string } | null)?.schemeId; setSaveTitle(null); if (id) window.location.href = `/schemes/${id}`; }}>{t("common.save")}</Button>}>
        <Field label={t("scheme.title")} id="mtitle"><Input id="mtitle" value={saveTitle ?? ""} onChange={(e) => setSaveTitle(e.target.value)} /></Field>
      </Dialog>
    </div>
  );
}
