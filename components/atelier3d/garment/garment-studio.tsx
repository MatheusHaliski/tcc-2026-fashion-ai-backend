"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { assetIsPhotoRelief } from "@/lib/atelier3d/garment-parts";
import { Choice } from "./garment-fields";
import { GarmentMaterialPanel } from "./garment-material-panel";
import type { GarmentStudio as Studio, StudioTab } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: Studio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

const KNOWN_ERRORS = new Set(["ATELIER_COMMAND_LIMIT", "ATELIER_COMMAND_STATIC", "ATELIER_IMAGE_TYPE", "ATELIER_IMAGE_SIZE", "ATELIER_COMMAND_TARGET"]);

/** Ferramentas de roupa sobre o GLB carregado: material, pintura, estampa, modelagem e acabamentos. */
export function GarmentStudioPanel({ studio, asset, doc, editable: canEdit }: Props) {
  const { t } = useI18n();
  // o relevo da foto (bloco com a imagem) não é uma peça: nada de tecido, pintura ou estampa sobre ele
  const relief = assetIsPhotoRelief(asset), editable = canEdit && !relief;
  const panels: Partial<Record<StudioTab, ReactNode>> = {
    material: <GarmentMaterialPanel studio={studio} asset={asset} doc={doc} editable={editable} />,
  };
  const tabs = Object.keys(panels) as StudioTab[];
  return (
    <section className={styles.studio} aria-labelledby="garment-studio-title">
      <h2 id="garment-studio-title" className="type-h3">{t("atelier3d.garment.title")}</h2>
      <div className={styles.tabs} role="tablist" aria-label={t("atelier3d.garment.title")}>
        {tabs.map((tab) => (
          <Button key={tab} role="tab" size="sm" aria-selected={studio.tab === tab} aria-controls="garment-studio-panel"
            onClick={() => studio.setTab(tab)}>
            {t(`atelier3d.garment.tab.${tab}`)}
          </Button>
        ))}
      </div>
      <Choice legend={t("atelier3d.garment.scope")} value={studio.scope} disabled={!editable}
        options={[{ id: "part", label: t("atelier3d.garment.scope.part") }, { id: "all", label: t("atelier3d.garment.scope.all") }]}
        onChange={studio.setScope} />
      {relief && <p role="status" data-testid="garment-studio-relief">{t("atelier3d.photoRelief")}</p>}
      {!studio.targets.length && <p className="type-caption">{t("atelier3d.garment.noTarget")}</p>}
      {studio.error && (
        <p role="alert" className="error-text">
          {t(KNOWN_ERRORS.has(studio.error) ? `atelier3d.garment.error.${studio.error}` : "atelier3d.garment.error.generic")}
        </p>
      )}
      <div id="garment-studio-panel" role="tabpanel" aria-label={t(`atelier3d.garment.tab.${studio.tab}`)}>
        {panels[studio.tab]}
      </div>
    </section>
  );
}
