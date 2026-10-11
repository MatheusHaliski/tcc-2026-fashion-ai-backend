"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaiIcon } from "@/components/fai-icon";
import { Button, Card, Dialog, cn, type MenuItem } from "@/components/ui";
import { useModel3d } from "@/components/model3d-panel";
import { PieceRowCompact, SLOT_GLYPH } from "@/components/pieces/piece-row-compact";
import { GarmentState } from "@/components/try-on/garment-state";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import { mirrorHref } from "@/lib/nav/mirror-href";
import { FITTING_SLOTS, type FittingItem, type FittingSlot } from "@/lib/tryon/fitting-room";
import { useGarmentStatus } from "@/lib/tryon/garment-status";
import { model3dFill, model3dProgress, type Model3dProgress } from "@/lib/tryon/model3d-steps";

export interface FittingItemsProps {
  items: FittingItem[];
  products: Record<string, CatalogProduct>;
  colors?: Record<string, string>;
  owned: Record<string, string>;
  busyOwn: string | null;
  status: string;
  slotNames: Record<FittingSlot, string>;
  onVariantChange: (item: FittingItem, variant: CatalogVariant) => void;
  onOwn: (item: FittingItem) => void;
  onRemove: (slot: FittingSlot) => void;
  /** abre a prévia 2D no espelho (o mesmo avatar, de frente e parado) com o look atual */
  onPreview2d?: (item: FittingItem) => void;
  /** lugar vazio: ir às lojas (com a categoria do lugar) ou ao guarda-roupa */
  onPickFromStores?: (slot: FittingSlot) => void;
  onPickFromWardrobe?: (slot: FittingSlot) => void;
}

/**
 * "Provando agora": um card compacto de peça por lugar do corpo (docs/anatomias · Peça · compacto,
 * components/pieces/piece-row-compact.tsx). A linha de estado é uma só: o botão da prévia 2D no espelho e a barra do
 * modelo 3D com as etapas que faltam. Lugar vazio: miniatura tracejada com o glifo e os atalhos para as lojas e o
 * guarda-roupa.
 */
export function FittingItems({
  items, products, colors, owned, busyOwn, status, slotNames, onVariantChange, onOwn, onRemove, onPreview2d, onPickFromStores, onPickFromWardrobe,
}: FittingItemsProps) {
  const { t } = useI18n();
  const fullBody = items.find((entry) => entry.wear === "FULL_BODY");
  return (
    <Card>
      <h2 className="type-h3 mb-2">{t("tryOn.provando_agora")}</h2>
      <ul className="piece-rows">
        {FITTING_SLOTS.map((slot) => {
          const item = items.find((entry) => entry.slot === slot);
          if (!item) {
            return (
              <PieceRowCompact key={slot} empty kicker={slotNames[slot]} glyph={SLOT_GLYPH[slot]} name={t("tryOn.slot_vazio_curto")}
                actions={<>
                  <Button size="sm" onClick={() => onPickFromStores?.(slot)}><FaiIcon id="NAV-11" size={20} className="ico-text" decorative />{t("tryOn.escolher_nas_lojas")}</Button>
                  <Button size="sm" onClick={() => onPickFromWardrobe?.(slot)}><FaiIcon id="NAV-02" size={20} className="ico-text" decorative />{t("tryOn.escolher_no_guarda_roupa")}</Button>
                </>} />
            );
          }
          return (
            <FittingSlotRow key={slot} item={item} slotName={slotNames[slot]} product={item.productId ? products[item.productId] : undefined} colors={colors}
              ownedId={owned[item.key]} busyOwn={busyOwn === item.key} coveredBy={slot === "lower_piece" && fullBody ? fullBody.name : null}
              onVariantChange={onVariantChange} onOwn={onOwn} onRemove={() => onRemove(slot)} onPreview2d={onPreview2d} />
          );
        })}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </Card>
  );
}

/** Pedidos automáticos do 3D nesta visita (peça → motivo da pausa, ou null): um por peça, mesmo se a linha remontar. */
const AUTO_QUEUED = new Map<string, string | null>();
/** só para testes */
export function resetAutoQueue() { AUTO_QUEUED.clear(); }

/**
 * O modelo 3D da peça na linha do slot: peça do guarda-roupa sem pedido entra na fila sozinha (uma vez); peça da loja
 * fica em 0 de 4 até ser guardada ("Guardar a peça e gerar o 3D" no menu ⋯). Falha ao pedir (sem foto, cota, recurso
 * desligado) vira "3D pausado", com o motivo acessível — sem aviso solto na tela.
 */
