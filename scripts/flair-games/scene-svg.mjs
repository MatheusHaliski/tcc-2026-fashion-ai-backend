/**
 * Renderizador SVG puro da miniatura de um jogo (desenho R25): aproximação dos objetos do CbcSceneArt
 * (components/flair/cbc-scene.tsx) em string, mais os pinos numerados das vagas e a faixa inferior com o número do
 * jogo e a série. Sem React, sem DOM: só texto, para o sharp converter em WebP 640×400 (viewBox 160×100).
 */
import { PROP_KINDS } from "./lib/constants.mjs";

const SERIES_COLORS = { A: "#8FD3F4", B: "#F2C14E", C: "#8FE3CF", D: "#C98BA0", E: "#F28C38" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const range = (n) => Array.from({ length: n }, (_, i) => i);
const g = (x, y, s, inner, attrs = "") => `<g transform="translate(${x} ${y}) scale(${s})"${attrs}>${inner}</g>`;

const PROPS = {
  sun: (p, sc, at) => at(`<circle r="8" fill="#FFD166"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-11" x2="0" y2="-14" stroke="#FFD166" stroke-width="1.2" transform="rotate(${a})"/>`).join("")}`),
  moon: (p, sc, at) => at(`<circle r="8" fill="#F4EFD8"/><circle cx="3.5" cy="-2" r="7" fill="${sc.sky[0]}"/>`),
  waves: (p) => `<path d="M0 ${p.y} q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${p.y + 6} H0Z" fill="#4FA3D1" opacity="0.85"/>`,
  umbrella: (p, sc, at) => at(`<line x1="0" y1="0" x2="0" y2="-20" stroke="#5B4636" stroke-width="1"/><path d="M-14 -20 A14 9 0 0 1 14 -20 Z" fill="${sc.accent}"/><path d="M-5 -20 A5 9 0 0 1 5 -20 Z" fill="#FFFFFF" opacity="0.8"/>`),
  building: (p, sc, at) => at(`<rect x="0" y="-36" width="26" height="36" fill="#E3D5C3" stroke="#B9A88F" stroke-width="0.5"/>${range(4).map((r) => range(3).map((c) => `<rect x="${3 + c * 8}" y="${-32 + r * 8}" width="4" height="5" fill="#8FA9C4"/>`).join("")).join("")}`),
  tree: (p, sc, at) => at(`<rect x="-1.5" y="-12" width="3" height="12" fill="#6B4A2F"/><circle cy="-17" r="9" fill="#5E9E5A"/><circle cx="-5" cy="-13" r="6" fill="#4F8A4C"/>`),
  flower: (p, sc, at) => at(`<line x1="0" y1="0" x2="0" y2="-7" stroke="#4F8A4C" stroke-width="0.8"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="0" cy="-10.5" r="2" fill="${sc.accent}" transform="rotate(${a} 0 -8)"/>`).join("")}<circle cy="-8" r="1.4" fill="#FFD166"/>`),
  stage: (p, sc, at) => at(`<rect x="-34" y="-30" width="68" height="26" fill="#1E1A2E"/><path d="M-40 -4 H40 L34 6 H-34 Z" fill="#5A4A7A"/><path d="M-20 -30 L-30 -4 H-10 Z" fill="#FFD166" opacity="0.25"/><path d="M20 -30 L10 -4 H30 Z" fill="#FFD166" opacity="0.25"/>`),
  lights: (p) => `<g>${range(17).map((i) => `<circle cx="${i * 10}" cy="${p.y + (i % 2) * 2}" r="1.4" fill="${i % 3 === 0 ? "#FFD166" : i % 3 === 1 ? "#FF6F91" : "#8FE3CF"}"/>`).join("")}<path d="M0 ${p.y} ${range(16).map((i) => `Q${i * 10 + 5} ${p.y + 4} ${(i + 1) * 10} ${p.y}`).join(" ")}" stroke="#333" stroke-width="0.3" fill="none"/></g>`,
  arch: (p, sc, at) => at(`<path d="M-14 0 V-18 A14 14 0 0 1 14 -18 V0" stroke="#FFFFFF" stroke-width="2.4" fill="none"/>${[-14, -10, -4, 4, 10, 14].map((x) => `<circle cx="${x}" cy="${-18 - Math.sqrt(Math.max(0, 196 - x * x)) * 0.95}" r="1.8" fill="${sc.accent}"/>`).join("")}`),
  table: (p, sc, at) => at(`<rect x="-12" y="-10" width="24" height="2.4" fill="#7A5C3E"/><rect x="-10" y="-8" width="1.6" height="8" fill="#7A5C3E"/><rect x="8.4" y="-8" width="1.6" height="8" fill="#7A5C3E"/><circle cx="0" cy="-12" r="1.8" fill="${sc.accent}"/>`),
  tower: (p, sc, at) => at(`<path d="M-12 0 Q-4 -18 -1 -44 M12 0 Q4 -18 1 -44"/><path d="M-8 -12 H8 M-5 -24 H5 M-2.6 -34 H2.6"/><path d="M-7 0 A7 6 0 0 1 7 0"/>`, ` stroke="#4A4A4A" stroke-width="0.9" fill="none"`),
  river: (p) => `<path d="M${p.x} ${p.y} q12 -3 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 V${p.y + 8} H${p.x}Z" fill="#6FA8D6" opacity="0.8"/>`,
  mountain: (p, sc, at) => at(`<path d="M-34 0 L0 -40 L34 0 Z" fill="#8A97B3"/><path d="M-9 -29 L0 -40 L9 -29 L4 -31 L0 -27 L-4 -31 Z" fill="#FFFFFF"/>`),
  snow: () => `<g fill="#FFFFFF" opacity="0.9">${[[12, 10], [30, 22], [52, 8], [70, 30], [88, 14], [104, 26], [122, 6], [140, 20], [150, 36], [20, 40], [62, 44], [96, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join("")}</g>`,
  fire: (p, sc, at) => at(`<path d="M0 0 C-6 -4 -4 -10 0 -16 C4 -10 6 -4 0 0 Z" fill="#F28C28"/><path d="M0 0 C-3 -3 -2 -7 0 -10 C2 -7 3 -3 0 0 Z" fill="#FFD166"/>`),
  pumpkin: (p, sc, at) => at(`<ellipse rx="7" ry="5.5" fill="#F28C28"/><ellipse rx="2.6" ry="5.5" fill="#E0761A"/><rect x="-0.8" y="-8" width="1.6" height="3" fill="#4F8A4C"/>`),
  house: (p, sc, at) => at(`<rect x="0" y="-22" width="26" height="22" fill="#2E2340"/><path d="M-3 -22 L13 -36 L29 -22 Z" fill="#3B2C52"/><rect x="5" y="-16" width="5" height="5" fill="#FFD166"/><rect x="16" y="-16" width="5" height="5" fill="#FFD166" opacity="0.6"/>`),
  confetti: () => `<g>${range(28).map((i) => `<rect x="${(i * 37) % 160}" y="${(i * 23) % 62}" width="2" height="1" fill="${["#FFFFFF", "#1BB5A5", "#5A3FA8", "#FF6F91"][i % 4]}" transform="rotate(${(i * 47) % 180} ${(i * 37) % 160} ${(i * 23) % 62})"/>`).join("")}</g>`,
  runway: (p) => `<g><path d="M${p.x - 6} ${p.y} H${p.x + 6} L${p.x + 34} 100 H${p.x - 34} Z" fill="#EDEDED" opacity="0.9"/><path d="M${p.x} ${p.y} V100" stroke="#BDBDBD" stroke-width="0.4" stroke-dasharray="2 2"/></g>`,
  rack: (p, sc, at) => at(`<path d="M-14 0 V-26 H14 V0" stroke="#5B4636" stroke-width="1" fill="none"/>${[-9, -1, 7].map((x, i) => `<path d="M${x} -26 l-4 4 v12 h8 v-12 z" fill="${i === 1 ? sc.accent : i === 0 ? "#C9B79C" : "#8FA9C4"}"/>`).join("")}`),
  mirror: (p, sc, at) => at(`<ellipse cy="-16" rx="7" ry="13" fill="#DCE8F0" stroke="#B9975B" stroke-width="1.4"/><rect x="-1" y="-3" width="2" height="3" fill="#B9975B"/>`),
  carpet: (p) => `<path d="M0 100 L60 ${p.y} H76 L44 100 Z" fill="#A3122A"/>`,
  stairs: (p, sc, at) => at(range(5).map((i) => `<rect x="${i * 6}" y="${-(i + 1) * 5}" width="${30 - i * 6}" height="5"/>`).join(""), ` fill="#5A4A7A"`),
  door: (p, sc, at) => at(`<rect x="0" y="-26" width="14" height="26" fill="#7A5C3E"/><circle cx="11" cy="-12" r="0.9" fill="#FFD166"/>`),
  window: (p, sc, at) => at(`<rect x="0" y="0" width="20" height="14" fill="#BFD4E8" stroke="#FFFFFF" stroke-width="1"/><path d="M10 0 V14 M0 7 H20" stroke="#FFFFFF" stroke-width="0.8"/>`),
  calendar: (p, sc, at) => at(`<rect x="0" y="0" width="144" height="12" rx="2" fill="${sc.accent}" opacity="0.85"/>${range(7).map((i) => `<rect x="${2 + i * 20.3}" y="16" width="18" height="60" rx="2" fill="#FFFFFF" stroke="#D3D7DF" stroke-width="0.5"/>`).join("")}`),
  bag: (p, sc, at) => at(`<rect x="-6" y="-10" width="12" height="10" fill="${sc.accent}"/><path d="M-3 -10 A3 3 0 0 1 3 -10" stroke="#333" stroke-width="0.6" fill="none"/>`),
};

