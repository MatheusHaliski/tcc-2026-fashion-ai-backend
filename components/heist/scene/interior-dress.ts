/*
 * MET Gala Heist v2 — peças "orgânicas" do interior feitas por revolução e deformação (sem modelos baixados): busto de
 * costura com vestido de alta-costura (corpete, cintura marcada e saia sereia, rodada ou coluna, com pregas), a estátua
 * clássica de mármore em contraposto com o braço erguido (como a da referência da galeria), a palmeira de vaso (folhas
 * em tiras recortadas por textura) e a oliveira podada do terraço. Tudo em metros, base em y = 0.
 */
import * as THREE from "three";
import { geo } from "./interior-batch";
import { drawnTexture, rand, type Quality } from "./interior-tex";

export type GownCut = "mermaid" | "ball" | "column" | "aline";

/** Raio da peça em cada altura (0 = chão, 1 = topo do busto ~1,42 m) para o corte. */
function gownProfile(cut: GownCut, hem = 0.02): [number, number][] {
  // pontos (raio, y) de baixo para cima; o busto de costura tem ombro em ~1,42 m
  const bodice: [number, number][] = [[0.155, 1.05], [0.135, 1.1], [0.15, 1.2], [0.17, 1.28], [0.165, 1.34], [0.13, 1.4], [0.06, 1.44]];
  switch (cut) {
    case "mermaid": return [[0.62, hem], [0.5, 0.12], [0.3, 0.3], [0.19, 0.45], [0.17, 0.6], [0.19, 0.78], [0.2, 0.9], [0.17, 1.0], ...bodice];
    case "ball": return [[0.85, hem], [0.82, 0.1], [0.72, 0.35], [0.56, 0.62], [0.36, 0.86], [0.2, 0.98], [0.15, 1.02], ...bodice];
    case "column": return [[0.3, hem], [0.27, 0.2], [0.24, 0.5], [0.22, 0.8], [0.19, 0.95], [0.16, 1.02], ...bodice];
    case "aline": return [[0.62, hem], [0.55, 0.2], [0.42, 0.5], [0.28, 0.8], [0.18, 0.97], [0.15, 1.02], ...bodice];
  }
}
/** Vestido de alta-costura num busto de costura: revolução com seção oval, pregas que se abrem na barra e um decote em V
 * nas costas. uv.v = altura (0 barra → 1 topo) para o degradê do tecido. */
export function gownGeometry(cut: GownCut, q: Quality): THREE.BufferGeometry {
  return geo(`gown-${cut}-${q}`, () => {
    const prof = gownProfile(cut), seg = q === "high" ? 72 : 36;
    const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, seg);
    const p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const topY = prof[prof.length - 1][1];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      // pregas: mais fundas perto da barra, quase nada no corpete
      const fold = y < 1.02 ? (1 - y / 1.02) ** 1.6 : 0, k = 1 + fold * (0.06 * Math.sin(a * 14) + 0.035 * Math.sin(a * 23 + 1.3));
      // seção oval (frente/costas mais rasas) e a cauda: a barra se alonga para trás
      const tail = cut === "mermaid" || cut === "ball" ? Math.max(0, -Math.sin(a)) * (1 - Math.min(1, y / 0.35)) * 0.35 : 0;
      const rr = r * k;
      p.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr * 0.82 - tail);
      uv.setY(i, y / topY);
    }
    g.computeVertexNormals();
    return g;
  });
}
/** Busto de costura (sem cabeça) com o pé de madeira e a base em tripé de latão. */
export function dressFormParts(): { torso: THREE.BufferGeometry; neck: THREE.BufferGeometry; pole: THREE.BufferGeometry; foot: THREE.BufferGeometry } {
  return {
    torso: geo("formTorso", () => { const g = new THREE.LatheGeometry([[0.14, 0.95], [0.13, 1.05], [0.12, 1.12], [0.15, 1.24], [0.16, 1.32], [0.12, 1.4], [0.06, 1.44], [0.05, 1.5], [0.0, 1.52]].map(([r, y]) => new THREE.Vector2(r, y)), 32); g.scale(1, 1, 0.8); return g; }),
    neck: geo("formNeck", () => new THREE.CylinderGeometry(0.045, 0.05, 0.12, 16).translate(0, 1.56, 0)),
    pole: geo("formPole", () => new THREE.CylinderGeometry(0.018, 0.018, 0.95, 10).translate(0, 0.475, 0)),
    foot: geo("formFoot", () => new THREE.CylinderGeometry(0.2, 0.24, 0.04, 24).translate(0, 0.02, 0)),
  };
}

