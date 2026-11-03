/*
 * MET Gala Heist v2 — a parede do fundo de cada ramo de loja (célula do atlas de interiores): vestidos, joias, cardápio,
 * prateleiras de farmácia, livros, pães, flores, garrafas, sapatos, perfumes, óculos, quadros, saguão e loja fechada.
 */
import { SANS, SERIF } from "./exterior-tex-type";
import { box, glow, rgb, text, vgrad, type G } from "./exterior-citytex-paint";
import type { ShopKind } from "./exterior-citytex-interior";

export function shopWall(g: G, x: number, y: number, w: number, h: number, kind: ShopKind, r: () => number) {
  const floorLine = (c: string) => box(g, x, y + h * 0.9, w, h * 0.1, c);
  switch (kind) {
    case "fashion": {
      vgrad(g, x, y, w, h, "#a8977f", "#5e5244");
      for (let k = 0; k < 3; k++) {
        const cx = x + w * (0.2 + k * 0.3), nw = w * 0.2, top = y + h * 0.16;
        g.fillStyle = "#e9dcc6"; g.beginPath(); g.moveTo(cx - nw / 2, y + h * 0.88); g.lineTo(cx - nw / 2, top + nw / 2); g.arc(cx, top + nw / 2, nw / 2, Math.PI, 0); g.lineTo(cx + nw / 2, y + h * 0.88); g.fill();
        g.strokeStyle = "#b79a5e"; g.lineWidth = Math.max(1, w / 300); g.stroke();
        glow(g, cx, top + nw * 0.2, nw * 0.9, "rgba(255,226,180,0.85)");
        // vestido no cabide (silhueta com caimento)
        const col = [[120, 14, 30], [16, 70, 52], [20, 20, 24], [176, 140, 70]][(k + Math.floor(r() * 4)) % 4];
        g.fillStyle = rgb(col[0], col[1], col[2]); g.beginPath();
        g.moveTo(cx - nw * 0.08, top + nw * 0.55); g.lineTo(cx + nw * 0.08, top + nw * 0.55); g.lineTo(cx + nw * 0.11, top + nw * 1.0); g.quadraticCurveTo(cx + nw * 0.42, y + h * 0.7, cx + nw * 0.36, y + h * 0.84); g.lineTo(cx - nw * 0.36, y + h * 0.84); g.quadraticCurveTo(cx - nw * 0.42, y + h * 0.7, cx - nw * 0.11, top + nw * 1.0); g.closePath(); g.fill();
        g.strokeStyle = "rgba(255,240,220,0.35)"; g.beginPath(); g.moveTo(cx - nw * 0.05, top + nw); g.quadraticCurveTo(cx - nw * 0.1, y + h * 0.7, cx - nw * 0.2, y + h * 0.83); g.stroke();
        box(g, cx - nw * 0.12, top + nw * 0.5, nw * 0.24, nw * 0.04, "#b79a5e");
      }
      box(g, x, y + h * 0.88, w, h * 0.012, "#b79a5e"); floorLine("#9b8a72");
      break;
    }
    case "jewelry": {
      vgrad(g, x, y, w, h, "#16233a", "#080d16"); box(g, x, y + h * 0.62, w, h * 0.38, "#3a2416");
      for (let k = 0; k < 5; k++) {
        const cx = x + w * (0.12 + k * 0.19), nw = w * 0.1, ny = y + h * 0.28;
        box(g, cx - nw / 2, ny, nw, h * 0.22, "#f3e2c0"); glow(g, cx, ny + h * 0.04, nw, "rgba(255,240,210,0.9)");
        for (let s = 0; s < 6; s++) { const sx = cx + (r() - 0.5) * nw * 0.7, sy = ny + h * (0.08 + r() * 0.12); g.fillStyle = r() < 0.5 ? "#ffffff" : "#ffd98a"; g.fillRect(sx, sy, 2, 2); }
        g.strokeStyle = "#c9a24a"; g.lineWidth = Math.max(1, w / 400); g.strokeRect(cx - nw / 2, ny, nw, h * 0.22);
      }
      text(g, "O", x + w * 0.5, y + h * 0.13, w * 0.1, h * 0.14, SERIF, "#d7b56d", "400");
      floorLine("#1a120c");
      break;
    }
    case "cafe": {
      box(g, x, y, w, h, "#1f3a2e"); for (let ty = y + h * 0.45; ty < y + h * 0.9; ty += h / 28) for (let tx = x + ((ty / (h / 28)) % 2) * (w / 60); tx < x + w; tx += w / 30) box(g, tx, ty, w / 30 - 1, h / 28 - 1, "#e9e3d6");
      for (let k = 0; k < 2; k++) { const sy = y + h * (0.2 + k * 0.14); box(g, x + w * 0.05, sy, w * 0.5, h * 0.015, "#6b4a2c"); for (let c = 0; c < 14; c++) { g.fillStyle = ["#e9e3d6", "#c46d3a", "#2f2a26", "#d8b46a"][Math.floor(r() * 4)]; g.fillRect(x + w * (0.07 + c * 0.034), sy - h * 0.06, w * 0.022, h * 0.06); } }
      box(g, x + w * 0.62, y + h * 0.12, w * 0.3, h * 0.36, "#151a17"); g.strokeStyle = "#8a6a44"; g.lineWidth = w / 200; g.strokeRect(x + w * 0.62, y + h * 0.12, w * 0.3, h * 0.36);
      ["CAFÉ  6", "CAPPUCCINO  9", "PÃO DE QUEIJO  5", "BOLO DO DIA  8"].forEach((s, k) => text(g, s, x + w * 0.77, y + h * (0.18 + k * 0.075), w * 0.26, h * 0.05, SANS, "#efe9dc", "500"));
      for (let k = 0; k < 3; k++) { const lx = x + w * (0.2 + k * 0.3); box(g, lx, y, 1, h * 0.06, "#222"); glow(g, lx, y + h * 0.08, w * 0.16, "rgba(255,196,120,0.95)"); }
      floorLine("#3a2a1c");
      break;
    }
    case "pharmacy": {
      vgrad(g, x, y, w, h, "#f4f7f8", "#d5dde0");
      for (let s = 0; s < 5; s++) { const sy = y + h * (0.18 + s * 0.14); box(g, x + w * 0.03, sy + h * 0.1, w * 0.94, h * 0.012, "#b9c2c6"); for (let c = 0; c < 46; c++) { const bw = w * (0.012 + r() * 0.01); g.fillStyle = ["#e2e8ec", "#4fa3d1", "#e85c5c", "#7cc47a", "#f2c14e", "#ffffff", "#8e7cc3"][Math.floor(r() * 7)]; g.fillRect(x + w * 0.04 + c * w * 0.02, sy + h * (0.1 - 0.04 - r() * 0.04), bw, h * 0.1); } }
      box(g, x + w * 0.45, y + h * 0.03, w * 0.1, h * 0.12, "#1f9d55"); box(g, x + w * 0.485, y + h * 0.045, w * 0.03, h * 0.09, "#e8fff0"); box(g, x + w * 0.465, y + h * 0.075, w * 0.07, h * 0.03, "#e8fff0");
      floorLine("#c9d1d4");
      break;
    }
    case "books": case "atelier": {
      vgrad(g, x, y, w, h, "#4a3220", "#24170e");
      if (kind === "books") {
        for (let s = 0; s < 6; s++) { const sy = y + h * (0.07 + s * 0.14); box(g, x, sy + h * 0.12, w, h * 0.02, "#6b4a2c"); let bx = x + 2; while (bx < x + w - 4) { const bw = w * (0.006 + r() * 0.012), bh = h * (0.08 + r() * 0.04); g.fillStyle = rgb(60 + r() * 150, 40 + r() * 90, 30 + r() * 80); g.fillRect(bx, sy + h * 0.12 - bh, bw, bh); bx += bw + 1; } }
        glow(g, x + w * 0.5, y, w * 0.6, "rgba(255,200,130,0.6)");
      } else {
        vgrad(g, x, y, w, h, "#efe4d6", "#cdbba4");
        for (let k = 0; k < 9; k++) { g.fillStyle = rgb(160 + r() * 90, 120 + r() * 100, 110 + r() * 100); g.fillRect(x + w * (0.05 + k * 0.045), y + h * 0.2, w * 0.035, h * 0.55); }
        g.fillStyle = "#f8f4ec"; g.beginPath(); g.ellipse(x + w * 0.72, y + h * 0.42, w * 0.06, h * 0.14, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x + w * 0.66, y + h * 0.5); g.quadraticCurveTo(x + w * 0.6, y + h * 0.86, x + w * 0.58, y + h * 0.88); g.lineTo(x + w * 0.86, y + h * 0.88); g.quadraticCurveTo(x + w * 0.84, y + h * 0.7, x + w * 0.78, y + h * 0.5); g.fill();
        glow(g, x + w * 0.72, y + h * 0.1, w * 0.3, "rgba(255,230,190,0.8)");
      }
      floorLine("#2a1c12");
      break;
    }
    case "bakery": {
      vgrad(g, x, y, w, h, "#d9a35c", "#8a5a2a");
      for (let s = 0; s < 3; s++) { const sy = y + h * (0.25 + s * 0.18); box(g, x + w * 0.05, sy, w * 0.9, h * 0.02, "#5a3a1c"); for (let k = 0; k < 16; k++) { g.fillStyle = rgb(200 + r() * 40, 140 + r() * 40, 70 + r() * 30); g.beginPath(); g.ellipse(x + w * (0.09 + k * 0.054), sy - h * 0.035, w * 0.024, h * 0.032, 0, 0, Math.PI * 2); g.fill(); } }
      text(g, "PÃES · DOCES · CAFÉ", x + w * 0.5, y + h * 0.1, w * 0.6, h * 0.08, SERIF, "#3a1e0c", "600", 2);
      floorLine("#4a2e18");
      break;
    }
    case "florist": {
      vgrad(g, x, y, w, h, "#2b3d2c", "#141d14");
      for (let t = 0; t < 3; t++) { const ty = y + h * (0.4 + t * 0.17); box(g, x + w * 0.04, ty, w * 0.92, h * 0.03, "#4b3a2a"); for (let k = 0; k < 12; k++) { const bx = x + w * (0.07 + k * 0.075); box(g, bx - w * 0.02, ty - h * 0.06, w * 0.04, h * 0.06, "#7f8a8c"); const col = [[240, 120, 150], [250, 250, 240], [250, 210, 80], [200, 40, 60], [180, 120, 220]][Math.floor(r() * 5)]; for (let f = 0; f < 9; f++) { g.fillStyle = rgb(col[0] * (0.8 + r() * 0.2), col[1] * (0.8 + r() * 0.2), col[2] * (0.8 + r() * 0.2)); g.beginPath(); g.arc(bx + (r() - 0.5) * w * 0.05, ty - h * (0.08 + r() * 0.06), w * 0.008, 0, Math.PI * 2); g.fill(); } } }
      glow(g, x + w * 0.3, y + h * 0.05, w * 0.4, "rgba(255,230,190,0.6)"); glow(g, x + w * 0.75, y + h * 0.05, w * 0.4, "rgba(255,230,190,0.6)");
      floorLine("#1d1a14");
      break;
    }
    case "bistro": case "bar": {
      box(g, x, y, w, h, kind === "bar" ? "#1a1014" : "#2a1a12");
      for (let k = 0; k < 24; k++) box(g, x + (w * k) / 24, y + h * 0.5, w / 24 - 1, h * 0.4, kind === "bar" ? "#2a1a1a" : "#4a2e1c");
      if (kind === "bistro") {
        box(g, x + w * 0.25, y + h * 0.08, w * 0.5, h * 0.36, "#c9a24a"); vgrad(g, x + w * 0.265, y + h * 0.1, w * 0.47, h * 0.32, "#6a5038", "#2a1c12");
        ["PRATO DO DIA", "STEAK FRITES", "VINHO DA CASA"].forEach((s, k) => text(g, s, x + w * 0.5, y + h * (0.17 + k * 0.08), w * 0.4, h * 0.055, SERIF, "#f3e6c8", "500"));
        for (let k = 0; k < 4; k++) glow(g, x + w * (0.12 + k * 0.25), y + h * 0.05, w * 0.12, "rgba(255,190,110,0.9)");
      } else {
        for (let s = 0; s < 3; s++) { const sy = y + h * (0.12 + s * 0.12); glow(g, x + w * 0.5, sy, w * 0.5, "rgba(255,160,70,0.35)"); box(g, x + w * 0.1, sy + h * 0.08, w * 0.8, h * 0.012, "#7a5530"); for (let k = 0; k < 22; k++) { g.fillStyle = rgb(80 + r() * 150, 40 + r() * 80, 20 + r() * 40, 0.95); g.fillRect(x + w * (0.12 + k * 0.035), sy + h * (0.08 - 0.07 - r() * 0.02), w * 0.012, h * 0.075); } }
      }
      floorLine("#120a08");
      break;
    }
    case "shoes": {
      vgrad(g, x, y, w, h, "#f2eee8", "#cfc6ba");
      for (let s = 0; s < 4; s++) { const sy = y + h * (0.22 + s * 0.17); box(g, x + w * 0.06, sy, w * 0.88, h * 0.012, "#bba98f"); for (let k = 0; k < 9; k++) { const sx = x + w * (0.1 + k * 0.095); g.fillStyle = ["#111", "#7a1020", "#c9a24a", "#e8e2d8", "#2c3e5a"][Math.floor(r() * 5)]; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + w * 0.05, sy); g.lineTo(sx + w * 0.05, sy - h * 0.03); g.quadraticCurveTo(sx + w * 0.02, sy - h * 0.035, sx + w * 0.012, sy - h * 0.07); g.lineTo(sx, sy - h * 0.07); g.fill(); } }
      floorLine("#a89a88");
      break;
    }
    case "perfume": {
      vgrad(g, x, y, w, h, "#f3d9d6", "#c49c98");
      text(g, "ÉTER", x + w * 0.5, y + h * 0.14, w * 0.3, h * 0.14, SERIF, "#5a2a30", "400", 8);
      for (let s = 0; s < 3; s++) { const sy = y + h * (0.38 + s * 0.17); box(g, x + w * 0.08, sy, w * 0.84, h * 0.01, "rgba(255,255,255,0.8)"); for (let k = 0; k < 14; k++) { const bx = x + w * (0.11 + k * 0.058), bh = h * (0.05 + r() * 0.04); g.fillStyle = `rgba(${200 + r() * 55},${150 + r() * 80},${120 + r() * 100},0.85)`; g.fillRect(bx, sy - bh, w * 0.024, bh); box(g, bx + w * 0.006, sy - bh - h * 0.015, w * 0.012, h * 0.015, "#c9a24a"); box(g, bx + w * 0.004, sy - bh, w * 0.004, bh, "rgba(255,255,255,0.6)"); } }
      floorLine("#9a7470");
      break;
    }
    case "optics": {
      vgrad(g, x, y, w, h, "#e6e8ea", "#b8bcc0");
      for (let s = 0; s < 5; s++) for (let k = 0; k < 10; k++) { const cx = x + w * (0.1 + k * 0.088), cy = y + h * (0.2 + s * 0.13); g.strokeStyle = ["#111", "#6a3a1c", "#c9a24a", "#2c3e5a"][Math.floor(r() * 4)]; g.lineWidth = Math.max(1, w / 260); g.beginPath(); g.ellipse(cx - w * 0.016, cy, w * 0.014, h * 0.025, 0, 0, Math.PI * 2); g.ellipse(cx + w * 0.016, cy, w * 0.014, h * 0.025, 0, 0, Math.PI * 2); g.stroke(); }
      floorLine("#8f9498");
      break;
    }
    case "gallery": {
      vgrad(g, x, y, w, h, "#f4f3f0", "#d6d4cf");
      for (let k = 0; k < 3; k++) {
        const fx = x + w * (0.1 + k * 0.3), fw = w * 0.2, fh = h * 0.42, fy = y + h * 0.22;
        box(g, fx - 3, fy - 3, fw + 6, fh + 6, "#1a1a1a");
        const cols = [[200, 60, 40], [30, 60, 120], [230, 180, 60], [20, 20, 20], [240, 230, 210]];
        for (let b = 0; b < 3; b++) { const c = cols[Math.floor(r() * cols.length)]; box(g, fx, fy + (fh * b) / 3, fw, fh / 3 + 1, rgb(c[0], c[1], c[2])); }
        glow(g, fx + fw / 2, fy - h * 0.06, fw * 0.9, "rgba(255,245,225,0.75)");
      }
      floorLine("#bdb8b0");
      break;
    }
    case "lobby": {
      vgrad(g, x, y, w, h, "#d8ccb8", "#a8987e");
      for (let k = 0; k < 8; k++) { g.strokeStyle = "rgba(120,100,80,0.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + r() * w, y); g.bezierCurveTo(x + r() * w, y + h * 0.3, x + r() * w, y + h * 0.6, x + r() * w, y + h); g.stroke(); }
      for (let c = 0; c < 6; c++) for (let rr = 0; rr < 5; rr++) { box(g, x + w * (0.05 + c * 0.035), y + h * (0.35 + rr * 0.07), w * 0.03, h * 0.06, "#b58a3c"); box(g, x + w * (0.055 + c * 0.035), y + h * (0.37 + rr * 0.07), w * 0.02, h * 0.01, "#3a2a1a"); }
      vgrad(g, x + w * 0.42, y + h * 0.22, w * 0.16, h * 0.66, "#c7cdd2", "#7d858c"); box(g, x + w * 0.499, y + h * 0.22, 2, h * 0.66, "#4a5056"); box(g, x + w * 0.42, y + h * 0.18, w * 0.16, h * 0.04, "#b58a3c");
      glow(g, x + w * 0.5, y + h * 0.06, w * 0.4, "rgba(255,226,170,0.95)"); glow(g, x + w * 0.85, y + h * 0.4, w * 0.15, "rgba(255,210,150,0.6)");
      floorLine("#6e5e48");
      break;
    }
    case "closed": {
      vgrad(g, x, y, w, h, "#15161a", "#08090b");
      for (let k = 0; k < 3; k++) box(g, x + w * (0.2 + k * 0.12), y + h * (0.62 + (k % 2) * 0.08), w * 0.1, h * 0.28, "#24201a");
      box(g, x + w * 0.85, y + h * 0.12, w * 0.06, h * 0.05, "#0f6a3a"); glow(g, x + w * 0.88, y + h * 0.145, w * 0.06, "rgba(80,255,150,0.5)");
      break;
    }
  }
}
