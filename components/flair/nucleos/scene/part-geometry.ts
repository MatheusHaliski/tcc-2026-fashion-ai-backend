/**
 * Geometria das partes da sala: cada primitiva da descrição pura (lib/flair/nucleos/scene) vira uma geometria já no
 * lugar, com UV na escala real (a textura repete a cada N metros, em qualquer face), e as partes do mesmo material
 * são fundidas numa geometria só — uma chamada de desenho por material.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aneisDaEsfera, TORO_TUBO } from "@/lib/flair/nucleos/scene/parts";
import type { MaterialDesc, Parte } from "@/lib/flair/nucleos/scene/types";

const RAD = Math.PI / 180;
const CHANFRO_MAX = 0.025;

/** Caixa com as 12 arestas e os 8 cantos chanfrados: 6 faces, 12 faixas de aresta e 8 triângulos de canto. */
export function caixaChanfrada(w: number, h: number, d: number): THREE.BufferGeometry {
  const c = Math.min(CHANFRO_MAX, 0.2 * Math.min(w, h, d));
  const meia = [w / 2, h / 2, d / 2];
  /** ponto do canto (sinais s) que fica na face do eixo `eixo`: recuado do chanfro nos outros dois eixos */
  const ponto = (s: number[], eixo: number) => new THREE.Vector3(...s.map((sinal, i) => sinal * (i === eixo ? meia[i] : meia[i] - c)));
  const tri: THREE.Vector3[][] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, cc: THREE.Vector3, dd: THREE.Vector3) => tri.push([a, b, cc], [a, cc, dd]);
  const sinais = [-1, 1];
  for (let eixo = 0; eixo < 3; eixo++) {
    const u = (eixo + 1) % 3;
    const v = (eixo + 2) % 3;
    for (const s of sinais) {
      const canto = (su: number, sv: number) => {
        const k = [0, 0, 0];
        k[eixo] = s;
        k[u] = su;
        k[v] = sv;
        return k;
      };
      // face principal do eixo
      quad(ponto(canto(-1, -1), eixo), ponto(canto(1, -1), eixo), ponto(canto(1, 1), eixo), ponto(canto(-1, 1), eixo));
      // faixas das arestas entre a face deste eixo e a do eixo u (cada aresta uma vez)
      for (const su of sinais) quad(ponto(canto(su, -1), eixo), ponto(canto(su, 1), eixo), ponto(canto(su, 1), u), ponto(canto(su, -1), u));
    }
  }
  for (const sx of sinais) for (const sy of sinais) for (const sz of sinais) tri.push([0, 1, 2].map((eixo) => ponto([sx, sy, sz], eixo)));
  const pos: number[] = [];
  const normal = new THREE.Vector3();
  const centro = new THREE.Vector3();
  for (const [a, b, cc] of tri) {
    normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(cc, a));
    centro.copy(a).add(b).add(cc);
    // sólido convexo centrado na origem: a face olha para fora quando a normal aponta para longe do centro
    const ordem = normal.dot(centro) >= 0 ? [a, b, cc] : [a, cc, b];
    for (const p of ordem) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function formaDaParte(p: Parte): THREE.BufferGeometry {
  const [a, b, c] = p.tam;
  switch (p.forma) {
    case "caixa":
      return new THREE.BoxGeometry(a, b, c);
    case "chanfrada":
      return caixaChanfrada(a, b, c);
    case "plano":
      return new THREE.PlaneGeometry(a, b);
    case "cilindro":
      return new THREE.CylinderGeometry(a, c, b, p.seg ?? 12, 1);
    case "esfera": {
      const seg = p.seg ?? 12;
      return new THREE.SphereGeometry(1, seg, aneisDaEsfera(seg)).scale(a, b, c);
    }
    case "toro":
      return new THREE.TorusGeometry(a, b, TORO_TUBO, p.seg ?? 24);
    case "extrusao": {
      const shape = new THREE.Shape((p.perfil ?? []).map(([x, y]) => new THREE.Vector2(x, y)));
      return new THREE.ExtrudeGeometry(shape, { depth: c, bevelEnabled: false, steps: 1, curveSegments: 1 });
    }
  }
}

/** UV na escala real: projeta cada vértice no plano da face (pelo eixo dominante da normal), em metros / `repete`. */
function uvNaEscalaReal(g: THREE.BufferGeometry, repete: number): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const deCima = ny >= nx && ny >= nz;
    const deLado = !deCima && nx >= nz;
    uv[i * 2] = (deLado ? pos.getZ(i) : pos.getX(i)) / repete;
    uv[i * 2 + 1] = (deCima ? pos.getZ(i) : pos.getY(i)) / repete;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const UM = new THREE.Vector3(1, 1, 1);

/** Geometria da parte no lugar dela, sem índice, com posição, normal e UV. `repete` 0 mantém o UV da própria face. */
export function geometriaDaParte(p: Parte, repete: number): THREE.BufferGeometry {
  const bruta = formaDaParte(p);
  const g = bruta.index ? bruta.toNonIndexed() : bruta;
  if (g !== bruta) bruta.dispose();
  const rot = p.rot ?? [0, 0, 0];
  _e.set(rot[0] * RAD, rot[1] * RAD, rot[2] * RAD, "YXZ");
  g.applyMatrix4(_m.compose(_p.set(...p.pos), _q.setFromEuler(_e), UM));
  if (repete > 0) uvNaEscalaReal(g, repete);
  else if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  for (const nome of Object.keys(g.attributes)) {
    if (nome !== "position" && nome !== "normal" && nome !== "uv") g.deleteAttribute(nome);
  }
  g.clearGroups();
  return g;
}

/** Funde as partes por material: uma geometria por material usado. */
export function fundirPorMaterial(partes: Parte[], materiais: Record<string, MaterialDesc>): Map<string, THREE.BufferGeometry> {
  const porMaterial = new Map<string, THREE.BufferGeometry[]>();
  for (const p of partes) {
    const repete = materiais[p.mat]?.repete ?? 1;
    const lista = porMaterial.get(p.mat) ?? [];
    lista.push(geometriaDaParte(p, repete));
    porMaterial.set(p.mat, lista);
  }
  const out = new Map<string, THREE.BufferGeometry>();
  for (const [mat, lista] of porMaterial) {
    const fundida = mergeGeometries(lista, false);
    lista.forEach((g) => g.dispose());
    if (fundida) out.set(mat, fundida);
  }
  return out;
}

export function triangulosDe(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/** Pinta a geometria inteira de uma cor, por vértice (figurantes: um material só para todas as cores). */
export function pintarPorVertice(g: THREE.BufferGeometry, cor: string): THREE.BufferGeometry {
  const c = new THREE.Color(cor);
  const n = g.attributes.position.count;
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cores[i * 3] = c.r;
    cores[i * 3 + 1] = c.g;
    cores[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  return g;
}
