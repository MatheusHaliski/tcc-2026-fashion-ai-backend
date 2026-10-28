/*
 * MET Gala Heist v2 — geometrias da cena externa: caixas com UV em metros (as texturas de exterior-textures.ts emendam de
 * peça em peça), molduras extrudadas por perfil, sólidos de revolução (bases, balaústres, postes), fuste canelado com
 * êntase, capitel coríntio aproximado, arcos e a fusão de tudo o que divide material numa malha só (poucas chamadas de
 * desenho).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** UV por projeção de caixa em coordenadas de mundo (1 unidade = 1 m), pelo eixo dominante da normal de cada vértice. */
export function worldUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal");
  if (!nor) geo.computeVertexNormals();
  const n = geo.getAttribute("normal"), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = n.getX(i) > 0 ? -z : z; uv[i * 2 + 1] = y; }
    else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = n.getY(i) > 0 ? -z : z; }
    else { uv[i * 2] = n.getZ(i) > 0 ? x : -x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Caixa já no lugar (cantos min/max), com UV de mundo. */
export function boxGeo(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g);
}

/** Junta geometrias (todas viram não indexadas, com position/normal/uv) numa só. */
export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = list.filter(Boolean).map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute("normal")) x.computeVertexNormals();
    if (!x.getAttribute("uv")) x = worldUV(x);
    for (const name of Object.keys(x.attributes)) if (!["position", "normal", "uv"].includes(name)) x.deleteAttribute(name);
    x.clearGroups();
    return x;
  });
  const out = prepared.length ? mergeGeometries(prepared, false) : new THREE.BufferGeometry();
  return out ?? new THREE.BufferGeometry();
}

/** Aplica posição, giro em y e escala (no lugar) e devolve a mesma geometria. */
export function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0, s: number | [number, number, number] = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
  return g.applyMatrix4(m);
}

/** Moldura: perfil (z para fora da parede, y para cima) extrudado ao longo de +x, de 0 a `length`. */
export function molding(profile: [number, number][], length: number): THREE.BufferGeometry {
  const sh = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: length, bevelEnabled: false, curveSegments: 4 });
  // a extrusão sai em +Z com o perfil em XY; troca X↔Z (gira 90° em y e espelha z): comprimento em +X, perfil para +Z.
  // O espelho inverte a ordem dos triângulos — fixWinding devolve as faces para fora.
  g.rotateY(Math.PI / 2); g.scale(1, 1, -1);
  return fixWinding(g);
}
/** Moldura pronta na fachada sul (para fora = +z), de x0 a x1, encostada no plano z = wall. */
export function moldingSouth(profile: [number, number][], x0: number, x1: number, wall: number, y = 0): THREE.BufferGeometry {
  const g = molding(profile, x1 - x0); g.translate(x0, y, wall); return worldUV(g);
}
/** Garante faces para fora depois de espelhar (scale −1 inverte a ordem dos triângulos). */
export function fixWinding(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const x = g.index ? g.toNonIndexed() : g; const p = x.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) { for (let k = 0; k < 3; k++) { const a = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, a); } }
  x.computeVertexNormals(); return x;
}
/** Leva uma geometria feita para a fachada sul (para fora = +z) a outra face: east (+x), north (−z) ou west (−x),
 * girando em torno do canto (ox, oz). */
export function toFace(g: THREE.BufferGeometry, face: "south" | "east" | "north" | "west"): THREE.BufferGeometry {
  const rot = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[face];
  if (rot) g.rotateY(rot);
  return g;
}

/** Sólido de revolução a partir de pontos (raio, altura); UV em metros (u ao redor, v na altura). */
export function lathe(points: [number, number][], segments = 24, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments, phiStart, phiLength);
  const uv = g.getAttribute("uv"), pos = g.getAttribute("position");
  const rMax = Math.max(...points.map((p) => p[0]));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * rMax, pos.getY(i));
  return g;
}

/** Fuste canelado com êntase (afina 12 % em cima): `flutes` caneluras côncavas separadas por filetes. */
export function flutedShaft(r0: number, h: number, flutes = 24, rings = 14, depth = 0.026): THREE.BufferGeometry {
  const seg = flutes * 6, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, y = t * h, r = r0 * (1 - 0.12 * Math.pow(t, 1.4));
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, ph = ((i % 6) / 6);
      // canelura: meio círculo em 5/6 do passo, filete reto no resto
      const k = ph < 5 / 6 ? Math.sin((ph / (5 / 6)) * Math.PI) : 0;
      const rr = r - depth * k * (r / r0);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); uv.push((i / seg) * Math.PI * 2 * r0, y);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Base ática da coluna (toro, escócia, toro) sobre o plinto quadrado. Altura ~0,42 m. */
export function atticBase(r: number): THREE.BufferGeometry {
  const plinth = boxGeo(-r * 1.32, 0, -r * 1.32, r * 1.32, 0.14, r * 1.32);
  const b = lathe([[0, 0.14], [r * 1.28, 0.14], [r * 1.31, 0.17], [r * 1.28, 0.22], [r * 1.18, 0.24], [r * 1.06, 0.25], [r * 1.02, 0.29], [r * 1.08, 0.31], [r * 1.12, 0.34], [r * 1.08, 0.38], [r * 1.02, 0.4], [r, 0.42], [0, 0.42]], 32);
  return merge([plinth, b]);
}

