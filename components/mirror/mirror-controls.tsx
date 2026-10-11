"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Badge, Button, Card, Chip, Dialog, ErrorState, cn, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";
import { LookScores, type LookScoreValues } from "@/components/hype/look-scores";
import { assetStateOf } from "@/lib/room3d/mirror-session";
import type { Illustration } from "@/lib/capture/capture-guides";
import { VistaMeCells } from "@/components/mirror/vista-me-cells";
import { MirrorPartSheet } from "@/components/mirror/mirror-part-sheet";

/*
 * Espelho (RF28) — o painel da prova dentro do Meu Quarto (e da vista embutida no 2.5D): só botões, células e listas,
 * nada de formulário. O estado é o do servidor (/api/me/mirror); aqui ficam os pedidos e a apresentação.
 *  - "Para quem é o look": chips (radiogroup) com os tipos do banco.
 *  - "Partes do look": a grade de células do Provador (Parte de cima, Peça única, Parte de baixo, Calçado, Acessório). A
 *    camada externa do servidor (jaqueta, blazer…) entra na Parte de cima — não existe "Camada externa" na tela.
 *    Tocar numa célula abre a folha da parte: vestindo agora, lista do espelho, guarda-roupa e sugestões.
 *  - Vista-me: células de ocasião + humor/clima opcionais; peças fixadas ("Manter") viram âncoras.
 *  - Ações: usar hoje, salvar (um toque), abrir no editor, provar no Provador, tira uma coisa, GRWM e limpar (desfazíveis).
 */
