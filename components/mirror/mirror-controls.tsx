"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Card, cn, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { LookScores } from "@/components/hype/look-scores";
import { MirrorVistaSection } from "@/components/mirror/mirror-vista-section";
import { MirrorLookType } from "@/components/mirror/mirror-look-type";
import { MirrorPartSheet } from "@/components/mirror/mirror-part-sheet";
import { MirrorPartsGrid } from "@/components/mirror/mirror-parts-grid";
import { canTakeOneOff, inHandOf, isCatalogPiece, MIRROR_PARTS, ownedOf, tryOnRef, wornOf, type MirrorData, type MirrorPieceRef } from "@/lib/mirror/mirror-model";
export { canTakeOneOff, inHandOf, MIRROR_PARTS, partOfSlot, wornOf } from "@/lib/mirror/mirror-model";
export type { MirrorData, MirrorPart, MirrorPieceRef, MirrorSequenceStep, WornEntry } from "@/lib/mirror/mirror-model";

/*
 * Espelho (RF28) — o painel da prova em /mirror (e da vista embutida no 2.5D): só botões, células e listas,
 * nada de formulário. O estado é o do servidor (/api/me/mirror); aqui ficam os pedidos e a apresentação.
 *  - "Para quem é o look": chips (radiogroup) com os tipos do banco.
 *  - "Partes do look": a grade de células do Provador (Parte de cima, Peça única, Parte de baixo, Calçado, Acessório). A
 *    camada externa do servidor (jaqueta, blazer…) entra na Parte de cima — não existe "Camada externa" na tela.
 *    Tocar numa célula abre a folha da parte: vestindo agora, roupas em mãos (a lista do espelho e a peça na mão),
 *    guarda-roupa e sugestões. As roupas em mãos só aparecem aqui (a célula conta quantas há).
 *  - Vista-me (MirrorVistaSection; em /mirror fica no painel próprio): nível térmico, ocasiões + humor/clima, âncoras.
 *  - Ações: usar hoje, salvar (um toque), abrir no editor, provar no Provador, tira uma coisa e limpar (desfazíveis).
 */
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

/**
 * Peças fixadas ("Manter") — âncoras do Vista-me. Vivem em quem usa o painel: o quarto as guarda para o Vista-me da
 * barra da cena e para quando a prova fecha e reabre. Começam pelas âncoras do último pedido; a peça que sai do corpo
 * deixa de ser âncora.
 */
