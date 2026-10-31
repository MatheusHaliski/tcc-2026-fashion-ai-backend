/*
 * MET Gala Heist v2 — textos DIEGÉTICOS do Instituto do Traje e da Sala das Joias (paredes da exposição, etiquetas das
 * vitrines, legendas, fichas de conservação): desenhados nas texturas da área, nos três idiomas do cenário. Tudo é
 * ficção (Casa Orvalho, Museu Vesper, exposição "Aurora"); o ano do Aurora vem de CODES (a pista da porta da doca).
 */
import { CODES } from "@/lib/heist/level";
import type { Lang } from "./galeria-kit";

const Y = CODES.service;

/** Etiqueta de museu: número, título, autoria e data, materiais e crédito. */
export interface Label { n: string; title: string; by: string; mat: string; credit: string }

export interface GalCopy {
  /** textos de parede por seção (título em caixa alta, parágrafo) */
  intro: { kicker: string; title: string; sub: string; body: string; foot: string };
  s1: { title: string; body: string }; s2: { title: string; body: string }; s3: { title: string; body: string };
  credits: string[];
  /** legendas em vinil no alto dos arcos das vitrines de parede */
  arches: [string, string, string, string];
  /** etiquetas (ordem: aurora, veludo, tule, parede ×4, colar, croquis, pétalas, plissê, estátua ×2, catálogo, audioguia) */
  labels: Label[];
  catalog: string; audio: string; terrace: string; handle: string;
  /** Sala das Joias: placa da conservação, ficha de laudo, gavetas, caixas e etiquetas das vitrines de parede */
  conservation: string; report: { title: string; rows: string[] }; drawers: string; box: string; jewels: [string, string, string, string]; pedestal: string;
}

