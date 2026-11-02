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

export const MODELS: Record<string, ModelDef> = {
  djBooth: { file: "djBooth.glb", height: 1.15, fit: "height" },
  djSpeaker: { file: "djSpeaker.glb", height: 2.2, fit: "height" },
  dessertTable: { file: "dessertTable.glb", height: 1, fit: "footprint" },
  buffetTable: { file: "buffetTable.glb", height: 1, fit: "footprint" },
  patronTable: { file: "patronTable.glb", height: 1, fit: "footprint" },
  serviceBuffet: { file: "serviceBuffet.glb", height: 1, fit: "footprint" },
  vestConsole: { file: "vestConsole.glb", height: 1, fit: "footprint" },
  vestFloral: { file: "vestFloral.glb", height: 2.2, fit: "height" },
  monumentalVase: { file: "monumentalVase.glb", height: 1.7, fit: "height" },
  stoneBench: { file: "stoneBench.glb", height: 1, fit: "footprint" },
  valetStand: { file: "valetStand.glb", height: 1.2, fit: "height" },
  newsstand: { file: "newsstand.glb", height: 2.4, fit: "height" },
  loungeArmchair: { file: "loungeArmchair.glb", height: 0.85, fit: "height" },
  loungeCoffee: { file: "loungeCoffee.glb", height: 1, fit: "footprint" },
  loungeStool: { file: "loungeStool.glb", height: 0.75, fit: "height" },
  loungeScreen: { file: "loungeScreen.glb", height: 1.8, fit: "height" },
  terracoBed: { file: "terracoBed.glb", height: 1, fit: "footprint" },
  terracoChair: { file: "terracoChair.glb", height: 0.8, fit: "height" },
  terracoUrn: { file: "terracoUrn.glb", height: 1.3, fit: "height" },
  terracoFire: { file: "terracoFire.glb", height: 0.45, fit: "height" },
  terracoDrinks: { file: "terracoDrinks.glb", height: 1, fit: "footprint" },
  terracoTotem: { file: "terracoTotem.glb", height: 2.2, fit: "height" },
};

export const hasModel = (model: string | undefined): model is string => !!model && Object.prototype.hasOwnProperty.call(MODELS, model);