export function useMirrorPins(data: MirrorData | null | undefined) {
  const [pinned, setPinned] = useState<Set<string>>(() => new Set((data?.interpretation?.anchors ?? []).map(String)));
  const seeded = useRef(!!data);
  const wornIds = new Set(wornOf(data).map((w) => w.p.id));
  useEffect(() => {
    if (!data) return;
    if (!seeded.current) { seeded.current = true; setPinned(new Set((data.interpretation?.anchors ?? []).map(String).filter((id) => wornIds.has(id)))); return; }
    setPinned((s) => { const n = new Set([...s].filter((id) => wornIds.has(id))); return n.size === s.size ? s : n; });
  }, [data?.slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setPinned((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /** âncoras para o pedido: só as fixadas que continuam vestidas */
  const anchorIds = () => [...pinned].filter((id) => wornIds.has(id));
  return { pinned, setPinned, toggle, anchorIds };
}
export type MirrorPins = ReturnType<typeof useMirrorPins>;

/**
 * Pedido do Vista-me ou de Outra sugestão com as fixadas de agora. /another repete as âncoras do pedido anterior (o
 * servidor não recebe corpo); se a pessoa fixou ou soltou peças depois, vai o mesmo pedido ao /vista-me com as âncoras
 * novas — as combinações já mostradas continuam de fora do mesmo jeito.
 */
/** Ações que uma tela anfitriã pode fazer do jeito dela (era o Meu Quarto, retirado em 15/11/2026); sem anfitrião, o padrão. */
export interface MirrorHost {
  wear?: (p: MirrorPieceRef) => Promise<unknown> | void;
  takeOff?: (p: MirrorPieceRef) => Promise<unknown> | void;
  unlist?: (p: MirrorPieceRef) => Promise<unknown> | void;
  /** resposta do Vista-me / Outra sugestão */
  onVista?: (r: MirrorData) => void;
  /** "Usar este look hoje" com o fecho do anfitrião */
  use?: () => Promise<unknown> | void;
}
type Notice = { text: string; actions?: { label: string; href?: string; onClick?: () => void }[] };

export function MirrorControls<T extends MirrorData>({ data, setData, reload, compact = false, children, host, preview2d, held, arrivedId, pins, vista = true }: {
  data: T; setData: (d: T) => void; reload: () => void;
  /** dentro do quarto (coluna estreita ao lado da cena) */
  compact?: boolean;
  /** topo do painel (prévia 2D, palco) */
  children?: ReactNode;
  host?: MirrorHost;
  /** botão da prévia 2D (onde ela faz sentido) */
  preview2d?: { shown: boolean; onToggle: () => void };
  /** peça segurada pelo personagem no quarto (ainda fora da lista do espelho): entra nas roupas em mãos da parte */
  held?: MirrorPieceRef[];
  /** peça que acabou de chegar ao espelho: a célula da parte fica em destaque */
  arrivedId?: string | null;
  /** peças fixadas guardadas por quem usa o painel (o quarto); sem isto, o painel guarda as suas */
  pins?: MirrorPins;
  /** false: o Vista-me não entra aqui (em /mirror ele tem o próprio painel lateral) */
  vista?: boolean;
}) {
  const { t } = useI18n(); const toast = useToast();
  const { run, busy } = useMirrorActions<T>(setData, reload);
  const [open, setOpen] = useState<string | null>(null);
  const ownPins = useMirrorPins(data);
  const { pinned, toggle: togglePin, anchorIds } = pins ?? ownPins;
  const [notice, setNotice] = useState<Notice | null>(null);
  const worn = wornOf(data);
  const owned = ownedOf(data);
  const putOn = (p: MirrorPieceRef) => (isCatalogPiece(p) ? api.post<T>("/api/me/mirror/catalog", { productId: p.productId }) : api.post<T>("/api/me/mirror/pieces", { pieceId: p.id }));
  const restore = async (pieces: MirrorPieceRef[]) => { for (const p of pieces) await run("restore", () => putOn(p)); setNotice(null); };

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
    if (r?.removed) { const removed = r.removed; setNotice({ text: t("mirror.tirei", { name: removed.name, why: r.why ?? "" }).trim(), actions: [{ label: t("mirror.desfazer"), onClick: () => void restore([removed]) }] }); }
  }
  async function clear() {
    const pieces = worn.map((w) => w.p);
    const r = await run("clear", () => api.delete("/api/me/mirror"));
    if (r) setNotice({ text: t("mirror.espelho_limpo"), actions: pieces.length ? [{ label: t("mirror.desfazer"), onClick: () => void restore(pieces) }] : undefined });
  }
  const silhouette = typeof data.silhouette === "object" && data.silhouette?.letter ? data.silhouette : null;
  const provar = worn.slice(0, 8).map((w) => tryOnRef(w.p)).join(",");
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

      <MirrorPartsGrid data={data} held={held} arrivedId={arrivedId} pinned={pinned} open={open} onOpen={setOpen} />

      <MirrorLookType currentId={data.tipoLook?.id} busy={busy === "tipo-look"}
        onChoose={(tipoLookId) => void run("tipo-look", () => api.put("/api/me/mirror/tipo-look", { tipoLookId }))} />

      {vista && <MirrorVistaSection data={data} busy={busy} anchorIds={anchorIds} run={run} onVista={host?.onVista} />}

      {worn.length > 0 && data.scores && (
        <Card>
          <h3 className="mirror-section-h mb-2">{t("mirror.scoresTitle")}</h3>
          <LookScores scores={data.scores} />
          <p className="mt-2 type-body-sm text-muted">{t("mirror.scoresNote")}</p>
        </Card>
      )}

      {owned.length < worn.length && <p className="type-body-sm text-muted" role="note">{t("mirror.catalogo.so_prova")}</p>}
      <div className="mirror-actions">
        <Button variant="accent" disabled={!data.complete} onClick={() => void use()}><FaiIcon id="ACT-36" size={20} className="ico-text" decorative />{t("mirror.usar_este_look_hoje")}</Button>
        <Button variant="primary" disabled={owned.length < 2} onClick={() => void save()}><FaiIcon id="ACT-10" size={20} className="ico-text" decorative />{t("mirror.salvar_look")}</Button>
        {owned.length ? <Link href={`/schemes/new?pieces=${owned.map((w) => encodeURIComponent(w.p.id)).join(",")}`} className="btn">{t("mirror.abrir_no_editor")}</Link> : <Button disabled>{t("mirror.abrir_no_editor")}</Button>}
        {worn.length ? <Link href={`/try-on?provar=${provar}`} className="btn"><FaiIcon id="NAV-07" size={20} className="ico-text" decorative />{t("mirror.provar_look_no_provador")}</Link> : <Button disabled>{t("mirror.provar_look_no_provador")}</Button>}
        <Button disabled={!canTakeOneOff(data) || busy === "one"} onClick={() => void takeOneOff()}><FaiIcon id="ACT-33" size={20} className="ico-text" decorative />{t("mirror.tira_uma_coisa")}</Button>
      </div>

      {part && (
        <MirrorPartSheet part={part} data={data} hand={inHandOf(part, data, held)} pinned={pinned} busy={busy} onClose={() => setOpen(null)}
          onTogglePin={togglePin}
          wear={async (p) => { if (host?.wear) await host.wear(p); else { const r = await run("place", () => api.post("/api/me/mirror/pieces", { pieceId: p.id })) as { notice?: string } | null; if (r?.notice) toast.info(r.notice); } }}
          wearProduct={async (productId) => { await run("place", () => api.post("/api/me/mirror/catalog", { productId })); }}
          takeOff={async (p) => { if (isCatalogPiece(p)) await run("rm", () => api.delete(`/api/me/mirror/catalog/${encodeURIComponent(p.productId ?? "")}`)); else if (host?.takeOff) await host.takeOff(p); else await run("rm", () => api.delete(`/api/me/mirror/pieces/${encodeURIComponent(p.id)}`)); }}
          unlist={async (p) => { if (host?.unlist) await host.unlist(p); else await run("unlist", () => api.delete(`/api/me/mirror/rack/${encodeURIComponent(p.id)}`)); }} />
      )}
    </div>
  );
}
