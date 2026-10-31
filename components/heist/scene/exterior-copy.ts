/*
 * MET Gala Heist v2 — textos da rua desenhados nas texturas, por idioma (como interior-copy.ts faz para as salas):
 * os 16 panfletos da calçada (shows, festas, a própria gala, achados e perdidos). Nomes próprios fictícios (lugares,
 * bandas, lojas) ficam iguais nos três idiomas; o resto é traduzido. A ordem é a do atlas (exterior-citytex.ts).
 */
import type { SceneLocale } from "./interior-copy";

/** Letreiros, placas, faixas, cartazes e inscrições pintados na rua (nomes ficcionais do mundo do jogo). */
export interface Signage {
  gala: string; year: string; date: string; museum: string; institute: string; aurora: string; auroraHouse: string; exhibit: string;
  restricted: string; caterer: string; catererSub: string; police: string; dock: string; staffOnly: string; exit: string;
  vendor: string; vendorSub: string; vendorTag: string; avenue: string; street: string; closed: string; fans: string[];
  invite: string; reception: string; press: string; service: string; serviceArrow: string; noParking: string; queue: string; alley: string;
  /** ponto de ônibus, banca, placa de estacionamento, manobrista, totem, mapa da linha, inscrição e placas de bronze */
  busStop: string; busLines: string; kiosk: string; kioskSub: string; noParkingSub: string; tow: string; valet: string; guests: string;
  routeTitle: string; youAreHere: string; inscription: string; founded: string; museumTag: string; galaEntrance: string; inviteOnly: string;
  /** quadro da padaria (interior da loja) */
  bakeryBoard: string;
}

