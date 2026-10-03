"use client";
import { useId } from "react";
import { mediaUrl } from "@/lib/api/client";
import { tr, useI18n } from "@/lib/i18n/i18n";

/**
 * RF25 — medalhão do selo. Segue as proporções do logo FashionAI (medidas no PNG oficial, frações do raio):
 * bisel 6 %, campo com o "elemento entre a borda e o centro" até 94 %, disco central 45 %, elemento central 36 %.
 * O JSON do desenho é o mesmo validado pelo backend (SealDesigns.normalize); aqui ele vira SVG determinístico
 * (sem Math.random — o mesmo desenho renderiza igual no servidor e no cliente).
 */
export interface SealDesign {
  mode?: "GENERATED" | "UPLOAD";
  palette?: string | null;
  border?: { material?: string; color?: string; width?: number };
  field?: { pattern?: string; material?: string; color?: string; lineColor?: string; nodeColors?: string[]; density?: number; seed?: number };
  center?: { material?: string; color?: string; radius?: number };
  element?: { id?: string; material?: string; color?: string; text?: string };
  uploadUrl?: string | null;
}

export const GEOMETRY = { bezel: 0.06, fieldOuter: 0.94, centerDisc: 0.45, element: 0.36, uploadRatioTolerance: 0.03, uploadMinPx: 256, uploadMaxPx: 4096 };

export const ELEMENTS = [
  { id: "BAG", get label() { return tr("sealMedallion.sacola_fai"); } }, { id: "HANGER", get label() { return tr("sealMedallion.cabide"); } }, { id: "STAR", get label() { return tr("sealMedallion.estrela"); } }, { id: "DIAMOND", get label() { return tr("sealMedallion.diamante"); } },
  { id: "CROWN", get label() { return tr("sealMedallion.coroa"); } }, { id: "HEART", get label() { return tr("sealMedallion.coracao"); } }, { id: "SCISSORS", get label() { return tr("sealMedallion.tesoura"); } }, { id: "NEEDLE", get label() { return tr("sealMedallion.agulha"); } },
  { id: "LAUREL", get label() { return tr("sealMedallion.louro"); } }, { id: "BOLT", get label() { return tr("sealMedallion.raio"); } }, { id: "FLOWER", get label() { return tr("sealMedallion.flor"); } }, { id: "MONOGRAM", get label() { return tr("sealMedallion.monograma"); } },
];
export const PATTERNS = [
  { id: "MALHA", get label() { return tr("sealMedallion.malha_de_nos_logo"); } }, { id: "GRADE", get label() { return tr("sealMedallion.grade"); } }, { id: "FLUXO_PONTOS", get label() { return tr("sealMedallion.fluxo_de_pontos"); } }, { id: "PONTOS", get label() { return tr("sealMedallion.pontos"); } },
  { id: "RAIOS", get label() { return tr("sealMedallion.raios"); } }, { id: "ONDAS", get label() { return tr("sealMedallion.ondas"); } }, { id: "ANEIS", get label() { return tr("sealMedallion.aneis"); } }, { id: "HEXAGONOS", get label() { return tr("sealMedallion.hexagonos"); } },
  { id: "ESTRELAS", get label() { return tr("sealMedallion.estrelas"); } }, { id: "COSTURA", get label() { return tr("sealMedallion.costura"); } }, { id: "ESPINHA", get label() { return tr("sealMedallion.espinha_de_peixe"); } }, { id: "TRAMA", get label() { return tr("sealMedallion.trama_textil"); } }, { id: "NENHUM", get label() { return tr("sealMedallion.liso"); } },
];
export const MATERIALS = [
  { id: "FOSCO", get label() { return tr("sealMedallion.fosco"); } }, { id: "BRILHO", get label() { return tr("common.brilho"); } }, { id: "DOURADO", get label() { return tr("sealMedallion.dourado"); } }, { id: "PRATA", get label() { return tr("sealMedallion.prata"); } }, { id: "BRONZE", get label() { return tr("sealMedallion.bronze"); } },
  { id: "HOLOGRAFICO", get label() { return tr("sealMedallion.holografico"); } }, { id: "ESMALTE", get label() { return tr("sealMedallion.esmalte"); } }, { id: "MADEIRA", get label() { return tr("sealMedallion.madeira"); } }, { id: "COURO", get label() { return tr("sealMedallion.couro"); } },
  { id: "TECIDO", get label() { return tr("sealMedallion.tecido"); } }, { id: "VIDRO", get label() { return tr("sealMedallion.vidro"); } }, { id: "NEON", get label() { return tr("sealMedallion.neon"); } },
];
export const PALETTES: Record<string, { border: string; field: string; line: string; nodes: string[]; center: string; element: string }> = {
  FAI: { border: "#2B2622", field: "#F58220", line: "#F6E8CF", nodes: ["#F9B21C", "#2E86C1", "#6DB33F", "#7A4E2D", "#F26522"], center: "#F6E8CF", element: "#2B2622" },
  DOURADO: { border: "#5A4212", field: "#1F1A14", line: "#C9A24A", nodes: ["#F2D27A", "#C9A24A", "#8A6A1E"], center: "#F5E9C8", element: "#2B2622" },
  MONOCROMO: { border: "#111111", field: "#2A2A2A", line: "#8A8A8A", nodes: ["#FFFFFF", "#BDBDBD", "#7A7A7A"], center: "#F2F2F2", element: "#111111" },
  PASTEL: { border: "#6B5B95", field: "#F7D9E3", line: "#FFFFFF", nodes: ["#B8E0D2", "#D6EADF", "#EAC4D5", "#F9E0C9"], center: "#FFF7F0", element: "#6B5B95" },
  NOTURNO: { border: "#0E1230", field: "#1B2255", line: "#3D4CA3", nodes: ["#7C5FC0", "#4FB3AE", "#F9B21C"], center: "#EEF1FF", element: "#0E1230" },
  ESMERALDA: { border: "#0F3D2E", field: "#1E7A5A", line: "#BFE8D3", nodes: ["#F9B21C", "#FFFFFF", "#8FD3B6"], center: "#F2FBF6", element: "#0F3D2E" },
  RUBI: { border: "#3D0A14", field: "#9B1B30", line: "#F4C2CC", nodes: ["#F9B21C", "#FFFFFF", "#E06B7D"], center: "#FFF3F5", element: "#3D0A14" },
  SAFIRA: { border: "#0B1F3F", field: "#1D4E89", line: "#BFD7F2", nodes: ["#F9B21C", "#FFFFFF", "#7FB3E6"], center: "#F0F6FF", element: "#0B1F3F" },
};

