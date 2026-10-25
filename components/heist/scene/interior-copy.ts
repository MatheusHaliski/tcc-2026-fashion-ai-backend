/*
 * MET Gala Heist v2 — textos DIEGÉTICOS do interior (cartazes, placas, a folha de chamada, o telão): fazem parte do
 * cenário, como a sinalização de um museu de verdade, e não da interface. Ficam aqui em três idiomas para que as três
 * pistas de jogo (o ano no cartaz do Aurora, os códigos da folha de chamada e a ordem dos símbolos na placa da Sala das
 * Joias) sejam legíveis por quem joga em português, inglês ou espanhol. Nomes próprios (Gala Lumière, Museu Vesper, Casa
 * Orvalho, Celine Dion) não mudam. Os números das pistas vêm de lib/heist/level.ts (CODES).
 */
import { CODES } from "@/lib/heist/level";

export type SceneLocale = "pt-BR" | "en" | "es";

export interface InteriorCopy {
  /** cartaz do salão (pista do teclado da doca: o ano) */
  posterKicker: string; posterTitle: string; posterHouse: string; posterYear: string; posterFoot: string;
  /** folha de chamada dos bastidores (pistas da porta da doca e do cofre da segurança) */
  sheetTitle: string; sheetDate: string; sheetRows: string[]; sheetNoteDock: string; sheetNoteSafe: string; sheetRadio: string;
  /** placa da exposição diante da vitrine (a ordem dos símbolos da vitrine do diamante) */
  placardKicker: string; placardTitle: string; placardLine: string; placardSeal: string; placardSymbols: [string, string, string];
  /** placas e sinalização */
  staffOnly: string; serviceCorridor: string; securityRoom: string; exit: string; jewelRoom: string; dock: string; backstage: string;
  silence: string; credentials: string; coatCheck: string; lounge: string; institute: string; restricted: string; jewelPlaque: string;
  exhibitTitle: string; exhibitSub: string; bannerA: string; bannerB: string; screenA: string; screenB: string; runOfShow: string[];
  caseLabels: string[];
}

const SAFE = `${CODES.safe.slice(0, 2)}/${CODES.safe.slice(2)}`;