export const SIGNAGE_COPY: Record<SceneLocale, Signage> = {
  "pt-BR": {
    gala: "GALA LUMIÈRE", year: "2026", date: "04 · 12 · 2026", museum: "MUSEU VESPER", institute: "INSTITUTO DO TRAJE",
    aurora: "AURORA", auroraHouse: "CASA ORVALHO · 1957", exhibit: "EXPOSIÇÃO", restricted: "ÁREA RESTRITA · CREDENCIADOS",
    caterer: "BUFÊ LUMIÈRE", catererSub: "ALTA GASTRONOMIA PARA EVENTOS", police: "POLÍCIA", dock: "DOCA · ENTREGAS", staffOnly: "SOMENTE FUNCIONÁRIOS",
    exit: "SAÍDA DE EMERGÊNCIA", vendor: "ACHADOS DE GRIFE", vendorSub: "COMPRO · TROCO · VENDO", vendorTag: "SEM PERGUNTAS",
    avenue: "AV. VESPER", street: "R. ORVALHO", closed: "VIA INTERDITADA", fans: ["ÍCONE ✦", "OLHA PRA CÁ!", "LENDA", "TE AMO ♥", "MUSA", "BRILHA!"],
    invite: "ACESSO SOMENTE COM CONVITE", reception: "RECEPÇÃO", press: "IMPRENSA CREDENCIADA", service: "ENTRADA DE SERVIÇO", serviceArrow: "◀", noParking: "PROIBIDO ESTACIONAR",
    queue: "FILA DE CONVIDADOS", alley: "BECO · ACESSO RESTRITO",
    busStop: "PONTO DE ÔNIBUS", busLines: "207 · 315 · 422 · NOTURNO N12", kiosk: "BANCA DA AVENIDA", kioskSub: "JORNAIS · REVISTAS · CIGARROS · BALAS",
    noParkingSub: "EVENTO · 18H ÀS 4H", tow: "GUINCHO", valet: "MANOBRISTA", guests: "CONVIDADOS", routeTitle: "LINHAS NOTURNAS", youAreHere: "VOCÊ ESTÁ AQUI",
    inscription: "MUSEU VESPER · MCMXXXI", founded: "FUNDADO EM MCMXXXI", museumTag: "ARTE · TRAJE · CIDADE", galaEntrance: "GALA LUMIÈRE · ENTRADA", inviteOnly: "SOMENTE COM CONVITE",
    bakeryBoard: "PÃES · DOCES · CAFÉ",
  },
  en: {
    gala: "GALA LUMIÈRE", year: "2026", date: "12 · 04 · 2026", museum: "VESPER MUSEUM", institute: "COSTUME INSTITUTE",
    aurora: "AURORA", auroraHouse: "CASA ORVALHO · 1957", exhibit: "EXHIBITION", restricted: "RESTRICTED AREA · CREDENTIALS ONLY",
    caterer: "LUMIÈRE CATERING", catererSub: "FINE DINING FOR EVENTS", police: "POLICE", dock: "DOCK · DELIVERIES", staffOnly: "STAFF ONLY",
    exit: "EMERGENCY EXIT", vendor: "DESIGNER FINDS", vendorSub: "BUY · TRADE · SELL", vendorTag: "NO QUESTIONS",
    avenue: "VESPER AVE", street: "ORVALHO ST", closed: "ROAD CLOSED", fans: ["ICON ✦", "LOOK HERE!", "LEGEND", "LOVE YOU ♥", "MUSE", "SHINE!"],
    invite: "ADMISSION BY INVITATION ONLY", reception: "RECEPTION", press: "ACCREDITED PRESS", service: "SERVICE ENTRANCE", serviceArrow: "◀", noParking: "NO PARKING",
    queue: "GUEST LINE", alley: "ALLEY · RESTRICTED ACCESS",
    busStop: "BUS STOP", busLines: "207 · 315 · 422 · NIGHT N12", kiosk: "AVENUE NEWSSTAND", kioskSub: "NEWSPAPERS · MAGAZINES · CIGARETTES · CANDY",
    noParkingSub: "EVENT · 6 PM TO 4 AM", tow: "TOW-AWAY ZONE", valet: "VALET", guests: "GUESTS", routeTitle: "NIGHT LINES", youAreHere: "YOU ARE HERE",
    inscription: "VESPER MUSEUM · MCMXXXI", founded: "FOUNDED MCMXXXI", museumTag: "ART · COSTUME · CITY", galaEntrance: "GALA LUMIÈRE · ENTRANCE", inviteOnly: "INVITATION ONLY",
    bakeryBoard: "BREAD · PASTRIES · COFFEE",
  },
  es: {
    gala: "GALA LUMIÈRE", year: "2026", date: "04 · 12 · 2026", museum: "MUSEO VESPER", institute: "INSTITUTO DEL TRAJE",
    aurora: "AURORA", auroraHouse: "CASA ORVALHO · 1957", exhibit: "EXPOSICIÓN", restricted: "ÁREA RESTRINGIDA · ACREDITADOS",
    caterer: "CATERING LUMIÈRE", catererSub: "ALTA GASTRONOMÍA PARA EVENTOS", police: "POLICÍA", dock: "MUELLE · ENTREGAS", staffOnly: "SOLO PERSONAL",
    exit: "SALIDA DE EMERGENCIA", vendor: "HALLAZGOS DE FIRMA", vendorSub: "COMPRO · CAMBIO · VENDO", vendorTag: "SIN PREGUNTAS",
    avenue: "AV. VESPER", street: "C. ORVALHO", closed: "VÍA CORTADA", fans: ["ÍCONO ✦", "¡MIRA AQUÍ!", "LEYENDA", "TE AMO ♥", "MUSA", "¡BRILLA!"],
    invite: "ACCESO SOLO CON INVITACIÓN", reception: "RECEPCIÓN", press: "PRENSA ACREDITADA", service: "ENTRADA DE SERVICIO", serviceArrow: "◀", noParking: "PROHIBIDO APARCAR",
    queue: "FILA DE INVITADOS", alley: "CALLEJÓN · ACCESO RESTRINGIDO",
    busStop: "PARADA DE AUTOBÚS", busLines: "207 · 315 · 422 · NOCTURNO N12", kiosk: "QUIOSCO DE LA AVENIDA", kioskSub: "PERIÓDICOS · REVISTAS · CIGARRILLOS · CARAMELOS",
    noParkingSub: "EVENTO · 18H A 4H", tow: "GRÚA", valet: "APARCACOCHES", guests: "INVITADOS", routeTitle: "LÍNEAS NOCTURNAS", youAreHere: "USTED ESTÁ AQUÍ",
    inscription: "MUSEO VESPER · MCMXXXI", founded: "FUNDADO EN MCMXXXI", museumTag: "ARTE · TRAJE · CIUDAD", galaEntrance: "GALA LUMIÈRE · ENTRADA", inviteOnly: "SOLO CON INVITACIÓN",
    bakeryBoard: "PANES · DULCES · CAFÉ",
  },
};

export interface FlyerCopy { title: string; lines: string[] }
/** Letreiro de cada loja da quadra (nome e subtítulo); a chave é o `kind` de STORES em exterior-citytex.ts. */
export interface StoreCopy { name: string; sub?: string }