export interface MirrorPieceRef {
  id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; category?: string | null; subcategory?: string | null; colorHex?: string | null;
  addressLabel?: string | null; moduleId?: string | null; inMirror?: boolean; model3dUrl?: string | null; model3dStatus?: string | null; photoProcessingStatus?: string | null;
  available?: boolean; slot?: string | null; worn?: boolean; why?: string | null;
}
export interface MirrorSequenceStep { pieceId: string; name: string; moduleId?: string | null; legend: string }
export interface MirrorData {
  tipoLook?: TipoLook | null; slots: Record<string, MirrorPieceRef | MirrorPieceRef[] | null>; complete: boolean;
  missing?: { slot: string; action: string; message: string }[]; warnings?: string[]; prompt?: string | null; shownCount?: number;
  scores?: LookScoreValues | null; restriction?: { challenge: string; allowed?: number } | null; postIt?: string | null;
  silhouette?: { letter?: string; rule?: string } | string | null; light?: { kelvin?: number } | null; rack?: MirrorPieceRef[];
  origin?: string | null; actions?: string[]; interpretation?: { anchors?: string[] | null } | null;
  /** extras da resposta do Vista-me / Outra sugestão */
  sequence?: MirrorSequenceStep[]; fallbackMessage?: string | null; challengeNotice?: string | null; message?: string | null;
}
export type WornEntry = { slot: string; p: MirrorPieceRef };
export const wornOf = (data: MirrorData | null | undefined): WornEntry[] => Object.entries(data?.slots ?? {}).flatMap(([slot, v]) => (Array.isArray(v) ? v.map((p) => ({ slot, p })) : v ? [{ slot, p: v }] : []));
const asList = (v: MirrorPieceRef | MirrorPieceRef[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** As cinco partes do look, no vocabulário do Provador e do quarto (room.mirror.slot.*). */
export interface MirrorPart { id: string; slots: string[]; label: string; glyph: Illustration; suggest: string; max?: number }
export const MIRROR_PARTS: MirrorPart[] = [
  { id: "top", slots: ["upper", "outer_layer"], label: "room.mirror.slot.upper", glyph: "tshirt", suggest: "upper" },
  { id: "dress", slots: ["dress"], label: "room.mirror.slot.dress", glyph: "dress", suggest: "dress" },
  { id: "lower", slots: ["lower"], label: "room.mirror.slot.lower", glyph: "pants_back", suggest: "lower" },
  { id: "shoes", slots: ["shoes"], label: "room.mirror.slot.shoes", glyph: "sneaker_side", suggest: "shoes" },
  { id: "accessory", slots: ["accessory"], label: "room.mirror.slot.accessory", glyph: "bag", suggest: "accessory", max: 4 },
];
export const partOfSlot = (slot?: string | null) => MIRROR_PARTS.find((p) => p.slots.includes(slot ?? "")) ?? null;

/** Pedidos ao espelho: a resposta com `slots` substitui o estado; sem ela, recarrega. `busy` é a chave do pedido em andamento. */
export function useMirrorActions<T extends MirrorData>(setData: (d: T) => void, reload: () => void) {
  const toast = useToast(); const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<T | Record<string, unknown>>, ok?: string): Promise<T | Record<string, unknown> | null> => {
    setBusy(key);
    try {
      const r = await fn();
      if ((r as T).slots) setData(r as T); else reload();
      if (ok) toast.success(ok);
      else if ((r as { message?: string }).message && !(r as T).slots) toast.info(String((r as { message?: string }).message));
      return r;
    } catch (e) { toast.fromError(e); return null; } finally { setBusy(null); }
  };
  return { run, busy };
}

/** Ações que o quarto faz do jeito dele (reação do avatar, luz nas portas, fecho do look); fora do quarto, o padrão. */
export interface MirrorHost {
  wear?: (p: MirrorPieceRef) => Promise<unknown> | void;
  takeOff?: (p: MirrorPieceRef) => Promise<unknown> | void;
  unlist?: (p: MirrorPieceRef) => Promise<unknown> | void;
  /** "Mostrar no quarto" dentro do quarto (enquadra a posição); fora dele vira link /room?piece= */
  showInRoom?: (p: MirrorPieceRef) => void;
  /** resposta do Vista-me / Outra sugestão (o quarto acende as portas da sequência) */
  onVista?: (r: MirrorData) => void;
  /** "Usar este look hoje" com o fecho do quarto */
  use?: () => Promise<unknown> | void;
}
type Notice = { text: string; actions?: { label: string; href?: string; onClick?: () => void }[] };
const ASSET_TONE = { PENDING: "mark", IMAGE_2D: "chalk", MOULD_3D: undefined, MODEL_3D: "thread" } as const;

export function MirrorControls<T extends MirrorData>({ data, setData, reload, compact = false, children, host, preview2d }: {
  data: T; setData: (d: T) => void; reload: () => void;
  /** dentro do quarto (coluna estreita ao lado da cena) */
  compact?: boolean;
  /** topo do painel (prévia 2D, palco) */
  children?: ReactNode;
  host?: MirrorHost;
  /** botão da prévia 2D (onde ela faz sentido) */
  preview2d?: { shown: boolean; onToggle: () => void };
}) {
  const { t } = useI18n(); const toast = useToast();
  const { run, busy } = useMirrorActions<T>(setData, reload);
  const tipos = useApi<TipoLook[]>((signal) => api.get("/api/tipos-look", { signal }), []);
  const [open, setOpen] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(() => new Set((data.interpretation?.anchors ?? []).map(String)));
  const [extras, setExtras] = useState<Pick<MirrorData, "sequence" | "fallbackMessage" | "challengeNotice" | "message"> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [grwm, setGrwm] = useState<{ steps?: { imageUrl?: string | null; caption?: string; pieceId?: string; at?: number }[]; totalMs?: number } | null>(null);
  const worn = wornOf(data);
  const wornIds = new Set(worn.map((w) => w.p.id));
  // peça que saiu do corpo deixa de ser âncora
  useEffect(() => { setPinned((s) => { const n = new Set([...s].filter((id) => wornIds.has(id))); return n.size === s.size ? s : n; }); }, [data.slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiposMissing = tipos.error instanceof ApiError && (tipos.error.status === 404 || tipos.error.status === 405);
  const dressOn = asList(data.slots.dress).length > 0;
  const restore = async (ids: string[]) => { for (const id of ids) await run("restore", () => api.post("/api/me/mirror/pieces", { pieceId: id })); setNotice(null); };

  async function vista(path: "vista-me" | "another", prompt?: string) {
    const anchorIds = [...pinned].filter((id) => wornIds.has(id));
    const r = await run("vista", () => api.post(`/api/me/mirror/${path}`, path === "vista-me" ? { prompt: prompt ?? "", anchorIds } : undefined));
    if (r && (r as T).slots) { const x = r as T; setExtras({ sequence: x.sequence, fallbackMessage: x.fallbackMessage, challengeNotice: x.challengeNotice, message: x.message }); host?.onVista?.(x); }
  }
  async function use() {
    if (host?.use) { await host.use(); return; }
    try { const r = await api.post<{ message?: string }>("/api/me/mirror/use"); toast.success(r.message ?? t("mirror.look_do_dia_registrado")); reload(); } catch (e) { toast.fromError(e); }
  }
  async function save() {
    try {
      const r = await api.post<{ schemeId: string; title: string }>("/api/me/mirror/save", { publish: false });
      setNotice({ text: t("mirror.salvo_como", { title: r.title }), actions: [{ label: t("mirror.ver_look"), href: `/schemes/${r.schemeId}` }, { label: t("mirror.renomear"), href: `/schemes/${r.schemeId}/edit` }] });
    } catch (e) { toast.fromError(e); }
  }
  async function takeOneOff() {
    const r = await run("one", () => api.post("/api/me/mirror/take-one-off")) as (T & { removed?: MirrorPieceRef; why?: string }) | null;
    if (r?.removed) { const id = r.removed.id; setNotice({ text: t("mirror.tirei", { name: r.removed.name, why: r.why ?? "" }).trim(), actions: [{ label: t("mirror.desfazer"), onClick: () => void restore([id]) }] }); }
  }
  async function clear() {
    const ids = worn.map((w) => w.p.id);
    const r = await run("clear", () => api.delete("/api/me/mirror"));
    if (r) setNotice({ text: t("mirror.espelho_limpo"), actions: ids.length ? [{ label: t("mirror.desfazer"), onClick: () => void restore(ids) }] : undefined });
  }
  const silhouette = typeof data.silhouette === "object" && data.silhouette?.letter ? data.silhouette : null;
  const provar = worn.slice(0, 8).map((w) => `w.${w.p.id}`).join(",");
  const part = MIRROR_PARTS.find((p) => p.id === open) ?? null;

  return (
    <div className={cn("mirror-controls grid min-w-0", compact ? "gap-2" : "gap-3")} data-testid="mirror-controls">
      <div className="mirror-head">
        <h2 className="type-h3">{t("nav.mirror")}</h2>
        {silhouette && <span className="mirror-silhouette" title={silhouette.rule}><b>{silhouette.letter}</b><span>{silhouette.rule}</span></span>}
        <span className="mirror-head-actions">
          {preview2d && <Button size="sm" aria-pressed={preview2d.shown} onClick={preview2d.onToggle}>{t("mirror.previa_2d")}</Button>}
          <Button size="sm" variant="ghost" disabled={worn.length === 0 || busy === "clear"} onClick={() => void clear()}>{t("mirror.limpar_espelho")}</Button>
        </span>
      </div>
      {data.restriction && <p className="mirror-banner" role="note"><FaiIcon id="ACT-37" size={20} className="ico-text" decorative />{t("mirror.desafio_banner", { challenge: data.restriction.challenge, n: data.restriction.allowed ?? 0 })}</p>}
      {children}
      {notice && (
        <div className="mirror-notice" role="status">
          <span>{notice.text}</span>
          {notice.actions?.map((a) => a.href ? <Link key={a.label} href={a.href} className="btn btn-sm">{a.label}</Link> : <Button key={a.label} size="sm" onClick={a.onClick}>{a.label}</Button>)}
          <button type="button" className="btn btn-ghost btn-sm" aria-label={t("common.fechar")} onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <section className="mirror-section" aria-labelledby="mirror-parts-h">
        <h3 id="mirror-parts-h" className="mirror-section-h">{t("mirror.slots")}</h3>
        <div className="fitting-stores mirror-parts" role="group" aria-labelledby="mirror-parts-h">
          {MIRROR_PARTS.map((p) => {
            const pieces = p.slots.flatMap((s) => asList(data.slots[s]));
            const label = t(p.label);
            const missing = (data.missing ?? []).some((m) => m.slot === (p.id === "top" ? "upper" : p.suggest)) && pieces.length === 0;
            const covered = !pieces.length && dressOn && (p.id === "top" || p.id === "lower");
            const caption = pieces.length
              ? (p.max ? t("mirror.parte.n_de", { n: pieces.length, max: p.max }) : pieces.map((x) => x.name).join(" + "))
              : covered ? t("mirror.parte.coberto") : missing ? t("mirror.parte.falta") : t("mirror.parte.vazio");
            const asset = pieces[0] ? assetStateOf(pieces[0]) : null;
            const unavailable = pieces.some((x) => x.available === false);
            const pin = pieces.some((x) => pinned.has(x.id));
            return (
              <button key={p.id} type="button" className={cn("fitting-store mirror-part", open === p.id && "is-active", missing && "is-missing", !pieces.length && "is-empty")}
                aria-haspopup="dialog" aria-label={t("mirror.parte.aria", { part: label, value: pieces.length ? pieces.map((x) => x.name).join(", ") : caption })} onClick={() => setOpen(p.id)}>
                <span className="mirror-part-art" aria-hidden>
                  {pieces.length ? pieces.slice(0, 2).map((x) => <img key={x.id} src={mediaUrl(x.thumbnailUrl ?? x.imageUrl ?? undefined)} alt="" style={{ background: x.colorHex ?? undefined }} />)
                    : <GarmentGlyph id={p.glyph} size={36} animated={false} numbered={false} />}
                </span>
                <span className="fitting-store-name">{label}</span>
                <span className="mirror-part-caption">{caption}</span>
                {(asset || unavailable || pin) && (
                  <span className="mirror-part-badges">
                    {asset && <Badge tone={ASSET_TONE[asset]}>{t(`room.mirror.asset_curto.${asset}`)}</Badge>}
                    {unavailable && <Badge tone="mark">⚠ {t("mirror.parte.indisponivel")}</Badge>}
                    {pin && <Badge>📌 {t("mirror.parte.fixada")}</Badge>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {data.warnings?.length ? <ul className="mirror-warnings">{data.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
      </section>

      <section className="mirror-section" aria-labelledby="mirror-tipo-h">
        <h3 id="mirror-tipo-h" className="mirror-section-h">{t("mirror.para_quem")}</h3>
        {tiposMissing ? <p className="type-body-sm text-muted" role="status">{t("lookType.unavailable")}</p>
          : tipos.error ? <ErrorState error={tipos.error} onRetry={tipos.reload} />
          : (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="mirror-tipo-h">
              {(tipos.data ?? []).map((tipo) => (
                <Chip key={tipo.id} role="radio" aria-checked={data.tipoLook?.id === tipo.id} disabled={busy === "tipo-look"}
                  onClick={() => { if (data.tipoLook?.id !== tipo.id) void run("tipo-look", () => api.put("/api/me/mirror/tipo-look", { tipoLookId: tipo.id })); }}>{tipo.nome}</Chip>
              ))}
            </div>
          )}
      </section>

      <section className="mirror-section" aria-labelledby="mirror-vista-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="mirror-vista-h" className="mirror-section-h">{t("mirror.vista_me")}</h3>
          <Button size="sm" disabled={data.origin !== "vista_me" || busy === "vista"} onClick={() => void vista("another")}>{t("room.outra_sugestao")}</Button>
        </div>
        <VistaMeCells busy={busy === "vista"} lastPrompt={data.prompt} pinnedCount={[...pinned].filter((id) => wornIds.has(id)).length} onRun={(prompt) => void vista("vista-me", prompt)} />
        {extras && (extras.message || extras.fallbackMessage || extras.challengeNotice || extras.sequence?.length) ? (
          <div className="mirror-vista-result" role="status">
            {extras.message && <p className="type-body-sm">{extras.message}</p>}
            {extras.sequence?.length ? <ol className="mirror-sequence">{extras.sequence.map((s) => <li key={s.pieceId}>{s.legend}</li>)}</ol> : null}
            {extras.fallbackMessage && <p className="type-body-sm text-muted">{extras.fallbackMessage}</p>}
            {extras.challengeNotice && <p className="type-body-sm text-muted">{extras.challengeNotice}</p>}
          </div>
        ) : data.prompt ? <p className="type-body-sm text-muted">{t("mirror.ultimo_pedido_combinacoes_mostradas", { prompt: data.prompt, value: data.shownCount ?? 0 })}</p> : null}
      </section>

      {worn.length > 0 && data.scores && (
        <Card>
          <h3 className="mirror-section-h mb-2">{t("mirror.scoresTitle")}</h3>
          <LookScores scores={data.scores} />
          <p className="mt-2 type-body-sm text-muted">{t("mirror.scoresNote")}</p>
        </Card>
      )}

      <div className="mirror-actions">
        <Button variant="accent" disabled={!data.complete} onClick={() => void use()}><FaiIcon id="ACT-36" size={20} className="ico-text" decorative />{t("mirror.usar_este_look_hoje")}</Button>
        <Button variant="primary" disabled={worn.length < 2} onClick={() => void save()}><FaiIcon id="ACT-10" size={20} className="ico-text" decorative />{t("mirror.salvar_look")}</Button>
        {worn.length ? <Link href={`/schemes/new?pieces=${worn.map((w) => encodeURIComponent(w.p.id)).join(",")}`} className="btn">{t("mirror.abrir_no_editor")}</Link> : <Button disabled>{t("mirror.abrir_no_editor")}</Button>}
        {worn.length ? <Link href={`/try-on?provar=${provar}`} className="btn"><FaiIcon id="NAV-07" size={20} className="ico-text" decorative />{t("mirror.provar_look_no_provador")}</Link> : <Button disabled>{t("mirror.provar_look_no_provador")}</Button>}
        <Button disabled={!data.actions?.includes("TIRA_UMA_COISA") || busy === "one"} onClick={() => void takeOneOff()}><FaiIcon id="ACT-33" size={20} className="ico-text" decorative />{t("mirror.tira_uma_coisa")}</Button>
        <Button disabled={worn.length === 0 || busy === "grwm"} onClick={async () => { const r = await run("grwm", () => api.get("/api/me/mirror/grwm")); if (r) setGrwm(r as typeof grwm); }}>{t("mirror.grwm")}</Button>
      </div>

      {part && (
        <MirrorPartSheet part={part} data={data} pinned={pinned} busy={busy} onClose={() => setOpen(null)}
          onTogglePin={(id) => setPinned((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          wear={async (p) => { if (host?.wear) await host.wear(p); else { const r = await run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id })) as { notice?: string } | null; if (r?.notice) toast.info(r.notice); } }}
          takeOff={async (p) => { if (host?.takeOff) await host.takeOff(p); else await run("rm", () => api.delete(`/api/me/mirror/pieces/${encodeURIComponent(p.id)}`)); }}
          unlist={async (p) => { if (host?.unlist) await host.unlist(p); else await run("unlist", () => api.delete(`/api/me/mirror/rack/${encodeURIComponent(p.id)}`)); }}
          showInRoom={host?.showInRoom ? (p) => { setOpen(null); host.showInRoom!(p); } : undefined} />
      )}
      <Dialog open={!!grwm} onClose={() => setGrwm(null)} title={t("mirror.grwm_storyboard")} size="lg">
        <ol className="mirror-grwm" aria-label={t("mirror.grwm_storyboard")}>
          {(grwm?.steps ?? []).map((s, i) => (
            <li key={i} className="mirror-grwm-card">
              {s.imageUrl && s.imageUrl !== "null" ? <img src={mediaUrl(s.imageUrl)} alt="" /> : <span className="mirror-grwm-end" aria-hidden>✨</span>}
              <span className="mirror-grwm-n">{i + 1}</span>
              <p>{s.caption}</p>
            </li>
          ))}
        </ol>
      </Dialog>
    </div>
  );
}