export const COPY: Record<SceneLocale, InteriorCopy> = {
  "pt-BR": {
    posterKicker: "EXPOSIÇÃO", posterTitle: "VESTIDO AURORA", posterHouse: "CASA ORVALHO", posterYear: CODES.service, posterFoot: "Instituto do Traje · Museu Vesper",
    sheetTitle: "GALA LUMIÈRE — FOLHA DE CHAMADA", sheetDate: "Sábado · 21h00 · Museu Vesper",
    sheetRows: ["21:30  Abertura do tapete", "22:15  Quarteto no Grande Salão", "22:45  Apresentação no palco leste", "23:10  Troca de turno da segurança", "23:30  Desfile final — Vestido Aurora"],
    sheetNoteDock: "Porta da doca: o ano do Aurora", sheetNoteSafe: `Cofre da segurança: ${SAFE}`, sheetRadio: "Equipe no rádio, canal 3",
    placardKicker: "SALA DAS JOIAS", placardTitle: "Diamante da coleção de Celine Dion", placardLine: "Avaliado em US$ 15 mil · empréstimo para a Gala Lumière",
    placardSeal: "Lacre da vitrine", placardSymbols: ["ESTRELA", "LUA", "COROA"],
    staffOnly: "SOMENTE FUNCIONÁRIOS", serviceCorridor: "CORREDOR DE SERVIÇO", securityRoom: "SALA DE SEGURANÇA", exit: "SAÍDA", jewelRoom: "SALA DAS JOIAS",
    dock: "DOCA DE CARGA", backstage: "BASTIDORES", silence: "SILÊNCIO · SHOW EM ANDAMENTO", credentials: "CREDENCIAMENTO", coatCheck: "CHAPELARIA",
    lounge: "LOUNGE · BAR", institute: "INSTITUTO DO TRAJE", restricted: "ACESSO RESTRITO", jewelPlaque: "Coleção particular · peças emprestadas",
    exhibitTitle: "AURORA", exhibitSub: "A ARTE DO VESTIDO", bannerA: "GALA LUMIÈRE", bannerB: "AURORA", screenA: "GALA LUMIÈRE", screenB: "AURORA · A ARTE DO VESTIDO",
    runOfShow: ["ROTEIRO DO SHOW", "22:45  Abertura", "23:00  Coleção Orvalho", "23:30  Vestido Aurora", "23:45  Agradecimentos"],
    caseLabels: ["Vestido Aurora (réplica de exposição) · 1957", "Coluna de veludo · 1962", "Tule carmim · 1959", "Chapéus e luvas · 1955–1960"],
  },
  en: {
    posterKicker: "EXHIBITION", posterTitle: "THE AURORA GOWN", posterHouse: "CASA ORVALHO", posterYear: CODES.service, posterFoot: "Costume Institute · Vesper Museum",
    sheetTitle: "GALA LUMIÈRE — CALL SHEET", sheetDate: "Saturday · 9 PM · Vesper Museum",
    sheetRows: ["21:30  Carpet opens", "22:15  String quartet, Great Hall", "22:45  East stage presentation", "23:10  Security shift change", "23:30  Finale — the Aurora gown"],
    sheetNoteDock: "Dock door: the Aurora's year", sheetNoteSafe: `Security safe: ${SAFE}`, sheetRadio: "Crew on radio, channel 3",
    placardKicker: "JEWEL ROOM", placardTitle: "Diamond from Celine Dion's collection", placardLine: "Valued at US$ 15,000 · on loan for the Gala Lumière",
    placardSeal: "Display case seal", placardSymbols: ["STAR", "MOON", "CROWN"],
    staffOnly: "STAFF ONLY", serviceCorridor: "SERVICE CORRIDOR", securityRoom: "SECURITY ROOM", exit: "EXIT", jewelRoom: "JEWEL ROOM",
    dock: "LOADING DOCK", backstage: "BACKSTAGE", silence: "QUIET · SHOW IN PROGRESS", credentials: "CHECK-IN", coatCheck: "COAT CHECK",
    lounge: "LOUNGE · BAR", institute: "COSTUME INSTITUTE", restricted: "RESTRICTED ACCESS", jewelPlaque: "Private collection · pieces on loan",
    exhibitTitle: "AURORA", exhibitSub: "THE ART OF THE GOWN", bannerA: "GALA LUMIÈRE", bannerB: "AURORA", screenA: "GALA LUMIÈRE", screenB: "AURORA · THE ART OF THE GOWN",
    runOfShow: ["RUN OF SHOW", "22:45  Opening", "23:00  Orvalho collection", "23:30  The Aurora gown", "23:45  Thanks"],
    caseLabels: ["The Aurora gown (exhibition replica) · 1957", "Velvet column · 1962", "Crimson tulle · 1959", "Hats and gloves · 1955–1960"],
  },
  es: {
    posterKicker: "EXPOSICIÓN", posterTitle: "VESTIDO AURORA", posterHouse: "CASA ORVALHO", posterYear: CODES.service, posterFoot: "Instituto del Traje · Museo Vesper",
    sheetTitle: "GALA LUMIÈRE — HOJA DE LLAMADO", sheetDate: "Sábado · 21:00 · Museo Vesper",
    sheetRows: ["21:30  Apertura de la alfombra", "22:15  Cuarteto en el Gran Salón", "22:45  Presentación en el escenario este", "23:10  Cambio de turno de seguridad", "23:30  Desfile final — Vestido Aurora"],
    sheetNoteDock: "Puerta del muelle: el año del Aurora", sheetNoteSafe: `Caja fuerte de seguridad: ${SAFE}`, sheetRadio: "Equipo en la radio, canal 3",
    placardKicker: "SALA DE LAS JOYAS", placardTitle: "Diamante de la colección de Celine Dion", placardLine: "Valuado en US$ 15 mil · préstamo para la Gala Lumière",
    placardSeal: "Sello de la vitrina", placardSymbols: ["ESTRELLA", "LUNA", "CORONA"],
    staffOnly: "SOLO PERSONAL", serviceCorridor: "PASILLO DE SERVICIO", securityRoom: "SALA DE SEGURIDAD", exit: "SALIDA", jewelRoom: "SALA DE LAS JOYAS",
    dock: "MUELLE DE CARGA", backstage: "BASTIDORES", silence: "SILENCIO · SHOW EN CURSO", credentials: "ACREDITACIÓN", coatCheck: "GUARDARROPA",
    lounge: "LOUNGE · BAR", institute: "INSTITUTO DEL TRAJE", restricted: "ACCESO RESTRINGIDO", jewelPlaque: "Colección particular · piezas en préstamo",
    exhibitTitle: "AURORA", exhibitSub: "EL ARTE DEL VESTIDO", bannerA: "GALA LUMIÈRE", bannerB: "AURORA", screenA: "GALA LUMIÈRE", screenB: "AURORA · EL ARTE DEL VESTIDO",
    runOfShow: ["GUION DEL SHOW", "22:45  Apertura", "23:00  Colección Orvalho", "23:30  Vestido Aurora", "23:45  Agradecimientos"],
    caseLabels: ["Vestido Aurora (réplica de exposición) · 1957", "Columna de terciopelo · 1962", "Tul carmesí · 1959", "Sombreros y guantes · 1955–1960"],
  },
};

/** Idioma do cenário: o informado ou o do documento (o I18nProvider escreve em <html lang>). */
export function sceneLocale(given?: string | null): SceneLocale {
  const l = (given ?? (typeof document !== "undefined" ? document.documentElement.lang : "") ?? "").toLowerCase();
  return l.startsWith("en") ? "en" : l.startsWith("es") ? "es" : "pt-BR";
}