export const STORE_COPY: Record<SceneLocale, Record<string, StoreCopy>> = {
  "pt-BR": {
    fashion: { name: "MAISON VERANE", sub: "ALTA COSTURA · PRÊT-À-PORTER" }, jewelry: { name: "OPALINE", sub: "JOALHERIA" }, cafe: { name: "Café Lumen" },
    pharmacy: { name: "FARMÁCIA AVENIDA", sub: "24 HORAS" }, books: { name: "LIVRARIA VESPERTINA", sub: "LIVROS · DISCOS · CAFÉ" },
    bakery: { name: "PADARIA ESTRELA", sub: "DESDE 1931" }, florist: { name: "ÍRIS FLORES" }, bistro: { name: "BISTRÔ 1957" },
    bar: { name: "BAR ALVORADA" }, shoes: { name: "SAPATARIA PRIMA" }, perfume: { name: "ÉTER", sub: "PERFUMARIA" },
    optics: { name: "ÓTICA CLARIDADE" }, gallery: { name: "GALERIA NOVE" }, lobby: { name: "EDIFÍCIO SERENO" },
    closed: { name: "ALUGA-SE", sub: "TRATAR NO LOCAL" }, atelier: { name: "ATELIÊ NOIVAS DO PARQUE" },
  },
  en: {
    fashion: { name: "MAISON VERANE", sub: "HAUTE COUTURE · PRÊT-À-PORTER" }, jewelry: { name: "OPALINE", sub: "JEWELLERY" }, cafe: { name: "Café Lumen" },
    pharmacy: { name: "AVENUE PHARMACY", sub: "OPEN 24 HOURS" }, books: { name: "VESPERTINA BOOKS", sub: "BOOKS · RECORDS · CAFÉ" },
    bakery: { name: "ESTRELA BAKERY", sub: "SINCE 1931" }, florist: { name: "ÍRIS FLOWERS" }, bistro: { name: "BISTRO 1957" },
    bar: { name: "BAR ALVORADA" }, shoes: { name: "PRIMA SHOES" }, perfume: { name: "ÉTER", sub: "PERFUMERY" },
    optics: { name: "CLARIDADE OPTICS" }, gallery: { name: "GALLERY NINE" }, lobby: { name: "SERENO BUILDING" },
    closed: { name: "FOR RENT", sub: "INQUIRE WITHIN" }, atelier: { name: "PARK BRIDAL ATELIER" },
  },
  es: {
    fashion: { name: "MAISON VERANE", sub: "ALTA COSTURA · PRÊT-À-PORTER" }, jewelry: { name: "OPALINE", sub: "JOYERÍA" }, cafe: { name: "Café Lumen" },
    pharmacy: { name: "FARMACIA AVENIDA", sub: "24 HORAS" }, books: { name: "LIBRERÍA VESPERTINA", sub: "LIBROS · DISCOS · CAFÉ" },
    bakery: { name: "PANADERÍA ESTRELA", sub: "DESDE 1931" }, florist: { name: "ÍRIS FLORES" }, bistro: { name: "BISTRÓ 1957" },
    bar: { name: "BAR ALVORADA" }, shoes: { name: "ZAPATERÍA PRIMA" }, perfume: { name: "ÉTER", sub: "PERFUMERÍA" },
    optics: { name: "ÓPTICA CLARIDADE" }, gallery: { name: "GALERÍA NUEVE" }, lobby: { name: "EDIFICIO SERENO" },
    closed: { name: "SE ALQUILA", sub: "RAZÓN AQUÍ" }, atelier: { name: "ATELIER NOVIAS DEL PARQUE" },
  },
};

