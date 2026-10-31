/*
 * MET Gala Heist v2 — textos da rua desenhados nas texturas, por idioma (como interior-copy.ts faz para as salas):
 * os 16 panfletos da calçada (shows, festas, a própria gala, achados e perdidos). Nomes próprios fictícios (lugares,
 * bandas, lojas) ficam iguais nos três idiomas; o resto é traduzido. A ordem é a do atlas (exterior-citytex.ts).
 */
import type { SceneLocale } from "./interior-copy";

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
