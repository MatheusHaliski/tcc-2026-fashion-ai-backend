/*
 * MET Gala Heist v2 — texturas do terraço-jardim (Z13), geradas no navegador com chaves "terraco-…": lajes de pedra
 * calcária em fiadas desencontradas com juntas tomadas de musgo, líquen e manchas de umidade; deck de ipê com frestas,
 * emendas e parafusos; tampo de quartzito (o "tampo mineral" da mesa de drinks); aço corten das jardineiras; folhas de
 * hera e jasmim e cachos de glicínia (recorte por transparência); a luz que corre no totem; e a placa de saída da escada
 * de incêndio só com pictograma (sem texto: vale nos três idiomas).
 */
import * as THREE from "three";
import { drawnTexture, type Quality } from "../interior-tex";
import { areaSurface, fbm, hash2, mix, smooth, vnoise, type AreaSurface } from "./lounge-kit";

/* ======================= lajes de pedra com musgo ======================= */
/** Repete a cada 2,4 m: cinco fiadas de 0,36–0,6 m e lajes de 0,45–1,0 m de comprimento. */
export const STONE_TILE = 2.4;
export function stoneSurface(q: Quality): AreaSurface {
  // fiadas e cortes sorteados uma vez (a textura repete: as posições estão em [0, 1))
  const rows: number[] = [], cuts: number[][] = []; let acc = 0;
  for (let k = 0; k < 5; k++) { const h = 0.15 + hash2(k, 1, 77) * 0.1; rows.push(h); acc += h; }
  for (let k = 0; k < 5; k++) rows[k] /= acc;
  for (let k = 0; k < 5; k++) { const c: number[] = []; let x = hash2(k, 2, 79) * 0.3; while (x < 1) { c.push(x); x += (0.45 + hash2(k, c.length, 81) * 0.55) / STONE_TILE; } cuts.push(c); }
  const J = 0.009 / STONE_TILE;
  return areaSurface(`terraco-stone-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    let r0 = 0, row = 0; while (row < 4 && v > r0 + rows[row]) { r0 += rows[row]; row++; }
    const lv = (v - r0) / rows[row], c = cuts[row];
    // laje que contém u: entre dois cortes (a última da fiada dá a volta e emenda com a primeira)
    let k = c.length - 1; for (let i = 0; i < c.length; i++) if (u >= c[i]) k = i;
    const wrap = u < c[0], a = wrap ? c[c.length - 1] - 1 : c[k], b = wrap ? c[0] : k + 1 < c.length ? c[k + 1] : c[0] + 1;
    const id = row * 31 + k, tone = hash2(id, 5, 83), dJu = Math.min(u - a, b - u), dJv = Math.min(lv, 1 - lv) * rows[row], dJ = Math.min(dJu, dJv);
    const joint = dJ < J, n = fbm(u, v, 9, 85, 4), grain = vnoise(u * 700, v * 700, 700, 87), pit = vnoise(u * 260, v * 260, 260, 89) > 0.9;
    // musgo: nas juntas e invadindo as bordas onde o ruído deixa; líquen em manchas claras; umidade escurecendo
    const mossN = fbm(u, v, 14, 91, 3), moss = joint ? smooth(0.3, 0.55, mossN) : smooth(J * 2.5, 0, dJ - (mossN - 0.55) * 0.012) * smooth(0.5, 0.75, mossN);
    const lichen = smooth(0.82, 0.9, fbm(u, v, 22, 93, 2)) * (1 - moss);
    const damp = smooth(0.55, 0.8, fbm(u, v, 3, 95, 3)) * 0.22;
    let rr = 0.62 + 0.09 * tone + 0.05 * n + 0.03 * grain, gg = 0.59 + 0.08 * tone + 0.045 * n + 0.03 * grain, bb = 0.52 + 0.06 * tone + 0.04 * n + 0.03 * grain;
    if (pit) { rr *= 0.82; gg *= 0.82; bb *= 0.82; }
    const ed = smooth(J, J * 3, dJ);                                                     // chanfro da borda
    rr *= 0.86 + 0.14 * ed; gg *= 0.86 + 0.14 * ed; bb *= 0.86 + 0.14 * ed;
    if (joint) { rr = 0.16; gg = 0.15; bb = 0.12; }
    rr = mix(rr, 0.2 + 0.08 * mossN, moss); gg = mix(gg, 0.28 + 0.1 * mossN, moss); bb = mix(bb, 0.1, moss);
    rr = mix(rr, 0.78, lichen * 0.5); gg = mix(gg, 0.76, lichen * 0.5); bb = mix(bb, 0.6, lichen * 0.5);
    rr *= 1 - damp; gg *= 1 - damp; bb *= 1 - damp * 0.9;
    o[0] = rr; o[1] = gg; o[2] = bb;
    o[3] = joint ? 0.12 + 0.2 * moss : 0.4 + 0.12 * ed + 0.05 * (tone - 0.5) + 0.04 * n - (pit ? 0.08 : 0) + 0.06 * moss;
    o[4] = joint ? 0.95 : 0.74 + 0.1 * n - damp * 0.9 + 0.1 * moss;
  }, 1.3);
}

/* ======================= deck de ipê ======================= */
/** Tábuas de 14 cm com fresta de 6 mm, emendas sorteadas, dois parafusos por barrote (a cada 0,4 m). Repete a cada 1,168 m. */
export const DECK_TILE = 1.168;
export function deckSurface(q: Quality): AreaSurface {
  const n = 8, cuts: number[] = []; for (let k = 0; k < n; k++) cuts.push(hash2(k, 3, 101));
  return areaSurface(`terraco-deck-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    const row = Math.floor(v * n), lv = v * n - row, cut = cuts[row], seg = u < cut ? 0 : 1, id = row * 7 + seg;
    const gap = lv < 0.043, butt = Math.abs(u - cut) < 0.0025 || u < 0.0012 || u > 0.9988 && cut < 0.01;
    const tone = hash2(id, 9, 103), grain = Math.sin((lv * 6 + vnoise(u * 9, lv * 2, 1e6, 105 + id) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
    const silver = smooth(0.4, 0.75, fbm(u, v, 5, 107, 3)) * 0.35;
    let r = mix(0.36, 0.48, tone) * (0.85 + 0.15 * grain), g = mix(0.2, 0.28, tone) * (0.85 + 0.15 * grain), b = mix(0.12, 0.16, tone) * (0.85 + 0.15 * grain);
    r = mix(r, 0.46, silver); g = mix(g, 0.42, silver); b = mix(b, 0.38, silver);
    const jx = ((u * DECK_TILE) % 0.4) / 0.4, screw = (Math.abs(jx - 0.5) < 0.012) && (Math.abs(lv - 0.28) < 0.05 || Math.abs(lv - 0.78) < 0.05);
    if (screw) { r = 0.16; g = 0.15; b = 0.14; }
    if (gap) { r = 0.03; g = 0.025; b = 0.02; }
    if (butt) { r *= 0.4; g *= 0.4; b *= 0.4; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = gap ? 0.05 : 0.5 + 0.06 * grain - (butt ? 0.1 : 0); o[4] = gap ? 1 : 0.62 + 0.18 * (1 - grain) + 0.1 * silver;
  }, 1.5);
}

/* ======================= quartzito e corten ======================= */
export function quartziteSurface(q: Quality): AreaSurface {
  return areaSurface(`terraco-quartzite-${q}`, q === "high" ? 1024 : 512, (u, v, o) => {
    const w = fbm(u, v, 3, 121, 5), t = (u * 1.4 + v * 0.5 + w * 1.8) * 5;
    const band = Math.sin(t * Math.PI) * 0.5 + 0.5, vein = 1 - smooth(0, 0.04, Math.abs(fbm(u, v, 4, 123, 4) - 0.5)), spark = vnoise(u * 900, v * 900, 900, 125) > 0.97 ? 0.1 : 0;
    const base = 0.8 + 0.08 * band + spark;
    o[0] = mix(base, 0.46, vein * 0.6); o[1] = mix(base * 0.99, 0.46, vein * 0.6); o[2] = mix(base * 0.95, 0.48, vein * 0.6);
    o[3] = 0.5; o[4] = 0.12 + 0.06 * band;
  }, 0.3);
}
export function cortenSurface(q: Quality): AreaSurface {
  return areaSurface(`terraco-corten-${q}`, q === "high" ? 512 : 256, (u, v, o) => {
    const n = fbm(u, v, 6, 131, 5), blot = smooth(0.5, 0.8, fbm(u, v, 3, 133, 3)), streak = smooth(0.6, 0.9, vnoise(u * 40, v * 3, 40, 135)), pit = vnoise(u * 300, v * 300, 300, 137) > 0.92;
    let r = 0.42 + 0.12 * n, g = 0.19 + 0.06 * n, b = 0.08 + 0.03 * n;
    r = mix(r, 0.26, blot * 0.6); g = mix(g, 0.12, blot * 0.6); b = mix(b, 0.06, blot * 0.6);
    r = mix(r, 0.55, streak * 0.25); g = mix(g, 0.27, streak * 0.25);
    if (pit) { r *= 0.7; g *= 0.7; b *= 0.7; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5 + 0.1 * n - (pit ? 0.15 : 0); o[4] = 0.78 + 0.15 * n;
  }, 1.2);
}

/* ======================= folhas e flores (recorte) ======================= */
/** Atlas 2 × 2 de folhas: hera de três lóbulos, jasmim (oval pontuda), hera jovem e um raminho com três folhinhas. */
export function leafAtlas(): THREE.Texture {
  return drawnTexture("terraco-leaves", 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cell = w / 2;
    const vein = (x: number, y: number, x1: number, y1: number) => { g.strokeStyle = "rgba(190,220,150,0.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke(); };
    for (let k = 0; k < 4; k++) {
      const cx = (k % 2) * cell + cell / 2, cy = Math.floor(k / 2) * cell + cell / 2, s = cell * 0.42;
      const grd = g.createLinearGradient(cx - s, cy - s, cx + s, cy + s); grd.addColorStop(0, k % 2 ? "#3f6a2e" : "#2c4f22"); grd.addColorStop(1, k % 2 ? "#6f9a3c" : "#4b7a2f");
      g.fillStyle = grd; g.beginPath();
      if (k === 0 || k === 2) {   // hera: três lóbulos
        g.moveTo(cx, cy + s); g.bezierCurveTo(cx - s * 0.5, cy + s * 0.5, cx - s, cy + s * 0.2, cx - s * 0.9, cy - s * 0.1);
        g.bezierCurveTo(cx - s * 0.6, cy - s * 0.2, cx - s * 0.4, cy - s * 0.5, cx, cy - s);
        g.bezierCurveTo(cx + s * 0.4, cy - s * 0.5, cx + s * 0.6, cy - s * 0.2, cx + s * 0.9, cy - s * 0.1);
        g.bezierCurveTo(cx + s, cy + s * 0.2, cx + s * 0.5, cy + s * 0.5, cx, cy + s);
      } else if (k === 1) {       // jasmim
        g.moveTo(cx, cy + s); g.bezierCurveTo(cx - s * 0.55, cy + s * 0.3, cx - s * 0.45, cy - s * 0.5, cx, cy - s); g.bezierCurveTo(cx + s * 0.45, cy - s * 0.5, cx + s * 0.55, cy + s * 0.3, cx, cy + s);
      } else {                     // raminho
        for (const [dx, dy, a] of [[0, -0.45, 0], [-0.4, 0.1, -0.7], [0.4, 0.15, 0.7]] as [number, number, number][]) { g.save(); g.translate(cx + dx * s, cy + dy * s); g.rotate(a); g.moveTo(0, s * 0.45); g.ellipse(0, 0, s * 0.22, s * 0.45, 0, 0, Math.PI * 2); g.restore(); }
      }
      g.fill();
      vein(cx, cy + s, cx, cy - s * 0.8); if (k === 0 || k === 2) { vein(cx, cy + s * 0.3, cx - s * 0.7, cy - s * 0.05); vein(cx, cy + s * 0.3, cx + s * 0.7, cy - s * 0.05); }
    }
  });
}
/** Cacho de glicínia pendente (lilás, botões no alto e flores abertas embaixo), com transparência. */
export function wisteriaTexture(): THREE.Texture {
  return drawnTexture("terraco-wisteria", 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 140; k++) {
      const t = k / 140, y = h * (0.04 + t * 0.9), spread = w * (0.36 - t * 0.26), x = w / 2 + (hash2(k, 1, 141) - 0.5) * 2 * spread, r = 4 + 6 * (1 - t) * hash2(k, 2, 143);
      const c = t < 0.2 ? [176, 150, 210] : [140 + 60 * hash2(k, 3, 145), 110 + 40 * hash2(k, 4, 147), 200 + 40 * hash2(k, 5, 149)];
      g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.beginPath(); g.ellipse(x, y, r, r * 0.8, hash2(k, 6, 151) * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = "#4a5a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h * 0.3); g.stroke();
  });
}

/* ======================= totem e placa ======================= */
/** Faixas de luz que sobem pelo totem (a cena desloca a textura a cada quadro). Branca: a cor vem do material. */
export function totemTexture(): THREE.Texture {
  const t = drawnTexture("terraco-totemLight", 64, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / h, u = x / w, wave = 0.5 + 0.5 * Math.sin(v * Math.PI * 6 + Math.sin(u * Math.PI * 2) * 0.6), fine = 0.5 + 0.5 * Math.sin(v * Math.PI * 22);
      const k = 0.35 + 0.5 * wave ** 3 + 0.15 * fine, e = smooth(0, 0.18, Math.min(u, 1 - u)), q = (y * w + x) * 4;
      img.data[q] = img.data[q + 1] = img.data[q + 2] = Math.round(255 * k * (0.55 + 0.45 * e)); img.data[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** Placa da saída de emergência (pictograma verde: figura correndo para a porta e a seta). */
export function exitSignTexture(): THREE.Texture {
  return drawnTexture("terraco-exitSign", 256, 128, (g, w, h) => {
    g.fillStyle = "#0b7d3b"; g.fillRect(0, 0, w, h); g.strokeStyle = "#e8fff0"; g.fillStyle = "#e8fff0"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    // porta
    g.fillRect(w * 0.62, h * 0.18, w * 0.16, h * 0.64); g.fillStyle = "#0b7d3b"; g.fillRect(w * 0.645, h * 0.23, w * 0.11, h * 0.54); g.fillStyle = "#e8fff0";
    // figura correndo
    g.beginPath(); g.arc(w * 0.38, h * 0.24, h * 0.08, 0, Math.PI * 2); g.fill();
    g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(w * 0.37, h * 0.35); g.lineTo(w * 0.33, h * 0.58); g.lineTo(w * 0.42, h * 0.72); g.lineTo(w * 0.4, h * 0.86); g.moveTo(w * 0.33, h * 0.58); g.lineTo(w * 0.24, h * 0.7); g.lineTo(w * 0.18, h * 0.82); g.moveTo(w * 0.36, h * 0.4); g.lineTo(w * 0.46, h * 0.5); g.lineTo(w * 0.52, h * 0.44); g.moveTo(w * 0.36, h * 0.42); g.lineTo(w * 0.27, h * 0.46); g.lineTo(w * 0.22, h * 0.4); g.stroke();
    // seta
    g.beginPath(); g.moveTo(w * 0.84, h * 0.5); g.lineTo(w * 0.94, h * 0.5); g.moveTo(w * 0.9, h * 0.38); g.lineTo(w * 0.95, h * 0.5); g.lineTo(w * 0.9, h * 0.62); g.stroke();
  });
}
/** Chama da mesa de fogo e das lanternas (gota laranja com o miolo claro), com transparência aditiva. */
export function flameTexture(): THREE.Texture {
  return drawnTexture("terraco-flame", 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.55); grd.addColorStop(0, "rgba(255,246,210,1)"); grd.addColorStop(0.25, "rgba(255,190,80,0.95)"); grd.addColorStop(0.6, "rgba(255,110,30,0.55)"); grd.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h * 0.95, w / 2, h); g.bezierCurveTo(w * 0.1, h * 0.95, w * 0.05, h * 0.5, w / 2, 0); g.fill();
  });
}