/** Degradê do tecido (barra → topo) em textura de canvas; com brilho de cetim por cima do material. */
export function gownTexture(key: string, stops: string[]): THREE.Texture {
  return drawnTexture(`gown-${key}`, 8, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0); stops.forEach((c, i) => grd.addColorStop(i / Math.max(1, stops.length - 1), c));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}
/** Tecido de vestido: cetim/tafetá com brilho rasante (sheen) e verniz leve; degradê opcional. */
export function gownMaterial(key: string, color: string, o: { stops?: string[]; sheen?: string; rough?: number; clearcoat?: number } = {}): THREE.MeshPhysicalMaterial {
  return cachedMat(`gownMat-${key}`, () => new THREE.MeshPhysicalMaterial({
    color: o.stops ? "#ffffff" : color, map: o.stops ? gownTexture(key, o.stops) : null, roughness: o.rough ?? 0.42, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(o.sheen ?? "#ffffff"), sheenRoughness: 0.32, clearcoat: o.clearcoat ?? 0.25, clearcoatRoughness: 0.35,
    side: THREE.DoubleSide, envMapIntensity: 1,
  }));
}
const mats = new Map<string, THREE.Material>();
function cachedMat<T extends THREE.Material>(k: string, make: () => T): T { const hit = mats.get(k) as T | undefined; if (hit) return hit; const m = make(); m.name = k; mats.set(k, m); return m; }