export const FLYER_COPY: Record<SceneLocale, FlyerCopy[]> = {
  "pt-BR": [
    { title: "FESTA NEON", lines: ["SÁBADO · 23H", "CLUBE SUBSOLO", "DJ ÍRIS · DJ KOBALT"] },
    { title: "Noite de Jazz", lines: ["QUINTETO ALVORADA", "SEX · 22H · BAR ALVORADA"] },
    { title: "GALA LUMIÈRE", lines: ["PROGRAMA DA NOITE", "MUSEU VESPER · 04.12"] },
    { title: "LIQUIDAÇÃO", lines: ["ATÉ 70% OFF", "SAPATARIA PRIMA"] },
    { title: "AULAS DE TANGO", lines: ["INICIANTES · TER E QUI", "ESTÚDIO 3º ANDAR"] },
    { title: "PROCURA-SE", lines: ["GATO CINZA · MIMI", "RECOMPENSA"] },
    { title: "AS VESPERTINAS", lines: ["TURNÊ DE INVERNO", "TEATRO ORVALHO · 21H"] },
    { title: "FEIRA DE VINIL", lines: ["DOMINGO NA PRAÇA", "ENTRADA LIVRE"] },
    { title: "CIRCO ESTRELA", lines: ["ÚLTIMA SEMANA", "LONA DO PARQUE"] },
    { title: "AURORA", lines: ["EXPOSIÇÃO · CASA ORVALHO", "MUSEU VESPER"] },
    { title: "CORRIDA 5K", lines: ["NOTURNA · 15/11", "INSCRIÇÕES ABERTAS"] },
    { title: "Ateliê Noivas", lines: ["PROVA SEM HORA MARCADA", "AV. VESPER, 210"] },
    { title: "O BAILE", lines: ["UMA PEÇA EM 3 ATOS", "ESTREIA DIA 20"] },
    { title: "AULA DE YOGA", lines: ["NO TERRAÇO · 7H", "PRIMEIRA AULA GRÁTIS"] },
    { title: "SHOW PUNK", lines: ["OS SEM NOME", "GARAGEM · 20H"] },
    { title: "Pão de Queijo", lines: ["SAINDO AGORA!", "PADARIA ESTRELA"] },
  ],
  en: [
    { title: "NEON PARTY", lines: ["SATURDAY · 11PM", "CLUB SUBSOLO", "DJ ÍRIS · DJ KOBALT"] },
    { title: "Jazz Night", lines: ["ALVORADA QUINTET", "FRI · 10PM · BAR ALVORADA"] },
    { title: "GALA LUMIÈRE", lines: ["TONIGHT'S PROGRAM", "VESPER MUSEUM · 12.04"] },
    { title: "CLEARANCE", lines: ["UP TO 70% OFF", "PRIMA SHOES"] },
    { title: "TANGO CLASSES", lines: ["BEGINNERS · TUE & THU", "STUDIO, 3RD FLOOR"] },
    { title: "MISSING", lines: ["GREY CAT · MIMI", "REWARD"] },
    { title: "AS VESPERTINAS", lines: ["WINTER TOUR", "ORVALHO THEATRE · 9PM"] },
    { title: "VINYL FAIR", lines: ["SUNDAY AT THE SQUARE", "FREE ENTRY"] },
    { title: "CIRCO ESTRELA", lines: ["LAST WEEK", "PARK BIG TOP"] },
    { title: "AURORA", lines: ["EXHIBITION · CASA ORVALHO", "VESPER MUSEUM"] },
    { title: "5K RUN", lines: ["NIGHT RUN · NOV 15", "SIGN-UP OPEN"] },
    { title: "Ateliê Noivas", lines: ["FITTINGS, NO APPOINTMENT", "210 VESPER AVE"] },
    { title: "THE BALL", lines: ["A PLAY IN 3 ACTS", "OPENS ON THE 20TH"] },
    { title: "YOGA CLASS", lines: ["ON THE ROOFTOP · 7AM", "FIRST CLASS FREE"] },
    { title: "PUNK SHOW", lines: ["THE NAMELESS", "GARAGE · 8PM"] },
    { title: "Fresh Cheese Bread", lines: ["OUT OF THE OVEN NOW!", "ESTRELA BAKERY"] },
  ],
  es: [
    { title: "FIESTA NEÓN", lines: ["SÁBADO · 23H", "CLUB SUBSOLO", "DJ ÍRIS · DJ KOBALT"] },
    { title: "Noche de Jazz", lines: ["QUINTETO ALVORADA", "VIE · 22H · BAR ALVORADA"] },
    { title: "GALA LUMIÈRE", lines: ["PROGRAMA DE LA NOCHE", "MUSEO VESPER · 04.12"] },
    { title: "LIQUIDACIÓN", lines: ["HASTA 70% DTO.", "ZAPATERÍA PRIMA"] },
    { title: "CLASES DE TANGO", lines: ["PRINCIPIANTES · MAR Y JUE", "ESTUDIO 3.ª PLANTA"] },
    { title: "SE BUSCA", lines: ["GATO GRIS · MIMI", "RECOMPENSA"] },
    { title: "AS VESPERTINAS", lines: ["GIRA DE INVIERNO", "TEATRO ORVALHO · 21H"] },
    { title: "FERIA DE VINILO", lines: ["DOMINGO EN LA PLAZA", "ENTRADA LIBRE"] },
    { title: "CIRCO ESTRELA", lines: ["ÚLTIMA SEMANA", "CARPA DEL PARQUE"] },
    { title: "AURORA", lines: ["EXPOSICIÓN · CASA ORVALHO", "MUSEO VESPER"] },
    { title: "CARRERA 5K", lines: ["NOCTURNA · 15/11", "INSCRIPCIONES ABIERTAS"] },
    { title: "Ateliê Noivas", lines: ["PRUEBAS SIN CITA", "AV. VESPER, 210"] },
    { title: "EL BAILE", lines: ["UNA OBRA EN 3 ACTOS", "ESTRENO EL DÍA 20"] },
    { title: "CLASE DE YOGA", lines: ["EN LA TERRAZA · 7H", "PRIMERA CLASE GRATIS"] },
    { title: "CONCIERTO PUNK", lines: ["LOS SIN NOMBRE", "GARAJE · 20H"] },
    { title: "Pan de Queso", lines: ["¡RECIÉN HECHO!", "PANADERÍA ESTRELA"] },
  ],
};
