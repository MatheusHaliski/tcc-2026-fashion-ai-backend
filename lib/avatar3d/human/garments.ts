/*
 * Avatar 3D (RF40) / Provador — roupa que veste. Cada peça vira uma malha presa ao MESMO esqueleto do corpo.
 */
export { SLEEVE_EASE_FLOOR, SPECS, SUBCATEGORY_KINDS, armOutFor, kindOf, legFlareOffset, sleeveEase, specOf, type GarmentKind, type GarmentSpec } from "./garment-spec";
export { bodyParam, coverageOf, frontPanelCoverage, necklineH, type BodyParam, type GarmentGeometry } from "./garment-body";
export { sizeExtra, sizeRelief, sizeStepsAt } from "./garment-size-relief";
export { tubeRadius, underLayer, type SkirtTube, type UnderLayer } from "./garment-under-layer";
export { garmentGeometry, posedPositions } from "./garment-geometry";
export {
  BACKDROP_TOLERANCE, isBackdrop, photoInfo, photoMask, photoSleeves, srgbBytes,
  type PhotoInfo, type PhotoMask, type SleeveSource, type SleeveSpan,
} from "./garment-photo-info";
export { texturedGeometry } from "./garment-uv";
export { garmentTexture } from "./garment-texture";
export { fabricColor, ribColor, shoeColors, trimColors } from "./garment-colors";
export { fabricSurface, garmentMaterial } from "./garment-material";
export { HAS_COLLAR_BAND, collarBand, type CollarBand } from "./garment-collar";