/* ---------- estátua clássica ---------- */
/** Figura masculina de mármore em contraposto, braço direito erguido (como a estátua iluminada da referência), 1,75 m. */
export function statueGeometry(variant: number): THREE.BufferGeometry {
  return geo(`statue-${variant}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const cap = (r: number, len: number, a: THREE.Vector3, b: THREE.Vector3) => {
      const g = new THREE.CapsuleGeometry(r, len, 4, 10); const dir = b.clone().sub(a).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); parts.push(g);
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const raise = variant % 2 === 0;
    // pernas em contraposto: a de apoio reta, a livre dobrada
    cap(0.075, 0.38, V(0.09, 0.07, 0), V(0.1, 0.46, 0.02)); cap(0.085, 0.36, V(0.1, 0.48, 0.02), V(0.1, 0.88, 0));
    cap(0.072, 0.38, V(-0.12, 0.08, 0.08), V(-0.1, 0.46, 0.1)); cap(0.084, 0.36, V(-0.1, 0.48, 0.1), V(-0.09, 0.88, 0.02));
    // quadril e drapeado na cintura
    const hips = new THREE.SphereGeometry(0.17, 14, 10).scale(1.05, 0.75, 0.75).translate(0, 0.94, 0.01); parts.push(hips);
    const drape = new THREE.LatheGeometry([[0.2, 0.86], [0.22, 0.92], [0.2, 1.0], [0.16, 1.03]].map(([r, y]) => new THREE.Vector2(r, y)), 18); drape.scale(1, 1, 0.8); parts.push(drape);
    // tronco inclinado (contraposto), peito e cabeça
    const torso = new THREE.CapsuleGeometry(0.16, 0.34, 6, 14).scale(1.05, 1, 0.68).rotateZ(-0.06).translate(0.01, 1.22, 0.01); parts.push(torso);
    parts.push(new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.3, 1).translate(0.015, 1.5, 0.02));                  // pescoço
    parts.push(new THREE.SphereGeometry(0.1, 16, 12).scale(0.9, 1.12, 1).translate(0.02, 1.63, 0.03));              // cabeça
    parts.push(new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.92, 0.9, 1).translate(0.02, 1.66, 0.02)); // cabelo
    // braços: o direito erguido em gesto, o esquerdo junto ao corpo
    if (raise) { cap(0.05, 0.24, V(0.2, 1.36, 0), V(0.32, 1.6, 0.04)); cap(0.045, 0.22, V(0.32, 1.62, 0.04), V(0.36, 1.88, 0.08)); parts.push(new THREE.SphereGeometry(0.05, 10, 8).scale(0.8, 1.2, 0.5).translate(0.37, 1.97, 0.08)); }
    else { cap(0.05, 0.24, V(0.2, 1.36, 0), V(0.25, 1.1, 0.06)); cap(0.045, 0.22, V(0.25, 1.08, 0.06), V(0.22, 0.86, 0.14)); }
    cap(0.05, 0.24, V(-0.2, 1.36, 0), V(-0.24, 1.1, -0.02)); cap(0.045, 0.22, V(-0.24, 1.08, -0.02), V(-0.2, 0.86, 0.04));
    const merged = mergeAll(parts); merged.computeVertexNormals(); return merged;
  });
}
function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; const out = new THREE.BufferGeometry(); out.setAttribute("position", n.getAttribute("position")); return out; });
  const total = flat.reduce((s, g) => s + g.getAttribute("position").count, 0), pos = new Float32Array(total * 3);
  let o = 0; for (const g of flat) { pos.set(g.getAttribute("position").array as Float32Array, o); o += g.getAttribute("position").count * 3; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(total * 2), 2)); return g;
}

/* ---------- palmeira e oliveira ---------- */
function frondTexture(): THREE.Texture {
  return drawnTexture("frond", 256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const R = rand(31);
    // folíolos em pares ao longo da nervura, mais longos no meio
    for (let i = 0; i < 46; i++) {
      const t = i / 46, y = h * (0.04 + t * 0.94), len = w * 0.48 * Math.sin(Math.PI * (0.12 + t * 0.85)) * (0.85 + R() * 0.2);
      for (const s of [-1, 1]) {
        const grd = g.createLinearGradient(w / 2, y, w / 2 + s * len, y - len * 0.3); grd.addColorStop(0, "#2e5a24"); grd.addColorStop(1, "#4f8a36");
        g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * len * 0.5, y - len * 0.22, w / 2 + s * len, y - len * 0.42);
        g.quadraticCurveTo(w / 2 + s * len * 0.5, y - len * 0.1, w / 2, y + 5); g.fill();
      }
    }
    g.strokeStyle = "#5d7f3a"; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  });
}
/** Folha de palmeira: tira curvada (quatro segmentos) com os folíolos recortados por textura. */
export function frondGeometry(): THREE.BufferGeometry {
  return geo("frondGeo", () => {
    const g = new THREE.PlaneGeometry(0.55, 1.3, 1, 8); const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.65, t = y / 1.3; p.setXYZ(i, p.getX(i) * (1 - 0.15 * t), y * Math.cos(t * 0.9), y * Math.sin(t * 0.9) * 0.9 + Math.abs(p.getX(i)) * 0.25); }
    g.computeVertexNormals(); return g;
  });
}
export function frondMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("frondMat", () => new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0.5 }));
}
/** Raminho de oliveira: cartão com folhas estreitas verde-prateadas recortadas por textura (a copa é feita de muitos). */
export function oliveSprigGeometry(): THREE.BufferGeometry {
  return geo("oliveSprig", () => { const g = new THREE.PlaneGeometry(0.34, 0.34, 2, 2); const p = g.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, -0.04 * (p.getX(i) ** 2 + p.getY(i) ** 2) * 6); g.computeVertexNormals(); return g; });
}
export function oliveSprigMaterial(): THREE.MeshStandardMaterial {
  return cachedMat("oliveSprigMat", () => new THREE.MeshStandardMaterial({ map: drawnTexture("oliveSprigTex", 256, 256, (g, w, h) => {
    const R = rand(77); g.clearRect(0, 0, w, h);
    g.strokeStyle = "#5b5a3c"; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.15, h * 0.85); g.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.85, h * 0.15); g.stroke();
    for (let k = 0; k < 16; k++) {
      const t = 0.08 + (k / 16) * 0.84, x = w * (0.15 + 0.7 * t), y = h * (0.85 - 0.7 * t), side = k % 2 ? 1 : -1, a = -Math.PI / 4 + side * (0.7 + R() * 0.4);
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = R() > 0.5 ? "#6f7d54" : "#8f9a72";
      g.beginPath(); g.ellipse(0, -h * 0.07, w * 0.018, h * 0.07, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65, envMapIntensity: 0.5 }));
}
/** Copa podada (oliveira/topiaria): bolas irregulares de folhagem. */
export function canopyGeometry(seed: number): THREE.BufferGeometry {
  return geo(`canopy${seed}`, () => {
    const R = rand(seed), parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 7; k++) { const a = R() * Math.PI * 2, r = 0.15 + R() * 0.25; parts.push(new THREE.IcosahedronGeometry(0.28 + R() * 0.16, 1).translate(Math.cos(a) * r, 0.2 + R() * 0.35, Math.sin(a) * r)); }
    const g = mergeAll(parts); const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const n = 1 + (R() - 0.5) * 0.12; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); }
    g.computeVertexNormals(); return g;
  });
}
