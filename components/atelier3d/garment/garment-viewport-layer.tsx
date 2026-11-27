"use client";
import { useEffect, useReducer } from "react";
import { applyDocument, type LoadedAsset, type SceneDocument } from "@/lib/atelier3d/document";
import { onImagesReady } from "@/lib/atelier3d/garment/images";
import { GarmentEnvironment } from "./garment-environment";
import { GarmentPointer } from "./garment-pointer";
import type { GarmentStudio } from "./use-garment-studio";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/** Tudo que as ferramentas de roupa colocam dentro do canvas do viewport. */
export function GarmentViewportLayer({ studio, asset, doc, editable }: Props) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const shown = studio.draft ?? doc;
  // estampa decodificada depois do primeiro desenho: recompõe a textura da parte
  useEffect(() => onImagesReady(() => {
    applyDocument(asset, shown);
    redraw();
  }), [asset, shown]);
  return (
    <>
      <GarmentEnvironment studio={studio} />
      <GarmentPointer studio={studio} asset={asset} doc={doc} editable={editable} />
    </>
  );
}