function useFittingModel3d(item: FittingItem, ownedId: string | undefined, onOwn: (item: FittingItem) => void) {
  const pieceId = item.pieceId ?? ownedId ?? "";
  const model = useModel3d(pieceId, { enabled: !!pieceId });
  const [paused, setPaused] = useState<string | null>(() => (pieceId ? AUTO_QUEUED.get(pieceId) ?? null : null));
  const wantAfterOwn = useRef(false);
  const queue = async () => { if (!pieceId) return; const e = await model.queue(); const reason = e ? e.message : null; AUTO_QUEUED.set(pieceId, reason); setPaused(reason); };
  useEffect(() => {
    const st = model.st;
    if (!pieceId || !st || st.status != null || st.featureEnabled === false) return;
    const auto = item.source === "wardrobe" && !AUTO_QUEUED.has(pieceId);
    if (!auto && !wantAfterOwn.current) return;
    wantAfterOwn.current = false;
    AUTO_QUEUED.set(pieceId, null);
    void queue();
  }, [pieceId, model.st]); // eslint-disable-line react-hooks/exhaustive-deps
  // antes da primeira resposta, o estado que veio com a peça (sem piscar "0 de 4" numa peça que já tem 3D)
  const progress = model3dProgress(model.st ?? { status: item.model3dStatus, modelUrl: item.model3dUrl });
  const saveAndGenerate = () => { wantAfterOwn.current = true; onOwn(item); };
  return { pieceId, model, progress, paused: progress.phase === "none" ? paused : null, queue, saveAndGenerate };
}

function FittingSlotRow({ item, slotName, product, colors, ownedId, busyOwn, coveredBy, onVariantChange, onOwn, onRemove, onPreview2d }: {
  item: FittingItem; slotName: string; product?: CatalogProduct; colors?: Record<string, string>; ownedId?: string; busyOwn: boolean; coveredBy: string | null;
  onVariantChange: (item: FittingItem, variant: CatalogVariant) => void; onOwn: (item: FittingItem) => void; onRemove: () => void; onPreview2d?: (item: FittingItem) => void;
}) {
  const { t } = useI18n();
  const garment = useGarmentStatus();   // estado das fotos no 3D (publicado pela cena)
  const m3d = useFittingModel3d(item, ownedId, onOwn);
  const [details, setDetails] = useState(false);
  const catalog = item.source === "catalog";
  const href = item.pieceId ? `/pieces/${item.pieceId}` : ownedId ? `/pieces/${ownedId}` : item.officialUrl ?? null;
  const swatches = product && (product.variants?.length ?? 0) > 1 ? (
    <span className="piece-row-swatches" role="group" aria-label={t("tryOn.trocar_cor")}>
      {product.variants!.map((variant) => (
        <button key={variant.id} type="button" className={cn("catalog-swatch", item.variantId === variant.id && "is-active")}
          title={variant.colorName ?? variant.key} aria-label={variant.colorName ?? variant.key} aria-pressed={item.variantId === variant.id}
          onClick={() => onVariantChange(item, variant)} style={{ background: colors?.[variant.color ?? ""] ?? "var(--surface-3)" }} />
      ))}
    </span>
  ) : null;
  const menu: MenuItem[] = [
    { label: t("tryOn.guardar_e_gerar_3d"), onSelect: m3d.saveAndGenerate, hidden: !catalog || !!ownedId || busyOwn },
    { label: t("tryOn.gerar_3d"), onSelect: () => void m3d.queue(), hidden: !m3d.pieceId || m3d.progress.phase !== "none" || !!m3d.paused || item.source === "wardrobe" },
    { label: t("tryOn.m3d.tentar_de_novo"), onSelect: () => void m3d.queue(), hidden: !m3d.paused },
    { label: t("tryOn.levar_ao_espelho"), href: mirrorHref({ piece: m3d.pieceId }), hidden: !m3d.pieceId },
    { label: t("tryOn.detalhes_previa"), onSelect: () => setDetails(true) },
  ];
  return (
    <>
      <PieceRowCompact kicker={slotName} thumb={item.imageUrl} glyph={SLOT_GLYPH[item.wear === "FULL_BODY" ? "dress" : item.slot]}
        brand={item.brand ? { name: item.brand.name, logoUrl: item.brand.logoUrl } : null} showBrand
        source={{ label: t(catalog ? "tryOn.origem_loja" : "tryOn.origem_guarda_roupa"), tone: catalog ? "thread" : "chalk" }}
        name={`${item.name}${item.colorName ? ` — ${item.colorName}` : ""}`} href={href} external={!item.pieceId && !ownedId}
        nameExtra={swatches} tone={catalog ? "thread" : undefined}
        state={<>
          {coveredBy
            ? <span className="piece-row-note"><FaiIcon id="NAV-07" size={20} className="ico-text" decorative />{t("tryOn.coberta_curto", { name: coveredBy })}</span>
            : <Button size="sm" onClick={() => onPreview2d?.(item)}><FaiIcon id="NAV-07" size={20} className="ico-text" decorative />{t("tryOn.ver_previa_2d")}</Button>}
          <Model3dStepBar progress={m3d.progress} paused={m3d.paused} canRetryFree={!!m3d.model.st?.canRetryFree} busy={m3d.model.busy}
            onRetry={() => void m3d.model.request()} />
        </>}
        actions={catalog ? <>
          {item.officialUrl && (
            <a href={item.officialUrl} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
              <FaiIcon id="NAV-11" size={20} className="ico-text" decorative />{t("tryOn.ver_na_loja", { loja: item.sourceDomain ?? item.brand?.name ?? "" })}
            </a>
          )}
          {ownedId
            ? <Link href={`/pieces/${ownedId}`} className="btn btn-sm"><FaiIcon id="NAV-02" size={20} className="ico-text" decorative />{t("tryOn.ja_no_guarda_roupa")}</Link>
            : <Button size="sm" disabled={busyOwn} onClick={() => onOwn(item)}><FaiIcon id="ACT-06" size={20} className="ico-text" decorative />{t(busyOwn ? "tryOn.salvando" : "tryOn.ja_tenho")}</Button>}
        </> : null}
        menu={menu} menuLabel={t("tryOn.mais_acoes", { name: item.name })}
        onRemove={onRemove} removeAria={t("tryOn.remover_de", { name: item.name, slot: slotName })} />
      <Dialog open={details} onClose={() => setDetails(false)} title={t("tryOn.detalhes_previa_titulo", { name: item.name })}>
        <div className="grid gap-3">
          <GarmentState item={item} photo={garment.photos[item.key]} />
          <p className="type-body">{m3d.paused ? t("tryOn.m3d.pausado_motivo", { reason: m3d.paused }) : model3dLabel(t, m3d.progress)}</p>
        </div>
      </Dialog>
    </>
  );
}

