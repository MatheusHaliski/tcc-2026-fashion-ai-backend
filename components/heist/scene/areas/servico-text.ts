/*
 * MET Gala Heist v2 — textos da área de serviço nos três idiomas do cenário (placas de zona, rotas, proibições,
 * quadros de pedidos, escala, drinques e temperatura) e o idioma do cenário a partir dos textos do interior.
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import { COPY, type InteriorCopy, type SceneLocale } from "../interior-copy";

export interface SrvText {
  copa: string; kitchen: string; dish: string; bar: string; cold: string; toHall: string; toDock: string; toSec: string; toKitchen: string;
  noSmoking: string; hairnet: string; handWash: string; wetFloor: [string, string]; hot: [string, string]; keepClear: string; extinguisher: string; hose: string;
  alarm: string; stageEntry: string; quickChange: string; wardrobe: string; makeup: string; production: string; monitoring: string; highVoltage: [string, string];
  orders: string[]; duty: string[]; drinks: string[]; temp: string[]; staffEntrance: string;
}
export const SRV_TEXT: Record<SceneLocale, SrvText> = {
  "pt-BR": {
    copa: "COPA DE MONTAGEM", kitchen: "COZINHA DO BUFÊ", dish: "LAVAGEM", bar: "BAR DE SERVIÇO", cold: "CÂMARA FRIA", toHall: "GRANDE SALÃO", toDock: "DOCA · SAÍDA", toSec: "SEGURANÇA", toKitchen: "COZINHA",
    noSmoking: "PROIBIDO FUMAR", hairnet: "USO OBRIGATÓRIO DE TOUCA", handWash: "LAVE AS MÃOS", wetFloor: ["CUIDADO", "PISO MOLHADO"], hot: ["ATENÇÃO", "SUPERFÍCIE QUENTE"],
    keepClear: "MANTENHA O CORREDOR LIVRE", extinguisher: "EXTINTOR", hose: "HIDRANTE", alarm: "ALARME DE INCÊNDIO", stageEntry: "ENTRADA DE CENA", quickChange: "TROCA RÁPIDA",
    wardrobe: "FIGURINO", makeup: "CAMARIM", production: "PRODUÇÃO", monitoring: "CENTRAL DE MONITORAMENTO", highVoltage: ["PERIGO", "ALTA TENSÃO"],
    orders: ["PEDIDOS · GALA LUMIÈRE", "22:00  canapés frios — 320", "22:30  mini risoto — 180", "23:00  sobremesas — 300", "bar: +6 cx espumante", "mesa 4: sem glúten!"],
    duty: ["ESCALA DE PLANTÃO", "Nunes — supervisor", "Rui — labirinto sul", "Otávio — duto / norte", "Cida — copa", "troca de turno 23:10"],
    drinks: ["DRINQUES DA NOITE", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho sem álcool"],
    temp: ["CONTROLE DE TEMPERATURA", "18h  2 °C   ok", "20h  3 °C   ok", "22h  3 °C   ok"], staffEntrance: "ACESSO DA EQUIPE",
  },
  en: {
    copa: "PLATING PANTRY", kitchen: "CATERING KITCHEN", dish: "DISHWASH", bar: "SERVICE BAR", cold: "WALK-IN COOLER", toHall: "GREAT HALL", toDock: "DOCK · EXIT", toSec: "SECURITY", toKitchen: "KITCHEN",
    noSmoking: "NO SMOKING", hairnet: "HAIR NETS REQUIRED", handWash: "WASH YOUR HANDS", wetFloor: ["CAUTION", "WET FLOOR"], hot: ["CAUTION", "HOT SURFACE"],
    keepClear: "KEEP CORRIDOR CLEAR", extinguisher: "FIRE EXTINGUISHER", hose: "FIRE HOSE", alarm: "FIRE ALARM", stageEntry: "STAGE ENTRANCE", quickChange: "QUICK CHANGE",
    wardrobe: "WARDROBE", makeup: "MAKEUP", production: "PRODUCTION", monitoring: "MONITORING CENTER", highVoltage: ["DANGER", "HIGH VOLTAGE"],
    orders: ["ORDERS · GALA LUMIÈRE", "22:00  cold canapés — 320", "22:30  mini risotto — 180", "23:00  desserts — 300", "bar: +6 cases bubbly", "table 4: gluten free!"],
    duty: ["DUTY ROSTER", "Nunes — supervisor", "Rui — south maze", "Otávio — vent / north", "Cida — pantry", "shift change 23:10"],
    drinks: ["TONIGHT'S DRINKS", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho (alcohol free)"],
    temp: ["TEMPERATURE LOG", "6 PM  2 °C  ok", "8 PM  3 °C  ok", "10 PM  3 °C  ok"], staffEntrance: "STAFF ENTRANCE",
  },
  es: {
    copa: "OFFICE DE MONTAJE", kitchen: "COCINA DEL CATERING", dish: "LAVADO", bar: "BAR DE SERVICIO", cold: "CÁMARA FRIGORÍFICA", toHall: "GRAN SALÓN", toDock: "MUELLE · SALIDA", toSec: "SEGURIDAD", toKitchen: "COCINA",
    noSmoking: "PROHIBIDO FUMAR", hairnet: "USO OBLIGATORIO DE COFIA", handWash: "LÁVESE LAS MANOS", wetFloor: ["CUIDADO", "PISO MOJADO"], hot: ["ATENCIÓN", "SUPERFICIE CALIENTE"],
    keepClear: "MANTENGA EL PASILLO LIBRE", extinguisher: "EXTINTOR", hose: "HIDRANTE", alarm: "ALARMA DE INCENDIO", stageEntry: "ENTRADA A ESCENA", quickChange: "CAMBIO RÁPIDO",
    wardrobe: "VESTUARIO", makeup: "MAQUILLAJE", production: "PRODUCCIÓN", monitoring: "CENTRAL DE MONITOREO", highVoltage: ["PELIGRO", "ALTA TENSIÓN"],
    orders: ["PEDIDOS · GALA LUMIÈRE", "22:00  canapés fríos — 320", "22:30  mini risotto — 180", "23:00  postres — 300", "bar: +6 cajas espumante", "mesa 4: ¡sin gluten!"],
    duty: ["TURNOS DE GUARDIA", "Nunes — supervisor", "Rui — laberinto sur", "Otávio — ducto / norte", "Cida — office", "cambio de turno 23:10"],
    drinks: ["TRAGOS DE LA NOCHE", "Lumière Spritz", "Aurora Sour", "Vesper Negroni", "Orvalho sin alcohol"],
    temp: ["CONTROL DE TEMPERATURA", "18h  2 °C   ok", "20h  3 °C   ok", "22h  3 °C   ok"], staffEntrance: "ACCESO DEL PERSONAL",
  },
};
/** Idioma do cenário a partir dos textos do interior que a montagem recebeu. */
export const localeOf = (copy: InteriorCopy): SceneLocale => (Object.keys(COPY) as SceneLocale[]).find((k) => COPY[k] === copy) ?? "pt-BR";
export const textOf = (copy: InteriorCopy): SrvText => SRV_TEXT[localeOf(copy)];