export function designFromPalette(id: string, base?: SealDesign): SealDesign {
  const p = PALETTES[id] ?? PALETTES.FAI;
  return {
    mode: "GENERATED", palette: id,
    border: { material: base?.border?.material ?? "FOSCO", color: p.border, width: base?.border?.width ?? GEOMETRY.bezel },
    field: { pattern: base?.field?.pattern ?? "MALHA", material: base?.field?.material ?? "FOSCO", color: p.field, lineColor: p.line, nodeColors: p.nodes, density: base?.field?.density ?? 2, seed: base?.field?.seed ?? 1 },
    center: { material: base?.center?.material ?? "FOSCO", color: p.center, radius: base?.center?.radius ?? GEOMETRY.centerDisc },
    element: { id: base?.element?.id ?? "BAG", material: base?.element?.material ?? "FOSCO", color: p.element, text: base?.element?.text ?? "FAI" },
    uploadUrl: null,
  };
}
export const DEFAULT_DESIGN: SealDesign = designFromPalette("FAI");

// ------------------------------------------------------------------ cor e aleatoriedade determinística
function hexToRgb(hex: string): [number, number, number] { const h = (hex ?? "#000000").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex([r, g, b]: [number, number, number]) { return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
export function mix(hex: string, target: string, t: number) { const a = hexToRgb(hex), b = hexToRgb(target); return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
export const lighten = (hex: string, t: number) => mix(hex, "#FFFFFF", t);
export const darken = (hex: string, t: number) => mix(hex, "#000000", t);
export function isLight(hex: string) { const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 > 150; }
function lcg(seed: number) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

const METAL: Record<string, string[]> = {
  DOURADO: ["#F7E27A", "#C9A24A", "#8A6A1E", "#F2D27A"],
  PRATA: ["#FFFFFF", "#C9CDD3", "#7F868F", "#E6E9ED"],
  BRONZE: ["#E0A46B", "#A5602B", "#6A3A17", "#D9955B"],
  HOLOGRAFICO: ["#C4956A", "#7C5FC0", "#4FB3AE", "#F58220", "#C4956A"],
};

/** Preenchimento + camadas de material de uma parte (clipadas à forma da parte). */
function Material({ material, color, clipId, uid, part }: { material: string; color: string; clipId: string; uid: string; part: string }) {
  const gid = `${uid}-${part}`;
  const stops = METAL[material];
  return (
    <>
      <defs>
        {stops && <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">{stops.map((c, i) => <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />)}</linearGradient>}
        {material === "BRILHO" && <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={lighten(color, 0.35)} /><stop offset="55%" stopColor={color} /><stop offset="100%" stopColor={darken(color, 0.2)} /></linearGradient>}
        {material === "MADEIRA" && <pattern id={`${gid}-p`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><rect width="7" height="7" fill={color} /><rect width="7" height="1.4" fill={darken(color, 0.28)} /><rect y="3.5" width="7" height=".7" fill={lighten(color, 0.18)} /></pattern>}
        {material === "COURO" && <pattern id={`${gid}-p`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill={color} /><circle cx="1.5" cy="1.5" r=".7" fill={darken(color, 0.35)} /><circle cx="4" cy="3.8" r=".5" fill={lighten(color, 0.25)} /></pattern>}
        {material === "TECIDO" && <pattern id={`${gid}-p`} width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill={color} /><path d="M0 0L4 4M4 0L0 4" stroke={darken(color, 0.25)} strokeWidth=".6" /></pattern>}
        {material === "NEON" && <filter id={`${gid}-f`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="-110" y="-110" width="220" height="220" fill={stops || material === "BRILHO" ? `url(#${gid}-g)` : ["MADEIRA", "COURO", "TECIDO"].includes(material) ? `url(#${gid}-p)` : material === "VIDRO" ? color : material === "NEON" ? darken(color, 0.6) : color} opacity={material === "VIDRO" ? 0.55 : 1} />
        {(material === "ESMALTE" || material === "VIDRO" || material === "BRILHO") && <ellipse cx="-30" cy="-45" rx="55" ry="28" fill="#FFFFFF" opacity={material === "VIDRO" ? 0.45 : 0.32} />}
        {material === "HOLOGRAFICO" && <rect x="-110" y="-110" width="220" height="220" fill="#FFFFFF" opacity="0.18" />}
        {material === "NEON" && <rect x="-110" y="-110" width="220" height="220" fill={color} opacity="0.35" filter={`url(#${gid}-f)`} />}
      </g>
    </>
  );
}

// ------------------------------------------------------------------ padrões entre a borda e o centro
function FieldPattern({ f, inner, outer, uid }: { f: NonNullable<SealDesign["field"]>; inner: number; outer: number; uid: string }) {
  const pattern = f.pattern ?? "MALHA";
  const line = f.lineColor ?? "#F6E8CF";
  const nodes = f.nodeColors?.length ? f.nodeColors : PALETTES.FAI.nodes;
  const d = Math.min(3, Math.max(1, f.density ?? 2));
  const rnd = lcg(f.seed ?? 1);
  const shift = Math.floor(rnd() * nodes.length);
  const nodeColor = (i: number) => nodes[(i + shift) % nodes.length];
  const span = outer - inner;
  const out: React.ReactNode[] = [];
  const polar = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

  if (pattern === "MALHA") {
    const rings = d + 1;
    const pts: [number, number][][] = [];
    for (let k = 0; k < rings; k++) {
      const r = inner + span * (0.18 + (0.72 * k) / Math.max(1, rings - 1));
      const n = 6 + 4 * k + 2 * d;
      pts.push(Array.from({ length: n }, (_, i) => polar(r, (i / n) * Math.PI * 2 + (k % 2 ? Math.PI / n : 0))));
    }
    pts.forEach((ring, k) => {
      ring.forEach((p, i) => {
        const q = ring[(i + 1) % ring.length];
        out.push(<line key={`m${k}-${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={line} strokeWidth="1.1" />);
        if (k + 1 < pts.length) {
          const next = pts[k + 1];
          const j = Math.round((i / ring.length) * next.length) % next.length;
          [j, (j + 1) % next.length].forEach((jj, t) => out.push(<line key={`c${k}-${i}-${t}`} x1={p[0]} y1={p[1]} x2={next[jj][0]} y2={next[jj][1]} stroke={line} strokeWidth="0.9" />));
        } else {
          const e = polar(outer, Math.atan2(p[1], p[0]));
          out.push(<line key={`e${k}-${i}`} x1={p[0]} y1={p[1]} x2={e[0]} y2={e[1]} stroke={line} strokeWidth="0.8" />);
        }
      });
    });
    pts.forEach((ring, k) => ring.forEach((p, i) => out.push(<circle key={`n${k}-${i}`} cx={p[0]} cy={p[1]} r={4.6 - k * 0.7} fill={nodeColor(i + k)} stroke={darken(nodeColor(i + k), 0.25)} strokeWidth="0.6" />)));
  } else if (pattern === "GRADE") {
    const step = 100 / (4 + 3 * d);
    for (let v = -100; v <= 100; v += step) { out.push(<line key={`gv${v}`} x1={v} y1={-100} x2={v} y2={100} stroke={line} strokeWidth="0.9" opacity="0.85" />); out.push(<line key={`gh${v}`} x1={-100} y1={v} x2={100} y2={v} stroke={line} strokeWidth="0.9" opacity="0.85" />); }
    for (let x = -100; x <= 100; x += step) for (let y = -100; y <= 100; y += step) { const r = Math.hypot(x, y); if (r > inner + 3 && r < outer - 3) out.push(<circle key={`gd${x}-${y}`} cx={x} cy={y} r="1.8" fill={nodeColor(Math.round(x + y))} />); }
  } else if (pattern === "FLUXO_PONTOS") {
    const n = 45 * d;
    for (let i = 0; i < n; i++) { const r = inner + span * Math.sqrt((i + 0.5) / n); const a = i * 2.39996; const p = polar(r, a); out.push(<circle key={`f${i}`} cx={p[0]} cy={p[1]} r={3.4 - 2 * (i / n)} fill={nodeColor(i)} opacity="0.95" />); }
  } else if (pattern === "PONTOS") {
    const rings = 2 + d;
    for (let k = 0; k < rings; k++) { const r = inner + span * ((k + 0.5) / rings); const n = Math.round((2 * Math.PI * r) / 9); for (let i = 0; i < n; i++) { const p = polar(r, (i / n) * Math.PI * 2); out.push(<circle key={`p${k}-${i}`} cx={p[0]} cy={p[1]} r="2.6" fill={nodeColor(i + k)} />); } }
  } else if (pattern === "RAIOS") {
    const n = 12 + 8 * d;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const p = polar(inner, a), q = polar(outer, a); out.push(<line key={`r${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={i % 2 ? line : nodeColor(i)} strokeWidth={i % 2 ? 1.2 : 2.2} opacity={i % 2 ? 0.7 : 0.9} />); }
  } else if (pattern === "ONDAS") {
    const rings = 2 + d;
    for (let k = 0; k < rings; k++) { const base = inner + span * ((k + 0.5) / rings); const amp = span / rings / 2.6; const m = 6 + 2 * k; const pts = Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return polar(base + amp * Math.sin(m * a), a); }); out.push(<path key={`w${k}`} d={pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + "Z"} fill="none" stroke={k % 2 ? nodeColor(k) : line} strokeWidth="1.6" />); }
  } else if (pattern === "ANEIS") {
    const rings = 3 + 2 * d;
    for (let k = 0; k < rings; k++) { const r = inner + span * ((k + 0.5) / rings); out.push(<circle key={`a${k}`} cx="0" cy="0" r={r} fill="none" stroke={k % 2 ? nodeColor(k) : line} strokeWidth={k % 2 ? 2.4 : 1} opacity="0.9" />); }
  } else if (pattern === "HEXAGONOS") {
    const s = 100 / (5 + 3 * d); const h = s * Math.sqrt(3);
    for (let row = -12; row <= 12; row++) for (let col = -12; col <= 12; col++) { const cx = col * 1.5 * s; const cy = row * h + (col % 2 ? h / 2 : 0); if (Math.hypot(cx, cy) > outer + s) continue; const pts = Array.from({ length: 6 }, (_, i) => polar(s, (Math.PI / 3) * i)).map((p) => `${(cx + p[0]).toFixed(1)},${(cy + p[1]).toFixed(1)}`).join(" "); out.push(<polygon key={`h${row}-${col}`} points={pts} fill={(row + col) % 3 === 0 ? nodeColor(row * 7 + col) : "none"} fillOpacity="0.35" stroke={line} strokeWidth="0.9" />); }
  } else if (pattern === "ESTRELAS") {
    const n = 18 * d;
    for (let i = 0; i < n; i++) { const r = inner + 4 + (span - 8) * rnd(); const a = rnd() * Math.PI * 2; const p = polar(r, a); const sz = 2.2 + rnd() * 3.2; const c = nodeColor(i); out.push(<path key={`s${i}`} d={`M${p[0]} ${p[1] - sz} Q${p[0]} ${p[1]} ${p[0] + sz} ${p[1]} Q${p[0]} ${p[1]} ${p[0]} ${p[1] + sz} Q${p[0]} ${p[1]} ${p[0] - sz} ${p[1]} Q${p[0]} ${p[1]} ${p[0]} ${p[1] - sz}Z`} fill={c} opacity="0.95" />); }
  } else if (pattern === "COSTURA") {
    const rings = 1 + d;
    for (let k = 0; k < rings; k++) { const r = inner + span * ((k + 0.5) / rings); out.push(<circle key={`st${k}`} cx="0" cy="0" r={r} fill="none" stroke={line} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />); }
    out.push(<circle key="stb" cx="0" cy="0" r={outer - 3} fill="none" stroke={nodeColor(0)} strokeWidth="1.6" strokeDasharray="2 3" />);
  } else if (pattern === "ESPINHA") {
    const w = 100 / (5 + 2 * d);
    out.push(<defs key="esp-defs"><pattern id={`${uid}-esp`} width={w} height={w} patternUnits="userSpaceOnUse"><path d={`M0 ${w / 2} L${w / 2} 0 L${w} ${w / 2}`} fill="none" stroke={line} strokeWidth="1.3" /><path d={`M0 ${w} L${w / 2} ${w / 2} L${w} ${w}`} fill="none" stroke={nodeColor(1)} strokeWidth="1.3" opacity=".8" /></pattern></defs>);
    out.push(<rect key="esp" x="-100" y="-100" width="200" height="200" fill={`url(#${uid}-esp)`} />);
  } else if (pattern === "TRAMA") {
    const w = 100 / (6 + 2 * d);
    out.push(<defs key="tr-defs"><pattern id={`${uid}-trama`} width={w * 2} height={w * 2} patternUnits="userSpaceOnUse"><rect width={w} height={w} fill={line} opacity=".9" /><rect x={w} y={w} width={w} height={w} fill={line} opacity=".9" /><rect x={w} width={w} height={w} fill={nodeColor(0)} opacity=".55" /><rect y={w} width={w} height={w} fill={nodeColor(1)} opacity=".55" /></pattern></defs>);
    out.push(<rect key="tr" x="-100" y="-100" width="200" height="200" fill={`url(#${uid}-trama)`} />);
  }
  return <>{out}</>;
}

// ------------------------------------------------------------------ elementos centrais (caixa 100×100)
function Element({ id, color, text, fill }: { id: string; color: string; text: string; fill: string }) {
  const ink = isLight(color) ? "#1A1714" : "#FFFFFF";
  const stroke = { fill: "none", stroke: fill, strokeWidth: 9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "HANGER": return <g><path d="M50 30 V22 A7 7 0 1 1 57 15" {...stroke} strokeWidth={6} /><path d="M50 30 L12 66 H88 Z" {...stroke} strokeWidth={7} /></g>;
    case "STAR": return <polygon points="50,6 61,38 95,38 68,58 78,92 50,72 22,92 32,58 5,38 39,38" fill={fill} />;
    case "DIAMOND": return <g><path d="M18 40 L34 14 H66 L82 40 L50 92 Z" fill={fill} /><path d="M18 40 H82 M34 14 L44 40 L50 92 M66 14 L56 40 L50 92 M44 40 L50 14 L56 40" fill="none" stroke={ink} strokeWidth="2" opacity=".55" /></g>;
    case "CROWN": return <path d="M12 78 L12 34 L34 54 L50 20 L66 54 L88 34 L88 78 Z M12 78 H88" fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round" />;
    case "HEART": return <path d="M50 88 C20 66 6 50 8 32 C10 16 30 8 50 28 C70 8 90 16 92 32 C94 50 80 66 50 88 Z" fill={fill} />;
    case "SCISSORS": return <g><circle cx="30" cy="74" r="12" {...stroke} strokeWidth={7} /><circle cx="70" cy="74" r="12" {...stroke} strokeWidth={7} /><path d="M38 64 L82 12 M62 64 L18 12" {...stroke} strokeWidth={8} /></g>;
    case "NEEDLE": return <g><path d="M22 84 L78 16" {...stroke} strokeWidth={8} /><ellipse cx="70" cy="26" rx="6" ry="9" transform="rotate(50 70 26)" fill={ink} /><path d="M14 20 C30 34 26 60 48 58 C64 56 62 40 78 44" fill="none" stroke={fill} strokeWidth="3.5" strokeDasharray="7 5" strokeLinecap="round" /></g>;
    case "LAUREL": {
      // coroa de louros: dois ramos em arco (raio 38) do pé ao topo; folhas tangentes ao ramo, inclinadas para fora/dentro
      const R = 38;
      const pt = (deg: number, r: number, side: 1 | -1): [number, number] => { const a = (deg * Math.PI) / 180; return [50 + side * Math.cos(a) * r, 50 + Math.sin(a) * r]; };
      const branch = (side: 1 | -1) => {
        const [x0, y0] = pt(105, R, side), [x1, y1] = pt(235, R, side);
        const leaves = [0, 1, 2, 3, 4, 5, 6].map((k) => {
          const deg = 118 + k * 18; const out = k % 2 === 0; const [cx, cy] = pt(deg, R + (out ? 5 : -5), side);
          const rot = side === 1 ? deg + (out ? -28 : 28) : 180 - deg - (out ? -28 : 28);
          return <ellipse key={k} cx={cx} cy={cy} rx="4.6" ry="10" transform={`rotate(${rot} ${cx} ${cy})`} />;
        });
        return <g key={side}><path d={`M${x0} ${y0} A${R} ${R} 0 0 ${side === 1 ? 1 : 0} ${x1} ${y1}`} fill="none" stroke={fill} strokeWidth="4" strokeLinecap="round" />{leaves}</g>;
      };
      return <g fill={fill}>{branch(1)}{branch(-1)}</g>;
    }
    case "BOLT": return <polygon points="56,6 22,54 46,54 40,94 78,42 54,42" fill={fill} />;
    case "FLOWER": return <g>{[0, 1, 2, 3, 4, 5].map((i) => <ellipse key={i} cx="50" cy="28" rx="13" ry="24" fill={fill} transform={`rotate(${i * 60} 50 50)`} opacity=".92" />)}<circle cx="50" cy="50" r="11" fill={ink} /></g>;
    case "MONOGRAM": return <text x="50" y="66" textAnchor="middle" fontFamily="var(--font-display, Georgia, serif)" fontWeight="700" fontSize={text.length > 2 ? 44 : 54} fill={fill}>{text}</text>;
    case "BAG":
    default: return <g><path d="M36 38 V30 A14 14 0 0 1 64 30 V38" fill="none" stroke={fill} strokeWidth="8" strokeLinecap="round" /><path d="M18 40 H82 L74 88 H26 Z" fill={fill} /><text x="50" y="72" textAnchor="middle" fontFamily="var(--font-display, Georgia, serif)" fontWeight="800" fontSize={text.length > 2 ? 22 : 28} letterSpacing="1" fill={ink}>{text}</text></g>;
  }
}

export function SealMedallion({ design, size = 44, premium, title, className }: { design?: SealDesign | null; size?: number; premium?: boolean; title?: string; className?: string }) {
  const { t } = useI18n();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = design ?? DEFAULT_DESIGN;
  const R = 100;
  const bw = Math.max(0.03, Math.min(0.12, d.border?.width ?? GEOMETRY.bezel));
  const fieldR = R * (1 - bw);
  const centerR = R * Math.max(0.3, Math.min(0.6, d.center?.radius ?? GEOMETRY.centerDisc));
  const elemR = R * GEOMETRY.element * (centerR / (R * GEOMETRY.centerDisc));
  const border = d.border ?? {}; const field = d.field ?? {}; const center = d.center ?? {}; const element = d.element ?? {};
  const elemMaterial = element.material ?? "FOSCO";
  const elemFill = METAL[elemMaterial] || elemMaterial === "BRILHO" ? `url(#${uid}-element-g)` : (element.color ?? "#2B2622");
  const wrapClass = `seal-medallion has-design ${premium ? "premium" : ""} ${className ?? ""}`;

  if (d.mode === "UPLOAD" && d.uploadUrl) {
    return <span className={wrapClass} style={{ width: size, height: size }} title={title}><img src={mediaUrl(d.uploadUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /></span>;
  }
  return (
    <span className={wrapClass} style={{ width: size, height: size }} title={title}>
      <svg viewBox="-100 -100 200 200" width={size} height={size} role="img" aria-label={title ?? t("sealMedallion.selo")} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <clipPath id={`${uid}-cb`}><circle r={R} /></clipPath>
          <clipPath id={`${uid}-cf`}><circle r={fieldR} /></clipPath>
          <clipPath id={`${uid}-cc`}><circle r={centerR} /></clipPath>
          <mask id={`${uid}-ann`}><circle r={fieldR} fill="#fff" /><circle r={centerR} fill="#000" /></mask>
        </defs>
        {/* 1. borda (bisel) */}
        <circle r={R} fill={border.color ?? "#2B2622"} />
        <Material material={border.material ?? "FOSCO"} color={border.color ?? "#2B2622"} clipId={`${uid}-cb`} uid={uid} part="border" />
        <circle r={R - 0.6} fill="none" stroke={darken(border.color ?? "#2B2622", 0.35)} strokeWidth="1.2" />
        {/* 2. campo entre a borda e o centro */}
        <circle r={fieldR} fill={field.color ?? "#F58220"} />
        <Material material={field.material ?? "FOSCO"} color={field.color ?? "#F58220"} clipId={`${uid}-cf`} uid={uid} part="field" />
        <g mask={`url(#${uid}-ann)`}><FieldPattern f={field} inner={centerR} outer={fieldR} uid={uid} /></g>
        <circle r={fieldR} fill="none" stroke={darken(field.color ?? "#F58220", 0.3)} strokeWidth="1" opacity=".6" />
        {/* 3. disco central */}
        <circle r={centerR + 1.5} fill={darken(center.color ?? "#F6E8CF", 0.35)} opacity=".35" />
        <circle r={centerR} fill={center.color ?? "#F6E8CF"} />
        <Material material={center.material ?? "FOSCO"} color={center.color ?? "#F6E8CF"} clipId={`${uid}-cc`} uid={uid} part="center" />
        {/* 4. elemento central */}
        <defs>
          {METAL[elemMaterial] && <linearGradient id={`${uid}-element-g`} x1="0" y1="0" x2="1" y2="1">{METAL[elemMaterial].map((c, i) => <stop key={i} offset={`${(i / (METAL[elemMaterial].length - 1)) * 100}%`} stopColor={c} />)}</linearGradient>}
          {elemMaterial === "BRILHO" && <linearGradient id={`${uid}-element-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={lighten(element.color ?? "#2B2622", 0.45)} /><stop offset="100%" stopColor={element.color ?? "#2B2622"} /></linearGradient>}
          {elemMaterial === "NEON" && <filter id={`${uid}-element-f`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
        </defs>
        <g transform={`translate(${-elemR} ${-elemR}) scale(${(elemR * 2) / 100})`} opacity={elemMaterial === "VIDRO" ? 0.75 : 1} filter={elemMaterial === "NEON" ? `url(#${uid}-element-f)` : undefined}>
          <Element id={element.id ?? "BAG"} color={element.color ?? "#2B2622"} text={element.text || "FAI"} fill={elemFill} />
        </g>
      </svg>
    </span>
  );
}

/** Validação client-side do upload: mesmas regras do backend (1:1 ± 3 %, 256–4096 px). */
export function validateSealImage(file: File): Promise<{ ok: boolean; message?: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = img.width / img.height;
      if (Math.abs(ratio - 1) > GEOMETRY.uploadRatioTolerance) resolve({ ok: false, message: tr("sealMedallion.a_imagem_precisa_ser_quadrada", { width: img.width, height: img.height }), width: img.width, height: img.height });
      else if (Math.min(img.width, img.height) < GEOMETRY.uploadMinPx) resolve({ ok: false, message: tr("sealMedallion.minimo_de_px", { uploadMinPx: GEOMETRY.uploadMinPx, uploadMinPx2: GEOMETRY.uploadMinPx }), width: img.width, height: img.height });
      else if (Math.max(img.width, img.height) > GEOMETRY.uploadMaxPx) resolve({ ok: false, message: tr("sealMedallion.maximo_de_px", { uploadMaxPx: GEOMETRY.uploadMaxPx, uploadMaxPx2: GEOMETRY.uploadMaxPx }), width: img.width, height: img.height });
      else resolve({ ok: true, width: img.width, height: img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, message: tr("sealMedallion.nao_foi_possivel_ler_a"), width: 0, height: 0 }); };
    img.src = url;
  });
}

// ------------------------------------------------------------------ RF25 — formato do selo
export type SealFormat = "CIRCULAR" | "FOLHA" | "FASHION_AI";
export const SEAL_FORMATS: { id: SealFormat; thumb: string }[] = [
  { id: "CIRCULAR", thumb: "/seals/formats/circular.webp" },
  { id: "FOLHA", thumb: "/seals/formats/folha.webp" },
  { id: "FASHION_AI", thumb: "/seals/formats/fashion_ai.webp" },
];

/**
 * O selo no formato escolhido: CIRCULAR é o medalhão; FOLHA é o selo postal (papel picotado nas bordas, como as folhas
 * de selos de referência); FASHION_AI é o emblema com o anel "FASHION AI" em volta do medalhão.
 */
export function SealFormatPreview({ format, design, size = 44, premium, title, className }: { format?: string | null; design?: SealDesign | null; size?: number; premium?: boolean; title?: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (format === "FOLHA") {
    return (
      <span className={`seal-stamp ${className ?? ""}`} style={{ width: Math.round(size * 0.8), height: size, ["--r" as string]: `${Math.max(2, Math.round(size / 26))}px` }} title={title}>
        <span className="seal-stamp-inner"><SealMedallion design={design} size={Math.round(size * 0.56)} premium={premium} /></span>
      </span>
    );
  }
  if (format === "FASHION_AI") {
    const r = 50 - 5.5;
    return (
      <span className={`seal-fai ${className ?? ""}`} style={{ width: size, height: size }} title={title}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
          <circle cx="50" cy="50" r="49" fill="#2B2622" />
          <defs><path id={`fai-ring-${uid}`} d={`M50,50 m-${r},0 a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0`} /></defs>
          <text fill="#F58220" fontSize="7.2" fontWeight="700" letterSpacing="2.2"><textPath href={`#fai-ring-${uid}`}>FASHION AI · FASHION AI · FASHION AI ·</textPath></text>
        </svg>
        <span className="seal-fai-core"><SealMedallion design={design} size={Math.round(size * 0.76)} premium={premium} /></span>
      </span>
    );
  }
  return <SealMedallion design={design} size={size} premium={premium} title={title} className={className} />;
}