/** Capitel coríntio aproximado: campana, duas fileiras de folhas de acanto curvadas para fora, volutas nos cantos e
 * ábaco de lados côncavos com a flor no meio. Altura `h` (~1,1 m), raio de baixo `r`. */
export function corinthianCapital(r: number, h = 1.1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(lathe([[0, 0], [r * 1.0, 0], [r * 1.02, 0.04], [r * 0.98, 0.07], [r * 1.0, h * 0.3], [r * 1.08, h * 0.62], [r * 1.22, h * 0.84], [0, h * 0.84]], 32));
  // folhas: faixa curva (8 por fileira), dobrando para fora no topo
  const leaf = (row: number, k: number) => {
    const n = 8, a = (k / n) * Math.PI * 2 + (row ? Math.PI / n : 0), lh = row ? h * 0.6 : h * 0.38, base = row ? h * 0.12 : 0.02, w = r * (row ? 0.62 : 0.72);
    const g = new THREE.PlaneGeometry(w, lh, 3, 6); const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = Math.max(0, p.getY(i) + lh / 2), t = Math.min(1, y / lh);     // sem t < 0 (pow de negativo = NaN)
      const out = 0.04 + 0.22 * Math.pow(t, 2.2) * r * 3.2 * 0.25, lobe = 0.03 * Math.sin((x / w) * Math.PI * 6) * t;
      const narrow = 1 - 0.55 * Math.pow(t, 3);
      p.setXYZ(i, x * narrow, y + base - (t > 0.82 ? (t - 0.82) * lh * 0.9 : 0), r * (1 + (row ? 0.14 : 0.05)) + out + lobe);
    }
    g.computeVertexNormals(); g.rotateY(a + Math.PI / 2); return worldUV(g);
  };
  for (let row = 0; row < 2; row++) for (let k = 0; k < 8; k++) parts.push(leaf(row, k));
  // volutas: quatro espirais (toros) nos cantos, sob o ábaco
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, t = new THREE.TorusGeometry(r * 0.17, r * 0.06, 6, 14, Math.PI * 1.6);
    t.rotateY(a + Math.PI / 2); t.translate(Math.cos(a) * r * 1.22, h * 0.8, -Math.sin(a) * r * 1.22); parts.push(worldUV(t));
  }
  // ábaco: losango de lados côncavos (aprox.: quadrado com cantos chanfrados) + flor central em cada face
  const ab = new THREE.Shape(); const s = r * 1.42, c = r * 0.22;
  ab.moveTo(-s + c, -s); ab.quadraticCurveTo(0, -s + c * 0.9, s - c, -s); ab.lineTo(s, -s + c); ab.quadraticCurveTo(s - c * 0.9, 0, s, s - c); ab.lineTo(s - c, s);
  ab.quadraticCurveTo(0, s - c * 0.9, -s + c, s); ab.lineTo(-s, s - c); ab.quadraticCurveTo(-s + c * 0.9, 0, -s, -s + c); ab.closePath();
  const abg = new THREE.ExtrudeGeometry(ab, { depth: h * 0.13, bevelEnabled: false, curveSegments: 6 }); abg.rotateX(-Math.PI / 2); abg.translate(0, h * 0.84, 0); parts.push(worldUV(abg));
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, f = new THREE.SphereGeometry(r * 0.1, 8, 6); f.scale(1, 1, 0.5); f.translate(Math.cos(a) * (s - c * 0.6), h * 0.9, -Math.sin(a) * (s - c * 0.6)); parts.push(worldUV(f)); }
  return merge(parts);
}

/** Forma de parede (retângulo) com vãos em arco pleno: cada vão é {cx, w (largura), spring (altura do nascimento)}. */
export function archedWall(x0: number, x1: number, y0: number, y1: number, arches: { cx: number; w: number; spring: number; sill?: number }[], depth: number): THREE.BufferGeometry {
  const sh = new THREE.Shape(); sh.moveTo(x0, y0); sh.lineTo(x1, y0); sh.lineTo(x1, y1); sh.lineTo(x0, y1); sh.closePath();
  for (const a of arches) {
    const h = new THREE.Path(), r = a.w / 2, sill = a.sill ?? y0;
    h.moveTo(a.cx - r, sill); h.lineTo(a.cx - r, a.spring); h.absarc(a.cx, a.spring, r, Math.PI, 0, true); h.lineTo(a.cx + r, sill); h.closePath();
    sh.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 18 });
  return g;
}

/** Catenária (corda pendurada entre dois pontos) como tubo. */
export function ropeGeo(a: THREE.Vector3, b: THREE.Vector3, sag: number, radius: number, seg = 16): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, radius, 6, false);
}

/** Tubo por uma lista de pontos (ferro fundido, corrimãos, braço do poste). */
export function tubeThrough(points: [number, number, number][], radius: number, seg = 24, radial = 8): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, radius, radial, false);
}

/** Perfil de carro (comprimento em x, altura em y) extrudado na largura (z), com borda arredondada. */
export function carShell(profile: [number, number][], width: number, bevel = 0.06): THREE.BufferGeometry {
  const sh = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Matriz de instância (posição, giro em y, escala). */
export function inst(x: number, y: number, z: number, rotY = 0, s: number | [number, number, number] = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
}
export function instEuler(x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number | [number, number, number] = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
}
