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
  serviceBuffet: { file: "serviceBuffet.glb", height: 0.95, fit: "height" },
  vestConsole: { file: "vestConsole.glb", height: 0.95, fit: "height" },
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
  terracoUrn: { file: "terracoUrn.glb", height: 0.63, fit: "height" },
  terracoFire: { file: "terracoFire.glb", height: 0.45, fit: "height" },
  terracoDrinks: { file: "terracoDrinks.glb", height: 1, fit: "footprint" },
  terracoTotem: { file: "terracoTotem.glb", height: 2.2, fit: "height" },
  sketchTable: { file: "sketchTable.glb", height: 1, fit: "footprint" },
  catalogStand: { file: "catalogStand.glb", height: 1.1, fit: "height" },
  restorationTable: { file: "restorationTable.glb", height: 1, fit: "footprint" },
  photoStation: { file: "photoStation.glb", height: 2, fit: "height" },
  flatFiles: { file: "flatFiles.glb", height: 1, fit: "footprint" },
  collectionCart: { file: "collectionCart.glb", height: 1.1, fit: "height" },
  srvRange: { file: "srvRange.glb", height: 2, fit: "height" },
  srvPrep: { file: "srvPrep.glb", height: 1, fit: "footprint" },
  srvPass: { file: "srvPass.glb", height: 1, fit: "footprint" },
  srvFridge: { file: "srvFridge.glb", height: 2, fit: "height" },
  srvDish: { file: "srvDish.glb", height: 1, fit: "footprint" },
  srvCart: { file: "srvCart.glb", height: 1, fit: "height" },
  srvGlassTower: { file: "srvGlassTower.glb", height: 1.6, fit: "height" },
  srvBar: { file: "srvBar.glb", height: 1, fit: "footprint" },
  srvShelving: { file: "srvShelving.glb", height: 1.8, fit: "height" },
  bkSewing: { file: "bkSewing.glb", height: 1, fit: "footprint" },
  bkAccCart: { file: "bkAccCart.glb", height: 1.1, fit: "height" },
  segRack: { file: "segRack.glb", height: 2, fit: "height" },
  segCoord: { file: "segCoord.glb", height: 1, fit: "footprint" },
  docaFlightCases: { file: "docaFlightCases.glb", height: 1, fit: "footprint" },
  docaPalletJack: { file: "docaPalletJack.glb", height: 1.2, fit: "height" },
  docaStacker: { file: "docaStacker.glb", height: 1.7, fit: "height" },
  docaShelf: { file: "docaShelf.glb", height: 1.5, fit: "height" },
  docaBooth: { file: "docaBooth.glb", height: 2.2, fit: "height" },
  docaBench: { file: "docaBench.glb", height: 1, fit: "footprint" },
  jewelVitrine: { file: "jewelVitrine.glb", height: 1.8, fit: "height" },
  srvHandSink: { file: "srvHandSink.glb", height: 1.1, fit: "height" },
  bkChair: { file: "bkChair.glb", height: 0.9, fit: "height" },
  bkCases: { file: "bkCases.glb", height: 1, fit: "footprint" },
  segCafe: { file: "segCafe.glb", height: 0.75, fit: "height" },
  docaPallets: { file: "docaPallets.glb", height: 1, fit: "footprint" },
  docaHotBoxes: { file: "docaHotBoxes.glb", height: 1.4, fit: "height" },
  docaFountain: { file: "docaFountain.glb", height: 1.2, fit: "height" },
  terracoCafeChair: { file: "terracoCafeChair.glb", height: 0.85, fit: "height" },
  terracoBistro: { file: "terracoBistro.glb", height: 0.75, fit: "height" },
  bin: { file: "bin.glb", height: 0.9, fit: "height" },
  meter: { file: "meter.glb", height: 1.4, fit: "height" },
  bikeRack: { file: "bikeRack.glb", height: 1, fit: "footprint" },
  becoDrum: { file: "becoDrum.glb", height: 0.9, fit: "height" },
  becoGasCage: { file: "becoGasCage.glb", height: 1, fit: "footprint" },
  becoJunk: { file: "becoJunk.glb", height: 1, fit: "footprint" },
  becoPallets: { file: "becoPallets.glb", height: 1, fit: "footprint" },
  becoRecycling: { file: "becoRecycling.glb", height: 1.2, fit: "height" },
  becoTrashPile: { file: "becoTrashPile.glb", height: 1, fit: "footprint" },
  becoTotem: { file: "becoTotem.glb", height: 2, fit: "height" },
};

/** Há GLB gerado para este `model`? (booleano simples, sem predicado de tipo: o ramo falso não deve estreitar `model`.) */
export const hasModel = (model: string | undefined): boolean => !!model && Object.prototype.hasOwnProperty.call(MODELS, model);
