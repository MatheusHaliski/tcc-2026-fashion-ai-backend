"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Input, Skeleton } from "@/components/ui";
import { CatalogPhoto } from "@/components/catalog/catalog-photo";
import { categoryOfPart, type MirrorPart } from "@/lib/mirror/mirror-model";
import { useCatalogBrowse } from "@/components/mirror/use-catalog-browse";

/**
 * "Catálogo de marcas" na folha da parte do Espelho: os produtos do catálogo paginado da categoria da parte (a Parte de
 * cima junta camisetas e jaquetas), com busca por marca, modelo ou cor e "Carregar mais". Tocar veste o produto no
 * reflexo só para provar (o servidor confere o produto e põe no lugar dele); o que já está no espelho fica marcado.
 */
export function MirrorCatalogPicker({ part, label, wornProductIds, busy, onWear }: {
  part: MirrorPart; label: string; wornProductIds: Set<string>; busy: string | null; onWear: (productId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const browse = useCatalogBrowse(categoryOfPart(part.id));
  const failed = browse.error ? (browse.error instanceof Error ? browse.error.message : t("common.errorTitle")) : null;
  return (
    <div className="mirror-catalog" data-testid="mirror-catalog-picker">
      <Input type="search" value={browse.text} onChange={(e) => browse.setText(e.target.value)} placeholder={t("mirror.catalogo.buscar_dica")}
        aria-label={t("mirror.catalogo.buscar", { part: label })} />
      {browse.total != null && !failed && <p className="type-caption text-muted" role="status">{t("mirror.catalogo.total", { n: browse.total })}</p>}
      {browse.items.length > 0 && (
        <div className="mirror-pick-grid">{browse.items.map((p) => {
          const worn = wornProductIds.has(p.id);
          return (
            <button key={p.id} type="button" className="mirror-pick" disabled={worn || busy !== null} aria-pressed={worn ? true : undefined} onClick={() => void onWear(p.id)}
              aria-label={t("mirror.sheet.vestir_aria", { name: p.productName, part: label })}>
              <span className="mirror-pick-art">
                <CatalogPhoto framing="WHOLE" image={p.catalogImage} fallbackUrl={p.imageUrl} category={p.category} subcategory={p.subcategory} color={p.color} colorHex={p.colorHex} alt="" />
              </span>
              <span className="mirror-pick-name">{p.productName}</span>
              <span className="mirror-pick-sub">{worn ? t("mirror.ja_no_espelho") : p.brand?.name ?? t("tryOn.sem_marca")}</span>
            </button>
          );
        })}</div>
      )}
      {failed ? (
        <p className="type-body text-muted" role="status">{failed} <Button size="sm" onClick={browse.retry}>{t("common.retry")}</Button></p>
      ) : browse.loading ? <Skeleton className="h-24" />
        : !browse.items.length ? <p className="type-body text-muted">{t("mirror.catalogo.vazio")}</p>
        : browse.hasMore ? <Button size="sm" onClick={browse.loadMore}>{t("mirror.catalogo.carregar_mais")}</Button> : null}
    </div>
  );
}
