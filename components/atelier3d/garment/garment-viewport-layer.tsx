"use client";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { GarmentEnvironment } from "./garment-environment";
import type { GarmentStudio } from "./use-garment-studio";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/** Tudo que as ferramentas de roupa colocam dentro do canvas do viewport. */
export function GarmentViewportLayer({ studio }: Props) {
  return <GarmentEnvironment studio={studio} />;
}
