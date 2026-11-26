import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * GLB sintético no formato do motor de peças (services/garment_blender): uma malha só, um material por papel
 * (corpo, linha, dentes, botao, faixa_barra, estampa_0) e COLOR_0 como rótulo de parte (corpo 0,1; manga 0,3).
 * Sem textura (o jsdom não tem canvas) e sem marca ou dado pessoal.
 */
const ROLES = ["corpo", "linha", "dentes", "botao", "faixa_barra", "estampa_0"] as const;

function labelled(geometry: THREE.BufferGeometry, label: number): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = plain.getAttribute("position").count;
  plain.setAttribute("color", new THREE.Float32BufferAttribute(new Array(count * 3).fill(label), 3));
  plain.deleteAttribute("uv");
  plain.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(count * 2).fill(0.5), 2));
  return plain;
}

function at(geometry: THREE.BufferGeometry, x: number, y: number, z: number, label = 0.1) {
  geometry.translate(x, y, z);
  return labelled(geometry, label);
}

function pieces(): THREE.BufferGeometry[] {
  const body = mergeGeometries([
    at(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 24, 14, true), 0, 0.65, 0),
    at(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8, 6, true).rotateZ(Math.PI / 2), 0.5, 0.9, 0, 0.3),
    at(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8, 6, true).rotateZ(Math.PI / 2), -0.5, 0.9, 0, 0.3),
  ]);
  return [
    body,
    at(new THREE.TorusGeometry(0.252, 0.003, 4, 24).rotateX(Math.PI / 2), 0, 0.9, 0),
    at(new THREE.BoxGeometry(0.01, 0.6, 0.01), 0, 0.65, 0.252),
    at(new THREE.BoxGeometry(0.02, 0.02, 0.005), 0.05, 0.8, 0.252),
    at(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 24, 1, true), 0, 0.325, 0),
    at(new THREE.PlaneGeometry(0.1, 0.06), 0.1, 0.75, 0.254),
  ];
}

export async function engineGarmentGlb(): Promise<ArrayBuffer> {
  const geometry = mergeGeometries(pieces(), true);
  geometry.computeVertexNormals();
  const materials = ROLES.map((name) => {
    const material = new THREE.MeshStandardMaterial({ color: name === "corpo" ? "#203040" : "#c0c0c0", vertexColors: true });
    material.name = name;
    return material;
  });
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = "camiseta";
  const scene = new THREE.Scene();
  scene.add(mesh);
  const bytes = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  geometry.dispose();
  materials.forEach((material) => material.dispose());
  return bytes;
}

/** "Relevo da foto" (RF16): um bloco com um material só, "foto-da-peca", como o GlbWriter do servidor grava. */
export async function photoReliefGlb(): Promise<ArrayBuffer> {
  const material = new THREE.MeshStandardMaterial();
  material.name = "foto-da-peca";
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.05), material));
  return (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
}
