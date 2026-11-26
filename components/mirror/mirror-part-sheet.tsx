"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, SegmentPicker, Sheet, Skeleton, cn } from "@/components/ui";
import { MirrorWornRow } from "@/components/mirror/mirror-worn-row";
import { MirrorCatalogPicker } from "@/components/mirror/mirror-catalog-picker";
import { isCatalogPiece, type MirrorData, type MirrorPart, type MirrorPieceRef } from "@/lib/mirror/mirror-model";

/*
 * Folha de uma parte do look (Parte de cima, Peça única, Parte de baixo, Calçado, Acessório): tudo em botões e listas.
 *  - Vestindo agora: o card compacto de peça (o mesmo do Provador) — da pessoa ou da loja (MirrorWornRow).
 *  - Roupas em mãos: a lista do espelho — peças trazidas do guarda-roupa para esta parte, ainda não
 *    vestidas (tocar veste; "Tirar da lista" devolve ao guarda-roupa) — e a peça segurada pelo personagem.
 *  - Escolher peça, em janela segmentada (radiogroup): "Meu closet" — todas as peças do guarda-roupa que servem nesta
 *    parte (a Parte de cima junta camisetas e jaquetas/blazers) — ou "Catálogo de marcas": o catálogo paginado da
 *    categoria da parte, com busca, para vestir só para provar (MirrorCatalogPicker).
 *  - Sugestões: até 3 com o porquê; sem candidatas, o caminho para cadastrar.
 * Nunca chama /slots/{slot}/swap (só devolve sugestões, não troca nada).
 */
interface Pick { pieces: MirrorPieceRef[]; message?: string | null; href?: string | null }
type Origin = "closet" | "catalog";
const asList = (v: MirrorPieceRef | MirrorPieceRef[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function MirrorPartSheet({ part, data, hand, pinned, busy, onClose, onTogglePin, wear, wearProduct, takeOff, unlist }: {
  part: MirrorPart; data: MirrorData;
  /** roupas em mãos desta parte, ainda não vestidas (inHandOf): `listed` = na lista do espelho; senão, na mão */
  hand: (MirrorPieceRef & { listed: boolean })[];
  pinned: Set<string>; busy: string | null; onClose: () => void; onTogglePin: (id: string) => void;
  wear: (p: MirrorPieceRef) => Promise<void>; takeOff: (p: MirrorPieceRef) => Promise<void>; unlist: (p: MirrorPieceRef) => Promise<void>;
  /** veste um produto do catálogo de marcas (só o id: o servidor lê o resto do catálogo) */
  wearProduct: (productId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const label = t(part.label);
  const worn = part.slots.flatMap((s) => asList(data.slots[s]));
  // "já no espelho" vem do estado vivo (o inMirror do guarda-roupa é de quando a folha abriu e fica velho ao tirar a peça)
  const wornAll = Object.values(data.slots).flatMap((v) => asList(v));
  const wornIds = new Set(wornAll.map((p) => p.id));
  const wornProducts = new Set(wornAll.filter(isCatalogPiece).map((p) => String(p.productId)));
  const [origin, setOrigin] = useState<Origin>("closet");
  const [pick, setPick] = useState<Pick | null>(null);
  const [pickError, setPickError] = useState<unknown>(null);
  const [sug, setSug] = useState<{ alternatives: MirrorPieceRef[]; message?: string | null; explanation?: string | null; empty?: { message: string; href?: string | null } } | null>(null);
  const [sugBusy, setSugBusy] = useState(false);
  const miss = (data.missing ?? []).find((m) => m.slot === part.suggest);
  // a falta é do lugar da própria parte: na Parte de cima, a jaqueta (camada externa) vestida não supre a peça por baixo
  const ownEmpty = asList(data.slots[part.suggest]).length === 0;
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
      <span className="mirror-pick-art">{(p.thumbnailUrl ?? p.imageUrl) ? <img src={pieceImageUrl(p, 320)} alt="" /> : null}</span>
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
              {worn.map((p) => <MirrorWornRow key={p.id} p={p} part={part} pinned={pinned.has(p.id)} busy={busy} onTogglePin={onTogglePin} takeOff={takeOff} unlist={unlist} />)}
            </ul>
          </section>
        )}
        {worn.length === 0 ? <p className="type-body text-muted">{miss?.message ?? t("mirror.sheet.nada_vestido")}</p>
          : miss && ownEmpty ? <p className="type-body text-muted" role="note">{miss.message}</p> : null}
        {hand.length > 0 && (
          <section aria-labelledby="ms-rack">
            <h3 id="ms-rack" className="mirror-section-h">{t("room.mirror.hands")}</h3>
            <div className="mirror-pick-grid" data-testid="mirror-hands-picker">{hand.map((p) => (
              <div key={p.id} className="mirror-pick-hold">
                {tile(p, p.listed ? p.addressLabel : t("room.mirror.in_hand"))}
                {p.listed && <button type="button" className="mirror-pick-unlist" disabled={busy !== null} onClick={() => void unlist(p)}
                  aria-label={t("room.mirror.remover_da_lista", { name: p.name })}>{t("room.mirror.remover")}</button>}
              </div>
            ))}</div>
          </section>
        )}
        <section aria-labelledby="ms-pick">
          <h3 id="ms-pick" className="mirror-section-h">{t("mirror.origem.titulo")}</h3>
          <SegmentPicker<Origin> label={t("mirror.origem.label")} value={origin} onChange={setOrigin}
            options={[{ id: "closet", label: t("mirror.origem.closet") }, { id: "catalog", label: t("mirror.origem.catalogo") }]} />
          {origin === "catalog" ? <MirrorCatalogPicker part={part} label={label} wornProductIds={wornProducts} busy={busy} onWear={wearProduct} />
            : pickError ? <p className="type-body text-muted" role="status">{pickError instanceof Error ? pickError.message : t("common.errorTitle")}</p>
            : !pick ? <Skeleton className="h-24" />
            : pick.pieces.length ? <div className="mirror-pick-grid" data-testid="mirror-wardrobe-picker">{pick.pieces.map((p) => tile(p, wornIds.has(p.id) ? t("mirror.ja_no_espelho") : hand.some((r) => r.id === p.id) ? t("mirror.sheet.na_lista") : p.addressLabel, wornIds.has(p.id)))}</div>
            : <p className="type-body text-muted">{pick.message ?? t("mirror.sheet.guarda_roupa_vazio")} <Link href={pick.href ?? "/pieces/new"} className="underline">{t("mirror.adicionar_peca")}</Link>{" "}
                <Button size="sm" variant="ghost" onClick={() => setOrigin("catalog")}>{t("mirror.catalogo.ver_no_catalogo")}</Button></p>}
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
