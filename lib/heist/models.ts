/*
 * MET Gala Heist v2 — manifesto dos modelos 3D gerados (Meshy) que substituem o desenho procedural de um móvel próprio
 * da planta ("fixture" com `model`). GERADO por scripts/heist/meshy/run.mjs a partir de scripts/heist/meshy/briefs.json
 * e dos arquivos presentes em public/heist/models/: não edite à mão (rode `node scripts/heist/meshy/run.mjs --manifest`).
 *
 * Quem tem entrada aqui: a cena não desenha o móvel procedural (interior-props.ts, buildProp) e HeistModels
 * (components/heist/scene/models.tsx) carrega o GLB, ajusta a escala pela altura real ou pela pegada do móvel e o põe
 * no chão da sala, com a mesma colisão da planta.
 */
export interface ModelDef {
  /** arquivo em public/heist/models/ */
  file: string;
  /** altura real do objeto em metros (fit "height") */
  height: number;
  /** "height": escala pela altura; "footprint": escala para caber na pegada do móvel (largura × profundidade) */
  fit: "height" | "footprint";
  /** giro extra (rad) quando a frente do modelo gerado não olha para +z */
  yaw?: number;
  /** sobe o modelo (m) quando a base dele fica abaixo do chão */
  lift?: number;
}

export const MODELS: Record<string, ModelDef> = {};

/** Há GLB gerado para este `model`? (booleano simples, sem predicado de tipo: o ramo falso não deve estreitar `model`.) */
export const hasModel = (model: string | undefined): boolean => !!model && Object.prototype.hasOwnProperty.call(MODELS, model);