export const GAL_COPY: Record<Lang, GalCopy> = {
  pt: {
    intro: { kicker: "INSTITUTO DO TRAJE APRESENTA", title: "AURORA", sub: "A ARTE DO VESTIDO",
      body: `Em ${Y}, a Casa Orvalho levou à passarela um vestido de baile que mudou a maneira de vestir a noite: onze camadas de tule tingidas à mão, do lilás ao dourado, como o céu um instante antes do amanhecer. A exposição reúne o vestido, os croquis do ateliê, as joias que o acompanharam e os acessórios que completavam o traje de gala.`,
      foot: "Instituto do Traje · Museu Vesper" },
    s1: { title: "I · O ATELIÊ", body: "Antes do tecido, o traço. Croquis a grafite e aquarela, amostras presas com alfinete e anotações de prova mostram como uma ideia vira molde, toile e, por fim, vestido. Cada peça desta sala passou por dezenas de provas." },
    s2: { title: "II · O VESTIDO AURORA", body: "Quarenta metros de tule de seda, onze camadas e mais de três mil cristais bordados à mão. O original, frágil demais para viajar, descansa na reserva técnica; aqui está a réplica de exposição, feita com os moldes da Casa Orvalho." },
    s3: { title: "III · JOIAS DA NOITE", body: "Nenhum traje de gala termina no vestido. Tiaras, colares e brincos desenhados a guache sobre papel cinza — e as peças que eles inspiraram. As joias emprestadas para esta noite estão guardadas na Sala das Joias, ao lado." },
    credits: ["CURADORIA", "Instituto do Traje", "PROJETO EXPOGRÁFICO", "Ateliê Vesper", "CONSERVAÇÃO", "Laboratório de Têxteis do Museu Vesper", "AGRADECIMENTOS", "Casa Orvalho e colecionadores particulares"],
    arches: ["Chapéus de noite · 1955–1960", "Luvas e bolsas · 1955–1960", "Leques e sapatos · 1950–1962", "Chapéus e véus · 1956"],
    labels: [
      { n: "07", title: "Vestido Aurora", by: `Casa Orvalho, ${Y} · réplica de exposição`, mat: "Tule de seda tingido à mão, cetim, cristais bordados", credit: "Coleção Instituto do Traje" },
      { n: "12", title: "Coluna de veludo", by: "Casa Orvalho, 1962", mat: "Veludo de seda, luvas de cetim, estola de pele sintética", credit: "Doação de colecionador particular" },
      { n: "09", title: "Tule carmim", by: "Casa Orvalho, 1959", mat: "Tule de seda em babados, corpete drapeado", credit: "Coleção Instituto do Traje" },
      { n: "04", title: "Chapéus de noite", by: "Ateliês diversos, 1955–1960", mat: "Feltro, palha de seda, fita de gorgorão", credit: "Coleção Instituto do Traje" },
      { n: "05", title: "Luvas e bolsas", by: "Casa Orvalho, 1955–1960", mat: "Pelica, cetim, fecho de latão", credit: "Coleção Instituto do Traje" },
      { n: "06", title: "Leques e sapatos", by: "Ateliês diversos, 1950–1962", mat: "Seda pintada, madrepérola, cetim", credit: "Empréstimo de coleção particular" },
      { n: "08", title: "Chapéus e véus", by: "Casa Orvalho, 1956", mat: "Tule, veludo, alfinetes de strass", credit: "Coleção Instituto do Traje" },
      { n: "15", title: "Colar Alvorada", by: `Desenho de joalheria, ${Y}`, mat: "Ouro branco, brilhantes e safiras rosadas (réplica)", credit: "Empréstimo de coleção particular" },
      { n: "03", title: "Mesa de croquis", by: "Ateliê Orvalho, 1955–1957", mat: "Grafite e aquarela sobre papel; amostras de tule, cetim e veludo", credit: "Arquivo da Casa Orvalho" },
      { n: "18", title: "Vestido-escultura «Pétalas»", by: "Ateliê Vesper, 2024", mat: "Latão dourado, malha de aço, seda", credit: "Comissionado para a exposição" },
      { n: "19", title: "Vestido-escultura «Plissê»", by: "Ateliê Vesper, 2024", mat: "Papel de seda plissado sobre tule", credit: "Comissionado para a exposição" },
      { n: "01", title: "Figura drapeada", by: "Cópia em gesso de original clássico", mat: "O drapeado antigo, origem do vestido de noite", credit: "Gipsoteca do Museu Vesper" },
      { n: "02", title: "Figura com braço erguido", by: "Cópia em gesso de original clássico", mat: "O gesto da passarela já estava no mármore", credit: "Gipsoteca do Museu Vesper" },
      { n: "", title: "Catálogo da exposição", by: "Aurora · a arte do vestido", mat: "Consulte aqui; à venda na loja do museu", credit: "Instituto do Traje" },
      { n: "", title: "Audioguia", by: "Peças 01 a 19 · português, inglês e espanhol", mat: "Retire os fones e digite o número da etiqueta", credit: "Instituto do Traje" },
    ],
    catalog: "CATÁLOGO", audio: "AUDIOGUIA", terrace: "TERRAÇO · JARDIM", handle: "NÃO TOQUE NAS VITRINES",
    conservation: "CONSERVAÇÃO · MANUSEIE SÓ COM LUVAS", report: { title: "LAUDO DE CONSERVAÇÃO", rows: ["Peça: tiara de brilhantes", "Entrada: empréstimo · lote 07", "Estado geral: bom", "Engastes: 2 frouxos (ver foto 3)", "Limpeza: só pincel macio", "Umidade: 45 % · 19 °C", "Conservadora: R. Amaral"] },
    drawers: "GAVETA", box: "LIVRE DE ÁCIDO", jewels: ["Tiaras · c. 1910–1930", "Colares de pérolas", "Brincos e broches", "Anéis de noite"], pedestal: "Diamante · coleção particular",
  },
  en: {
    intro: { kicker: "THE COSTUME INSTITUTE PRESENTS", title: "AURORA", sub: "THE ART OF THE GOWN",
      body: `In ${Y}, Casa Orvalho sent down the runway a ball gown that changed the way the night was dressed: eleven layers of hand-dyed tulle, from lilac to gold, like the sky a moment before dawn. The exhibition brings together the gown, the atelier's sketches, the jewels that went with it and the accessories that completed the evening dress.`,
      foot: "Costume Institute · Vesper Museum" },
    s1: { title: "I · THE ATELIER", body: "Before the fabric, the line. Pencil and watercolour sketches, pinned swatches and fitting notes show how an idea becomes a pattern, a toile and, at last, a gown. Every piece in this room went through dozens of fittings." },
    s2: { title: "II · THE AURORA GOWN", body: "Forty metres of silk tulle, eleven layers and more than three thousand hand-sewn crystals. The original, too fragile to travel, rests in storage; this is the exhibition replica, made from Casa Orvalho's own patterns." },
    s3: { title: "III · JEWELS OF THE NIGHT", body: "No evening dress ends with the gown. Tiaras, necklaces and earrings drawn in gouache on grey paper — and the pieces they inspired. The jewels on loan for tonight are kept in the Jewel Room, next door." },
    credits: ["CURATED BY", "Costume Institute", "EXHIBITION DESIGN", "Atelier Vesper", "CONSERVATION", "Vesper Museum Textile Lab", "WITH THANKS TO", "Casa Orvalho and private collectors"],
    arches: ["Evening hats · 1955–1960", "Gloves and bags · 1955–1960", "Fans and shoes · 1950–1962", "Hats and veils · 1956"],
    labels: [
      { n: "07", title: "The Aurora gown", by: `Casa Orvalho, ${Y} · exhibition replica`, mat: "Hand-dyed silk tulle, satin, embroidered crystals", credit: "Costume Institute collection" },
      { n: "12", title: "Velvet column", by: "Casa Orvalho, 1962", mat: "Silk velvet, satin gloves, faux-fur stole", credit: "Gift of a private collector" },
      { n: "09", title: "Crimson tulle", by: "Casa Orvalho, 1959", mat: "Ruffled silk tulle, draped bodice", credit: "Costume Institute collection" },
      { n: "04", title: "Evening hats", by: "Various ateliers, 1955–1960", mat: "Felt, silk straw, grosgrain ribbon", credit: "Costume Institute collection" },
      { n: "05", title: "Gloves and bags", by: "Casa Orvalho, 1955–1960", mat: "Kid leather, satin, brass clasp", credit: "Costume Institute collection" },
      { n: "06", title: "Fans and shoes", by: "Various ateliers, 1950–1962", mat: "Painted silk, mother-of-pearl, satin", credit: "On loan from a private collection" },
      { n: "08", title: "Hats and veils", by: "Casa Orvalho, 1956", mat: "Tulle, velvet, paste hatpins", credit: "Costume Institute collection" },
      { n: "15", title: "Daybreak necklace", by: `Jewellery design, ${Y}`, mat: "White gold, diamonds and pink sapphires (replica)", credit: "On loan from a private collection" },
      { n: "03", title: "Sketch table", by: "Orvalho atelier, 1955–1957", mat: "Pencil and watercolour on paper; tulle, satin and velvet swatches", credit: "Casa Orvalho archive" },
      { n: "18", title: "Sculpted gown «Petals»", by: "Atelier Vesper, 2024", mat: "Gilded brass, steel mesh, silk", credit: "Commissioned for the exhibition" },
      { n: "19", title: "Sculpted gown «Plissé»", by: "Atelier Vesper, 2024", mat: "Pleated silk paper over tulle", credit: "Commissioned for the exhibition" },
      { n: "01", title: "Draped figure", by: "Plaster cast of a classical original", mat: "Ancient drapery, the root of the evening gown", credit: "Vesper Museum cast collection" },
      { n: "02", title: "Figure with raised arm", by: "Plaster cast of a classical original", mat: "The runway gesture was already in the marble", credit: "Vesper Museum cast collection" },
      { n: "", title: "Exhibition catalogue", by: "Aurora · the art of the gown", mat: "Browse here; on sale at the museum shop", credit: "Costume Institute" },
      { n: "", title: "Audio guide", by: "Pieces 01 to 19 · Portuguese, English and Spanish", mat: "Take a headset and key in the label number", credit: "Costume Institute" },
    ],
    catalog: "CATALOGUE", audio: "AUDIO GUIDE", terrace: "TERRACE · GARDEN", handle: "PLEASE DO NOT TOUCH THE CASES",
    conservation: "CONSERVATION · HANDLE WITH GLOVES ONLY", report: { title: "CONDITION REPORT", rows: ["Object: diamond tiara", "Entry: loan · lot 07", "Overall condition: good", "Settings: 2 loose (see photo 3)", "Cleaning: soft brush only", "Humidity: 45 % · 19 °C", "Conservator: R. Amaral"] },
    drawers: "DRAWER", box: "ACID-FREE", jewels: ["Tiaras · c. 1910–1930", "Pearl necklaces", "Earrings and brooches", "Evening rings"], pedestal: "Diamond · private collection",
  },
  es: {
    intro: { kicker: "EL INSTITUTO DEL TRAJE PRESENTA", title: "AURORA", sub: "EL ARTE DEL VESTIDO",
      body: `En ${Y}, la Casa Orvalho llevó a la pasarela un vestido de baile que cambió la manera de vestir la noche: once capas de tul teñidas a mano, del lila al dorado, como el cielo un instante antes del amanecer. La exposición reúne el vestido, los croquis del taller, las joyas que lo acompañaron y los accesorios que completaban el traje de gala.`,
      foot: "Instituto del Traje · Museo Vesper" },
    s1: { title: "I · EL TALLER", body: "Antes de la tela, el trazo. Croquis a lápiz y acuarela, muestras prendidas con alfileres y notas de prueba muestran cómo una idea se vuelve patrón, toile y, por fin, vestido. Cada pieza de esta sala pasó por decenas de pruebas." },
    s2: { title: "II · EL VESTIDO AURORA", body: "Cuarenta metros de tul de seda, once capas y más de tres mil cristales bordados a mano. El original, demasiado frágil para viajar, descansa en la reserva técnica; aquí está la réplica de exposición, hecha con los patrones de la Casa Orvalho." },
    s3: { title: "III · JOYAS DE LA NOCHE", body: "Ningún traje de gala termina en el vestido. Tiaras, collares y pendientes dibujados a gouache sobre papel gris — y las piezas que inspiraron. Las joyas prestadas para esta noche se guardan en la Sala de las Joyas, al lado." },
    credits: ["CURADURÍA", "Instituto del Traje", "DISEÑO EXPOSITIVO", "Taller Vesper", "CONSERVACIÓN", "Laboratorio Textil del Museo Vesper", "AGRADECIMIENTOS", "Casa Orvalho y coleccionistas particulares"],
    arches: ["Sombreros de noche · 1955–1960", "Guantes y bolsos · 1955–1960", "Abanicos y zapatos · 1950–1962", "Sombreros y velos · 1956"],
    labels: [
      { n: "07", title: "Vestido Aurora", by: `Casa Orvalho, ${Y} · réplica de exposición`, mat: "Tul de seda teñido a mano, raso, cristales bordados", credit: "Colección Instituto del Traje" },
      { n: "12", title: "Columna de terciopelo", by: "Casa Orvalho, 1962", mat: "Terciopelo de seda, guantes de raso, estola de piel sintética", credit: "Donación de un coleccionista particular" },
      { n: "09", title: "Tul carmesí", by: "Casa Orvalho, 1959", mat: "Tul de seda en volantes, corpiño drapeado", credit: "Colección Instituto del Traje" },
      { n: "04", title: "Sombreros de noche", by: "Talleres diversos, 1955–1960", mat: "Fieltro, paja de seda, cinta de grogrén", credit: "Colección Instituto del Traje" },
      { n: "05", title: "Guantes y bolsos", by: "Casa Orvalho, 1955–1960", mat: "Cabritilla, raso, cierre de latón", credit: "Colección Instituto del Traje" },
      { n: "06", title: "Abanicos y zapatos", by: "Talleres diversos, 1950–1962", mat: "Seda pintada, nácar, raso", credit: "Préstamo de una colección particular" },
      { n: "08", title: "Sombreros y velos", by: "Casa Orvalho, 1956", mat: "Tul, terciopelo, alfileres de strass", credit: "Colección Instituto del Traje" },
      { n: "15", title: "Collar Alborada", by: `Diseño de joyería, ${Y}`, mat: "Oro blanco, brillantes y zafiros rosados (réplica)", credit: "Préstamo de una colección particular" },
      { n: "03", title: "Mesa de croquis", by: "Taller Orvalho, 1955–1957", mat: "Lápiz y acuarela sobre papel; muestras de tul, raso y terciopelo", credit: "Archivo de la Casa Orvalho" },
      { n: "18", title: "Vestido-escultura «Pétalos»", by: "Taller Vesper, 2024", mat: "Latón dorado, malla de acero, seda", credit: "Encargado para la exposición" },
      { n: "19", title: "Vestido-escultura «Plisado»", by: "Taller Vesper, 2024", mat: "Papel de seda plisado sobre tul", credit: "Encargado para la exposición" },
      { n: "01", title: "Figura drapeada", by: "Vaciado en yeso de un original clásico", mat: "El drapeado antiguo, origen del vestido de noche", credit: "Gipsoteca del Museo Vesper" },
      { n: "02", title: "Figura con el brazo alzado", by: "Vaciado en yeso de un original clásico", mat: "El gesto de la pasarela ya estaba en el mármol", credit: "Gipsoteca del Museo Vesper" },
      { n: "", title: "Catálogo de la exposición", by: "Aurora · el arte del vestido", mat: "Consúltelo aquí; a la venta en la tienda del museo", credit: "Instituto del Traje" },
      { n: "", title: "Audioguía", by: "Piezas 01 a 19 · portugués, inglés y español", mat: "Tome unos auriculares y marque el número de la etiqueta", credit: "Instituto del Traje" },
    ],
    catalog: "CATÁLOGO", audio: "AUDIOGUÍA", terrace: "TERRAZA · JARDÍN", handle: "NO TOQUE LAS VITRINAS",
    conservation: "CONSERVACIÓN · MANIPULE SOLO CON GUANTES", report: { title: "INFORME DE CONSERVACIÓN", rows: ["Pieza: tiara de brillantes", "Ingreso: préstamo · lote 07", "Estado general: bueno", "Engastes: 2 flojos (ver foto 3)", "Limpieza: solo pincel suave", "Humedad: 45 % · 19 °C", "Conservadora: R. Amaral"] },
    drawers: "CAJÓN", box: "LIBRE DE ÁCIDO", jewels: ["Tiaras · c. 1910–1930", "Collares de perlas", "Pendientes y broches", "Anillos de noche"], pedestal: "Diamante · colección particular",
  },
};

/** Índices das etiquetas no atlas (mesma ordem de `labels`). */
export const LBL = { aurora: 0, velvet: 1, tulle: 2, wall0: 3, jewel: 7, sketch: 8, petals: 9, plisse: 10, statue0: 11, catalog: 13, audio: 14 } as const;
