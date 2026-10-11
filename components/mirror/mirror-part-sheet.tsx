"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Sheet, Skeleton, cn, type MenuItem } from "@/components/ui";
import { PieceRowCompact } from "@/components/pieces/piece-row-compact";
import { assetStateOf } from "@/lib/room3d/mirror-session";
import type { MirrorData, MirrorPart, MirrorPieceRef } from "@/components/mirror/mirror-controls";

/*
 * Folha de uma parte do look (Parte de cima, Peça única, Parte de baixo, Calçado, Acessório): tudo em botões e listas.
 *  - Vestindo agora: o card compacto de peça (o mesmo do Provador) com Tirar, Manter (âncora do Vista-me) e, no menu ⋯,
 *    Mostrar no quarto, Provar no provador e Tirar da lista do espelho.
 *  - Na lista do espelho: peças trazidas do quarto para esta parte, ainda não vestidas (tocar veste).
 *  - Do guarda-roupa: todas as peças que servem nesta parte (a Parte de cima junta camisetas e jaquetas/blazers).
 *  - Sugestões: até 3 com o porquê; sem candidatas, o caminho para cadastrar.
 * Nunca chama /slots/{slot}/swap (só devolve sugestões, não troca nada).
 */
interface Pick { pieces: MirrorPieceRef[]; message?: string | null; href?: string | null }
const asList = (v: MirrorPieceRef | MirrorPieceRef[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const ASSET_TONE = { PENDING: "mark", IMAGE_2D: "chalk", MOULD_3D: undefined, MODEL_3D: "thread" } as const;

export function MirrorPartSheet({ part, data, pinned, busy, onClose, onTogglePin, wear, takeOff, unlist, showInRoom }: {
  part: MirrorPart; data: MirrorData; pinned: Set<string>; busy: string | null; onClose: () => void; onTogglePin: (id: string) => void;
  wear: (p: MirrorPieceRef) => Promise<void>; takeOff: (p: MirrorPieceRef) => Promise<void>; unlist: (p: MirrorPieceRef) => Promise<void>;
  showInRoom?: (p: MirrorPieceRef) => void;
}) {
  const { t } = useI18n();
  const label = t(part.label);
  const worn = part.slots.flatMap((s) => asList(data.slots[s]));
  const wornIds = new Set(Object.values(data.slots).flatMap((v) => asList(v)).map((p) => p.id));
  const rack = (data.rack ?? []).filter((r) => part.slots.includes(r.slot ?? "") && !wornIds.has(r.id));
  const [pick, setPick] = useState<Pick | null>(null);
  const [pickError, setPickError] = useState<unknown>(null);
  const [sug, setSug] = useState<{ alternatives: MirrorPieceRef[]; message?: string | null; explanation?: string | null; empty?: { message: string; href?: string | null } } | null>(null);
  const [sugBusy, setSugBusy] = useState(false);
  const miss = (data.missing ?? []).find((m) => m.slot === part.suggest);
  // o guarda-roupa desta parte (sem IA): a Parte de cima junta ?slot=upper e ?slot=outer_layer — o servidor põe cada peça no lugar certo
  useEffect(() => {
    let alive = true; setPick(null); setPickError(null); setSug(null);
    Promise.all(part.slots.map((s) => api.get<Pick>(`/api/me/mirror/wardrobe?slot=${s}`)))
      .then((rs) => { if (!alive) return; const seen = new Set<string>(); const pieces = rs.flatMap((r) => r.pieces ?? []).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))); const msg = rs.find((r) => r.message); setPick({ pieces, message: pieces.length ? null : msg?.message ?? null, href: msg?.href ?? null }); })
      .catch((e) => { if (alive) setPickError(e); });
    return () => { alive = false; };
  }, [part.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function suggest() {
    setSugBusy(true);
    try { setSug(await api.get(`/api/me/mirror/suggestions?slot=${part.suggest}`)); }
    catch (e) {
      if (e instanceof ApiError && e.status === 422) setSug({ alternatives: [], empty: { message: e.message, href: (e.details as { href?: string } | undefined)?.href ?? "/pieces/new" } });
      else setSug({ alternatives: [], empty: { message: e instanceof Error ? e.message : t("common.errorTitle") } });
    } finally { setSugBusy(false); }
  }
  const tile = (p: MirrorPieceRef, sub: string | null | undefined, disabled = false) => (
    <button key={p.id} type="button" className="mirror-pick" disabled={disabled || busy !== null} aria-pressed={disabled ? true : undefined} onClick={() => void wear(p)}
      aria-label={t("mirror.sheet.vestir_aria", { name: p.name, part: label })}>
      <span className="mirror-pick-art">{(p.thumbnailUrl ?? p.imageUrl) ? <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl ?? undefined)} alt="" /> : null}</span>
      <span className="mirror-pick-name">{p.name}</span>
      {sub && <span className="mirror-pick-sub">{sub}</span>}
    </button>
  );
  return (
    <Sheet open onClose={onClose} title={label}>
      <div className="mirror-sheet">
        {worn.length > 0 && (
          <section aria-labelledby="ms-worn">
            <h3 id="ms-worn" className="mirror-section-h">{t("mirror.sheet.vestindo")}</h3>
            <ul className="piece-rows">
              {worn.map((p) => {
                const asset = assetStateOf(p); const pin = pinned.has(p.id);
                const menu: MenuItem[] = [
                  showInRoom ? { label: t("mirror.sheet.mostrar_no_quarto"), onSelect: () => showInRoom(p) } : { label: t("mirror.sheet.mostrar_no_quarto"), href: `/room?piece=${encodeURIComponent(p.id)}` },
                  { label: t("mirror.provar_no_provador"), href: `/try-on?provar=w.${encodeURIComponent(p.id)}` },
                  { label: t("mirror.sheet.tirar_da_lista"), onSelect: () => void unlist(p), danger: true },
                ];
                return (
                  <PieceRowCompact key={p.id} kicker={label} thumb={p.thumbnailUrl ?? p.imageUrl} glyph={part.glyph}
                    source={{ label: t("tryOn.origem_guarda_roupa"), tone: "chalk" }} meta={p.addressLabel} name={p.name} href={`/pieces/${p.id}`}
                    tone={p.available === false ? "mark" : undefined}
                    state={<>
                      <Badge tone={ASSET_TONE[asset]}>{t(`room.mirror.asset.${asset}`)}</Badge>
                      {p.available === false && <span className="text-mark">⚠ {t("mirror.parte.indisponivel")}</span>}
                    </>}
                    actions={<>
                      <Button size="sm" disabled={busy !== null} onClick={() => void takeOff(p)} aria-label={t("mirror.sheet.tirar_aria", { name: p.name })}>{t("room.mirror.remove")}</Button>
                      <Button size="sm" aria-pressed={pin} onClick={() => onTogglePin(p.id)} title={t("mirror.sheet.manter_dica")}>{pin ? `📌 ${t("mirror.parte.fixada")}` : t("mirror.sheet.manter")}</Button>
                    </>}
                    menu={menu} menuLabel={t("tryOn.mais_acoes", { name: p.name })} />
                );
              })}
            </ul>
          </section>
        )}
        {worn.length === 0 && <p className="type-body text-muted">{miss?.message ?? t("mirror.sheet.nada_vestido")}</p>}
        {rack.length > 0 && (
          <section aria-labelledby="ms-rack">
            <h3 id="ms-rack" className="mirror-section-h">{t("mirror.sheet.na_lista")}</h3>
            <div className="mirror-pick-grid">{rack.map((p) => tile(p, p.addressLabel))}</div>
          </section>
        )}
        <section aria-labelledby="ms-wardrobe">
          <h3 id="ms-wardrobe" className="mirror-section-h">{t("mirror.do_guarda_roupa")}</h3>
          {pickError ? <p className="type-body text-muted" role="status">{pickError instanceof Error ? pickError.message : t("common.errorTitle")}</p>
            : !pick ? <Skeleton className="h-24" />
            : pick.pieces.length ? <div className="mirror-pick-grid" data-testid="mirror-wardrobe-picker">{pick.pieces.map((p) => tile(p, p.inMirror || wornIds.has(p.id) ? t("mirror.ja_no_espelho") : rack.some((r) => r.id === p.id) ? t("mirror.sheet.na_lista") : p.addressLabel, p.inMirror || wornIds.has(p.id)))}</div>
            : <p className="type-body text-muted">{pick.message ?? t("mirror.sheet.guarda_roupa_vazio")} <Link href={pick.href ?? "/pieces/new"} className="underline">{t("mirror.adicionar_peca")}</Link></p>}
        </section>
        <section aria-labelledby="ms-sug">
          <h3 id="ms-sug" className="mirror-section-h">{t("mirror.sheet.sugestoes")}</h3>
          {!sug ? <Button size="sm" loading={sugBusy} onClick={() => void suggest()}>{miss?.action ?? t("mirror.sheet.pedir_sugestoes", { part: label.toLowerCase() })}</Button>
            : sug.empty ? <p className="type-body text-muted" role="status">{sug.empty.message} {sug.empty.href && <Link href={sug.empty.href} className="underline">{t("mirror.adicionar_peca")}</Link>}</p>
            : (
              <>
                {sug.message && <p className="type-body-sm text-muted">{sug.message}</p>}
                <div className={cn("mirror-pick-grid", "is-suggestions")} data-testid="mirror-suggestions">{sug.alternatives.map((p) => tile(p, p.why))}</div>
              </>
            )}
        </section>
      </div>
    </Sheet>
  );
}
