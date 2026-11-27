/** Entrada do pacote de QA: o mesmo código do editor, exposto à página de teste (só usado pela bancada de QA). */
import { applyDocument, exportGlb, inspectGlb, loadGlb } from "../../../lib/atelier3d/document";
import { listParts } from "../../../lib/atelier3d/garment-parts";
import { decalsReady } from "../../../lib/atelier3d/decal-meshes";

Object.assign(window, { atelierQa: { applyDocument, exportGlb, inspectGlb, loadGlb, listParts, decalsReady } });