type T = ReturnType<typeof useI18n>["t"];
function model3dLabel(t: T, p: Model3dProgress): string {
  if (p.phase === "ready") return t("tryOn.m3d.pronto");
  if (p.phase === "failed") return t("model3d.falhou");
  if (p.phase === "queued") return t("tryOn.m3d.na_fila", { step: p.step, total: p.total });
  if (p.phase === "running") return p.pct != null ? t("tryOn.m3d.gerando_pct", { pct: p.pct }) : t("tryOn.m3d.gerando", { step: p.step, total: p.total });
  return t("tryOn.m3d.nao_iniciado", { step: p.step, total: p.total });
}

/**
 * Barra do modelo 3D (140×6, a mesma do detalhe da peça): etapas concluídas de 4 — porcentagem só quando o provedor
 * informa de verdade. Falhou: "Não deu para gerar o 3D." + "Tentar de novo (grátis)". Pausado: a barra esmaece e o
 * motivo fica no nome acessível e na dica (e em "Detalhes da prévia").
 */
export function Model3dStepBar({ progress, paused, canRetryFree, busy, onRetry }: { progress: Model3dProgress; paused?: string | null; canRetryFree?: boolean; busy?: boolean; onRetry?: () => void }) {
  const { t } = useI18n();
  if (progress.phase === "failed") {
    return (
      <span className="m3d-step is-failed" role="status">
        <span>{t("model3d.falhou")}</span>
        {onRetry && <Button size="sm" onClick={onRetry} loading={busy}>{canRetryFree ? t("model3d.tentar_gratis") : t("common.retry")}</Button>}
      </span>
    );
  }
  const label = paused ? t("tryOn.m3d.pausado") : model3dLabel(t, progress);
  const fill = paused ? 0 : model3dFill(progress);
  const real = progress.pct != null;
  return (
    <span className={cn("m3d-step", paused && "is-paused", progress.phase === "ready" && "is-ready")} title={paused ? t("tryOn.m3d.pausado_motivo", { reason: paused }) : undefined}
      data-phase={paused ? "paused" : progress.phase} aria-live="polite">
      <span className="m3d-bar" role="progressbar" aria-label={t("tryOn.m3d.aria")} aria-valuemin={0} aria-valuemax={real ? 100 : progress.total}
        aria-valuenow={paused ? 0 : real ? progress.pct! : progress.step} aria-valuetext={paused ? t("tryOn.m3d.pausado_motivo", { reason: paused }) : label}>
        <span style={{ width: `${fill}%` }} />
      </span>
      <span>{label}</span>
    </span>
  );
}
