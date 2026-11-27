/**
 * As malhas do uniforme (lib/flair/nucleos/uniforme/desenho.ts) montadas sobre o molde do corpo (molde-do-corpo.ts):
 * a estampa que abraça a roupa, a gola e o cinto que contornam o tronco, as dragonas nos ombros, a capa pendurada nas
 * costas e o capacete com a viseira. Cada uma é construída no espaço da malha e levada para o espaço do osso onde fica
 * pendurada. Materiais PBR pelo acabamento da zona (fosco, brilhante, metálico, espelhado).
 */
import * as THREE from "three";
import type { Adereco, Estampa } from "@/lib/flair/nucleos/uniforme/desenho";
import { alturaDoDecote, elipseNaAltura, profundidade, type MoldeDoCorpo } from "@/components/flair/nucleos/scene/uniforme/molde-do-corpo";
import { texturaDaEstampa } from "@/components/flair/nucleos/scene/uniforme/estampas-canvas";

/** Rugosidade, metal e verniz de cada acabamento. */
export function materialDoAcabamento(cor: string, acabamento: string, extra: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
  const base = { FOSCO: [0.82, 0, 0], BRILHANTE: [0.32, 0.05, 0.6], METALICO: [0.3, 0.85, 0.2], ESPELHADO: [0.06, 1, 1] }[acabamento] ?? [0.8, 0, 0];
  return new THREE.MeshPhysicalMaterial({ color: cor, roughness: base[0], metalness: base[1], clearcoat: base[2], ...extra });
}

/** A estampa colada na roupa: uma grade que segue a profundidade da superfície ponto a ponto, 4 mm por fora. */
export function malhaDaEstampa(e: Estampa, molde: MoldeDoCorpo): THREE.Mesh {
  const peito = molde.osso("Spine2");
  const frente = e.lado === "FRENTE";
  const geo = new THREE.PlaneGeometry(e.largura, e.altura, 10, 10);
  const pos = geo.getAttribute("position");
  let ultimo = peito.z + (frente ? 0.12 : -0.12);
  for (let i = 0; i < pos.count; i++) {
    // nas costas, a estampa é vista de trás: o x da grade se inverte para o número não sair espelhado
    const x = peito.x + (frente ? 1 : -1) * (e.x + pos.getX(i));
    const y = peito.y + e.y + pos.getY(i);
    const z = profundidade(molde.pontos, x, y, frente) ?? ultimo;
    ultimo = z;
    pos.setXYZ(i, x, y, z + (frente ? 0.004 : -0.004));
  }
  geo.computeVertexNormals();
  const mat = materialDoAcabamento("#ffffff", e.acabamento, { map: texturaDaEstampa(e), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.Mesh(geo.applyMatrix4(molde.paraOsso("Spine2")), mat);
  m.name = `uniforme-estampa-${e.forma.toLowerCase()}`;
  return m;
}

/** Um anel elíptico (gola, cinto) na altura dada, com o tubo dado. */
function anel(a: Adereco, molde: MoldeDoCorpo, y: number, tubo: number, folga: number): THREE.Mesh | null {
  const el = elipseNaAltura(molde.pontos, y);
  if (!el) return null;
  const geo = new THREE.TorusGeometry(1, tubo, 10, 48);
  geo.rotateX(Math.PI / 2);
  geo.scale(el.rx + folga, 1, el.rz + folga);
  geo.translate(el.cx, y, el.cz);
  return new THREE.Mesh(geo, materialDoAcabamento(a.cor, a.acabamento));
}

/** A capa: presa abaixo do decote, nas costas, caindo até a panturrilha e abrindo para baixo; o vento a move (onda). */
function capa(a: Adereco, molde: MoldeDoCorpo): THREE.Mesh {
  const peito = molde.osso("Spine2");
  const quadril = molde.osso("Hips");
  const topo = alturaDoDecote(molde.pontos, peito) - 0.03;
  const costas = (profundidade(molde.pontos, peito.x, topo, false, 0.04) ?? peito.z - 0.12) - 0.025;
  const comprimento = topo - (quadril.y - 0.62);
  const geo = new THREE.PlaneGeometry(1, 1, 8, 14);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = 0.5 - pos.getY(i);
    const largura = 0.3 + 0.32 * v;
    pos.setXYZ(i, peito.x + u * largura, topo - v * comprimento, costas - 0.16 * v * v - 0.03 * Math.cos(u * Math.PI) * v);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, materialDoAcabamento(a.cor, a.acabamento, { side: THREE.DoubleSide, sheen: 0.6, sheenColor: new THREE.Color(a.cor2) }));
  m.userData.capa = { topo, comprimento };
  return m;
}

/** O capacete: o casco na cor do topo, a faixa no meio e a viseira na frente, sobre a cabeça em repouso. */
function capacete(a: Adereco, molde: MoldeDoCorpo, corpo: Float32Array): THREE.Group {
  const cabeca = molde.osso("Head");
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < corpo.length; i += 3) {
    if (corpo[i + 1] < cabeca.y - 0.02) continue;
    x0 = Math.min(x0, corpo[i]);
    x1 = Math.max(x1, corpo[i]);
    y1 = Math.max(y1, corpo[i + 1]);
    z0 = Math.min(z0, corpo[i + 2]);
    z1 = Math.max(z1, corpo[i + 2]);
  }
  const r = Math.max(0.1, Math.max(x1 - x0, z1 - z0) / 2) * 1.22;
  const centro = new THREE.Vector3((x0 + x1) / 2, y1 - r * 0.78, (z0 + z1) / 2);
  const g = new THREE.Group();
  const casco = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.78), materialDoAcabamento(a.cor, "BRILHANTE"));
  const faixa = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, r * 0.06, 8, 48, Math.PI * 1.25), materialDoAcabamento(a.cor2, "BRILHANTE"));
  faixa.rotation.set(0, Math.PI / 2, Math.PI * 0.62);
  const viseira = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 32, 16, -Math.PI * 0.33, Math.PI * 0.66, Math.PI * 0.36, Math.PI * 0.2),
    materialDoAcabamento(a.cor3 ?? "#1A1D24", a.acabamento === "FOSCO" ? "ESPELHADO" : a.acabamento));
  viseira.rotation.y = Math.PI / 2;
  for (const p of [casco, faixa, viseira]) {
    p.position.copy(centro);
    g.add(p);
  }
  g.applyMatrix4(molde.paraOsso("Head"));
  return g;
}