/** Um objeto do cenário em SVG; tipo desconhecido vira string vazia (a validação já recusou antes). */
export function renderProp(p, scene) {
  const draw = PROPS[p.k];
  if (!draw) return "";
  const at = (inner, attrs = "") => g(p.x, p.y, p.s ?? 1, inner, attrs);
  return draw(p, scene, at);
}

/** Posição da vaga: a do cenário (x%, y%) ou o arco automático do CbcScene quando falta. */
export function pinPosition(scene, key, index, total) {
  const known = scene.slots?.[key];
  if (Array.isArray(known)) return [known[0], known[1]];
  const x = total <= 1 ? 50 : 10 + (80 * index) / (total - 1);
  const y = 62 + Math.sin((index / Math.max(1, total - 1)) * Math.PI) * -18;
  return [x, y];
}

/** SVG completo da miniatura (160×100): céu em gradiente, chão, objetos, pinos das vagas e faixa inferior. */
export function sceneSvg({ scene, slots = [], number, series, name = "" }) {
  const gid = `ge-sky-${number}`;
  const band = SERIES_COLORS[series] ?? scene.accent;
  const pins = slots.map((s, i) => {
    const [x, y] = pinPosition(scene, s.key, i, slots.length);
    const px = (x / 100) * 160;
    const fill = s.optional ? "#FFFFFF" : scene.accent;
    const ink = s.optional ? "#111111" : "#FFFFFF";
    return `<g transform="translate(${px.toFixed(2)} ${Number(y).toFixed(2)})"><circle r="4.2" fill="${fill}" stroke="#111111" stroke-width="0.6"/>` +
      `<text y="1.6" text-anchor="middle" font-size="4.6" font-weight="700" font-family="Inter, DejaVu Sans, sans-serif" fill="${ink}">${i + 1}</text></g>`;
  });
  const label = `Nº ${String(number).padStart(2, "0")} · Série ${series}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="640" height="400">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[0]}"/><stop offset="1" stop-color="${scene.sky[1]}"/></linearGradient></defs>` +
    `<rect x="0" y="0" width="160" height="100" fill="url(#${gid})"/>` +
    `<rect x="0" y="${scene.horizon}" width="160" height="${100 - scene.horizon}" fill="${scene.ground}"/>` +
    (scene.props ?? []).map((p) => renderProp(p, scene)).join("") +
    pins.join("") +
    `<rect x="0" y="89" width="160" height="11" fill="#111111" opacity="0.78"/><rect x="0" y="89" width="3" height="11" fill="${band}"/>` +
    `<text x="6" y="96.4" font-size="5" font-weight="700" font-family="Inter, DejaVu Sans, sans-serif" fill="#FFFFFF">${esc(label)}</text>` +
    `<text x="154" y="96.4" text-anchor="end" font-size="4.2" font-family="Inter, DejaVu Sans, sans-serif" fill="#FFFFFF" opacity="0.9">${esc(name)}</text>` +
    `</svg>`;
}

/** Cena de exemplo com todos os objetos conhecidos, para o teste de caracterização do renderizador. */
export function sampleSceneWithAllProps() {
  return {
    sky: ["#1B2440", "#3A3F6B"], ground: "#2C2F45", horizon: 64, accent: "#8FD3F4", slots: {},
    props: PROP_KINDS.map((k, i) => ({ k, x: (i * 11) % 160, y: 30 + ((i * 7) % 50), s: 0.8 })),
  };
}
