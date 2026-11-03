/*
 * MET Gala Heist v2 — tipografia das texturas da cena externa: os textos pintados no cenário, as famílias de fonte e o
 * texto espaçado/ajustado à largura (usados pelos banners e letreiros da rua e pelos atlas da cidade).
 */
/* ---------- letreiros, banners e cartazes (texto diegético: nomes ficcionais do mundo do jogo) ---------- */
/** Textos que aparecem pintados no cenário. Ficam juntos aqui para, se um dia forem traduzidos, passarem todos por t(). */
export const SIGNAGE = {
  gala: "GALA LUMIÈRE", year: "2026", date: "04 · 12 · 2026", museum: "MUSEU VESPER", institute: "INSTITUTO DO TRAJE",
  aurora: "AURORA", auroraHouse: "CASA ORVALHO · 1957", exhibit: "EXPOSIÇÃO", restricted: "ÁREA RESTRITA · CREDENCIADOS",
  caterer: "BUFÊ LUMIÈRE", catererSub: "ALTA GASTRONOMIA PARA EVENTOS", police: "POLÍCIA", dock: "DOCA · ENTREGAS", staffOnly: "SOMENTE FUNCIONÁRIOS",
  exit: "SAÍDA DE EMERGÊNCIA", vendor: "ACHADOS DE GRIFE", vendorSub: "COMPRO · TROCO · VENDO", vendorTag: "SEM PERGUNTAS",
  avenue: "AV. VESPER", street: "R. ORVALHO", closed: "VIA INTERDITADA", fans: ["ÍCONE ✦", "OLHA PRA CÁ!", "LENDA", "TE AMO ♥", "MUSA", "BRILHA!"],
  invite: "ACESSO SOMENTE COM CONVITE", reception: "RECEPÇÃO", press: "IMPRENSA CREDENCIADA", service: "ENTRADA DE SERVIÇO", serviceArrow: "◀", noParking: "PROIBIDO ESTACIONAR",
  queue: "FILA DE CONVIDADOS", alley: "BECO · ACESSO RESTRITO",
} as const;

export const SERIF = "'Didot', 'Bodoni 72', 'Playfair Display', 'Libre Bodoni', Georgia, 'DejaVu Serif', serif";
export const SANS = "'Helvetica Neue', Inter, Arial, 'Liberation Sans', sans-serif";
export function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]; const widths = chars.map((ch) => g.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2; const align = g.textAlign; g.textAlign = "left";
  chars.forEach((ch, k) => { g.fillText(ch, cx, y); cx += widths[k] + spacing; }); g.textAlign = align;
}
export function fitFont(g: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, width: number, spacing = 0) {
  let size = max; g.font = `${weight} ${size}px ${family}`;
  while (size > 8 && g.measureText(text).width + spacing * text.length > width) { size -= 2; g.font = `${weight} ${size}px ${family}`; }
  return size;
}
