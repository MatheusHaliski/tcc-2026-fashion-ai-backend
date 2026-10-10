"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FaiIcon } from "@/components/fai-icon";
import { Badge, Button, Card, cn } from "@/components/ui";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { FITTING_SLOTS, type FittingItem, type FittingSlot } from "@/lib/tryon/fitting-room";
import { useGarmentStatus } from "@/lib/tryon/garment-status";
import { GarmentState } from "@/components/try-on/garment-state";

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
 * Slots e ações da prova atual; o componente recebe o estado e comunica a intenção. Na linha de cada peça não há
 * legenda miúda: todo texto vem em corpo normal com ícone, ou dentro de um botão (prévia 2D no espelho, loja, guarda-roupa,
 * remover), e o modelo 3D tem barra de progresso e botão de gerar/gerar novamente.
 */
export function FittingItems({
  items, products, colors, owned, busyOwn, status, slotNames, onVariantChange, onOwn, onRemove, onPreview2d, onPickFromStores, onPickFromWardrobe,
}: FittingItemsProps) {
  const { t } = useI18n();
  const garment = useGarmentStatus();   // estado das fotos no 3D (publicado pela cena)

  return (
    <Card>
      <h2 className="type-h3 mb-2">{t("tryOn.provando_agora")}</h2>
      <ul className="fitting-slots">
        {FITTING_SLOTS.map((slot) => {
          const item = items.find((entry) => entry.slot === slot);
          const fullBody = items.find((entry) => entry.wear === "FULL_BODY");
          const covered = slot === "lower_piece" && !!item && !!fullBody;
          const product = item?.productId ? products[item.productId] : undefined;

          return (
            <li key={slot} className={cn("fitting-slot", item && "is-filled")}>
              <span className="tryon-slot-name">{slotNames[slot]}</span>
              {item ? (
                <div className="fitting-slot-body">
                  <span className="fitting-slot-thumb" style={{ background: item.colorHex ?? "var(--surface-2)" }}>
                    {item.imageUrl ? <img src={mediaUrl(item.imageUrl) ?? undefined} alt="" /> : null}
                  </span>
                  <div className="min-w-0 flex-1 grid gap-1.5">
                    <p className="flex flex-wrap items-center gap-1.5 type-body-sm">
                      {item.brand && <BrandLogo name={item.brand.name} src={item.brand.logoUrl} size={20} />}
                      <span className="font-medium">{item.brand?.name ?? t("tryOn.sem_marca")}</span>
                      <Badge tone={item.source === "catalog" ? "thread" : "chalk"}>
                        {t(item.source === "catalog" ? "tryOn.origem_loja" : "tryOn.origem_guarda_roupa")}
                      </Badge>
                    </p>
                    <p className="truncate type-body font-medium">
                      {item.name}{item.colorName ? ` · ${item.colorName}` : ""}
                    </p>
                    <GarmentState item={item} photo={garment.photos[item.key]} />
                    {item.pieceId && (
                      <Link href={`/pieces/${item.pieceId}`} className="type-caption underline">{t("tryOn.review_piece")}</Link>
                    )}
                    {covered && (
                      <p className="fitting-slot-state text-muted">
                        <FaiIcon id="NAV-07" size={24} decorative /><span>{t("tryOn.coberta_pela_peca_inteira", { name: fullBody!.name })}</span>
                      </p>
                    )}
                    {product && (product.variants?.length ?? 0) > 1 && (
                      <div className="flex flex-wrap gap-1" role="group" aria-label={t("tryOn.trocar_cor")}>
                        {product.variants!.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            className={cn("catalog-swatch", item.variantId === variant.id && "is-active")}
                            title={variant.colorName ?? variant.key}
                            aria-label={variant.colorName ?? variant.key}
                            aria-pressed={item.variantId === variant.id}
                            onClick={() => onVariantChange(item, variant)}
                            style={{ background: colors?.[variant.color ?? ""] ?? "var(--surface-3)" }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="fitting-slot-actions">
                      <Button size="sm" onClick={() => onPreview2d?.(item)}><FaiIcon id="NAV-07" size={24} decorative />{t("tryOn.ver_previa_2d")}</Button>
                      {item.officialUrl && (
                        <a href={item.officialUrl} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
                          <FaiIcon id="NAV-11" size={24} decorative />{t("tryOn.ver_na_loja", { loja: item.sourceDomain ?? item.brand?.name ?? "" })}
                        </a>
                      )}
                      {item.source === "catalog" && (owned[item.key] ? (
                        <Link href={`/pieces/${owned[item.key]}`} className="btn btn-sm"><FaiIcon id="NAV-02" size={24} decorative />{t("tryOn.ja_no_guarda_roupa")}</Link>
                      ) : (
                        <Button size="sm" disabled={busyOwn === item.key} onClick={() => onOwn(item)}>
                          <FaiIcon id="ACT-06" size={24} decorative />{t(busyOwn === item.key ? "tryOn.salvando" : "tryOn.ja_tenho")}
                        </Button>
                      ))}
                      {item.pieceId && (
                        <Link href={`/pieces/${item.pieceId}`} className="btn btn-sm"><FaiIcon id="NAV-02" size={24} decorative />{t("tryOn.review_piece")}</Link>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("tryOn.remover_de", { name: item.name, slot: slotNames[slot] })}
                    onClick={() => onRemove(slot)}
                  >
                    <FaiIcon id="ACT-33" size={24} decorative />{t("tryOn.remover")}
                  </Button>
                </div>
              ) : (
                <div className="fitting-slot-empty">
                  <p className="fitting-slot-state text-muted"><FaiIcon id="ACT-06" size={24} decorative /><span>{t("tryOn.slot_vazio_curto")}</span></p>
                  <div className="fitting-slot-actions">
                    <Button size="sm" onClick={() => onPickFromStores?.(slot)}><FaiIcon id="NAV-11" size={24} decorative />{t("tryOn.escolher_nas_lojas")}</Button>
                    <Button size="sm" onClick={() => onPickFromWardrobe?.(slot)}><FaiIcon id="NAV-02" size={24} decorative />{t("tryOn.escolher_no_guarda_roupa")}</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </Card>
  );
}
