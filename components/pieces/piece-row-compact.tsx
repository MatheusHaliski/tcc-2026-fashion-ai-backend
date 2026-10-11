"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";
import { ActionMenu, Badge, Button, cn, type MenuItem } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import type { Illustration } from "@/lib/capture/capture-guides";
import { useI18n } from "@/lib/i18n/i18n";

/** Glifo da categoria quando a peça não tem foto (ou o lugar está vazio) — os mesmos da segmentação do RF47. */
export const SLOT_GLYPH: Record<string, Illustration> = {
  upper_piece: "tshirt", upper: "tshirt", outer_layer: "tshirt", top: "tshirt",
  full_body_piece: "dress", dress: "dress",
  lower_piece: "pants_back", lower: "pants_back",
  shoes_piece: "sneaker_side", shoes: "sneaker_side",
  accessory_piece: "bag", accessory: "bag",
};

export interface PieceRowCompactProps {
  /** rótulo do lugar (mono, maiúsculas): "Parte de cima", "Calçado"… */
  kicker: string;
  thumb?: string | null;
  glyph?: Illustration;
  /** lugar vazio: miniatura tracejada com o glifo esmaecido e sem a linha de identidade */
  empty?: boolean;
  /** marca: logo 18 + nome; `showBrand` mostra "Sem marca" quando falta (no espelho, que não tem marca, fica oculto) */
  brand?: { name: string; logoUrl?: string | null } | null;
  showBrand?: boolean;
  source?: { label: string; tone?: "thread" | "chalk" } | null;
  /** complemento curto da identidade (endereço no quarto, por exemplo) */
  meta?: string | null;
  name: string;
  /** o nome é o link da peça: /pieces/{id} ou a página do produto (externa) */
  href?: string | null;
  external?: boolean;
  /** depois do nome, na mesma linha (amostras de cor) */
  nameExtra?: ReactNode;
  /** UMA linha de estado */
  state?: ReactNode;
  /** até duas ações visíveis; o resto vai para o menu ⋯ */
  actions?: ReactNode;
  menu?: MenuItem[];
  menuLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  removeAria?: string;
  className?: string;
  /** destaque (peça que acabou de chegar, lugar que falta) */
  tone?: "mark" | "thread";
}

/**
 * Peça · compacto (docs/anatomias, v18 §A0 + v20 §3 `.catalog-pick`, consolidado em anatomy.md §1): miniatura de 56 px
 * (fundo da superfície, foto inteira; sem foto, o glifo da categoria) · coluna de texto com o rótulo do lugar, a identidade
 * (logo da marca, marca e origem), o nome numa linha só (é o link da peça) e UMA linha de estado · à direita no máximo
 * três ações visíveis, o resto no menu ⋯, e "Remover" discreto. Em linhas estreitas as ações descem para baixo do texto.
 * Nada de legenda miúda dentro da linha: texto em corpo normal ou dentro de botão.
 */
export function PieceRowCompact({
  kicker, thumb, glyph = "generic", empty, brand, showBrand, source, meta, name, href, external, nameExtra, state, actions, menu, menuLabel,
  onRemove, removeLabel, removeAria, className, tone,
}: PieceRowCompactProps) {
  const { t } = useI18n();
  const src = thumb ? mediaUrl(thumb) : null;
  const identity = !empty && (brand || showBrand || source || meta);
  const visibleMenu = (menu ?? []).filter((m) => !m.hidden);
  return (
    <li className={cn("piece-row", empty && "is-empty", tone && `is-${tone}`, className)}>
      <div className="piece-row-grid">
        <span className="piece-row-thumb" aria-hidden>
          {src ? <img src={src} alt="" loading="lazy" /> : <GarmentGlyph id={glyph} size={40} animated={false} numbered={false} />}
        </span>
        <div className="piece-row-text">
          <p className="piece-row-kicker">{kicker}</p>
          {identity && (
            <p className="piece-row-identity">
              {brand ? <><BrandLogo name={brand.name} src={brand.logoUrl} size={18} /><span className="piece-row-brand">{brand.name}</span></>
                : showBrand ? <span className="piece-row-brand text-muted">{t("tryOn.sem_marca")}</span> : null}
              {source && <Badge tone={source.tone}>{source.label}</Badge>}
              {meta && <span className="piece-row-meta">{meta}</span>}
            </p>
          )}
          <p className={cn("piece-row-name", empty && "text-muted")}>
            {href ? (external
              ? <a href={href} target="_blank" rel="noreferrer noopener" className="piece-row-link">{name}</a>
              : <Link href={href} className="piece-row-link">{name}</Link>)
              : <span className="piece-row-link">{name}</span>}
            {nameExtra}
          </p>
          {state && <div className="piece-row-state">{state}</div>}
        </div>
        {(actions || visibleMenu.length > 0 || onRemove) && (
          <div className="piece-row-actions">
            {actions}
            {visibleMenu.length > 0 && <ActionMenu items={visibleMenu} label={menuLabel ?? t("common.moreOptions")} />}
            {onRemove && <Button size="sm" variant="ghost" aria-label={removeAria} onClick={onRemove}>{removeLabel ?? t("tryOn.remover")}</Button>}
          </div>
        )}
      </div>
    </li>
  );
}