/** O adereço montado e o osso onde ele fica pendurado (nulo quando o molde não deu onde pôr). */
export function malhaDoAdereco(a: Adereco, molde: MoldeDoCorpo, corpo: Float32Array): { objeto: THREE.Object3D; osso: string } | null {
  const peito = molde.osso("Spine2");
  if (a.tipo === "CAPACETE") return { objeto: capacete(a, molde, corpo), osso: "Head" };
  let objeto: THREE.Object3D | null = null;
  if (a.tipo === "GOLA") objeto = anel(a, molde, alturaDoDecote(molde.pontos, peito) - 0.012, 0.012, 0.004);
  else if (a.tipo === "CINTO") objeto = anel(a, molde, molde.osso("Hips").y + 0.09, 0.02, 0.006);
  else if (a.tipo === "CAPA") objeto = capa(a, molde);
  else {
    const ombro = molde.osso(a.osso);
    const x = ombro.x + Math.sign(ombro.x || 1) * 0.06;
    const topo = topoNoOmbro(molde.pontos, x, ombro.y);
    const y = (Number.isFinite(topo) ? topo : ombro.y) + 0.012;
    const geo = new THREE.BoxGeometry(0.1, 0.022, 0.12);
    geo.translate(x, y, ombro.z);
    objeto = new THREE.Mesh(geo, materialDoAcabamento(a.cor, a.acabamento));
  }
  if (!objeto) return null;
  if (objeto instanceof THREE.Mesh) objeto.geometry.applyMatrix4(molde.paraOsso("Spine2"));
  objeto.name = `uniforme-${a.tipo.toLowerCase()}`;
  return { objeto, osso: "Spine2" };
}

/** O ponto mais alto da roupa na vertical do ombro (até 15 cm acima do osso, para não pegar a cabeça). */
function topoNoOmbro(pontos: Float32Array, x: number, ombroY: number): number {
  let topo = -Infinity;
  for (let i = 0; i < pontos.length; i += 3) {
    if (Math.abs(pontos[i] - x) < 0.02 && pontos[i + 1] < ombroY + 0.15) topo = Math.max(topo, pontos[i + 1]);
  }
  return topo;
}
