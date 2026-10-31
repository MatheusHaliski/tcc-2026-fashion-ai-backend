"use client";
/*
 * MET Gala Heist v2 — móveis próprios da planta vindos de modelos 3D gerados (Meshy): para cada "fixture" com entrada no
 * manifesto (lib/heist/models.ts), carrega o GLB de public/heist/models/ (meshopt + WebP), ajusta a escala pela altura
 * real ou pela pegada do móvel, põe a base no chão (floorY) no centro da pegada com o giro da planta e entrega ao grupo
 * da sala (interior: a visibilidade por sala continua valendo) ou ao grupo da rua. O desenho procedural desse móvel é
 * pulado em interior-props.ts (buildProp) quando há modelo. Um GLB é baixado uma vez e clonado para cada ocorrência.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { floorY } from "@/lib/heist/level";
import { MODELS, hasModel, type ModelDef } from "@/lib/heist/models";
import type { Prop } from "@/lib/heist/types";
import { applyRoomEnv } from "./interior-fx";
import { foot } from "./interior-props";
import { isInterior, type InteriorRoom } from "./interior-shell";
import type { Quality } from "./interior-tex";

export const MODELS_BASE = "/heist/models/";
const cache = new Map<string, Promise<GLTF>>();
let loader: GLTFLoader | null = null;
function load(file: string): Promise<GLTF> {
  let p = cache.get(file);
  if (!p) {
    if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
    p = loader.loadAsync(MODELS_BASE + file);
    cache.set(file, p);
  }
  return p;
}

/**
 * Encaixa a cópia do modelo na pegada do móvel: escala pela altura real (fit "height") ou para caber na largura e na
 * profundidade da pegada (fit "footprint"), base no chão, centro da caixa no centro da pegada, giro da planta.
 * Devolve o grupo pronto para entrar na cena (puro: testável sem GPU).
 */
export function placeModel(obj: THREE.Object3D, def: ModelDef, p: Prop): THREE.Group {
  const f = foot(p);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const sx = Math.max(size.x, 1e-3), sy = Math.max(size.y, 1e-3), sz = Math.max(size.z, 1e-3);
  const s = def.fit === "footprint" ? Math.min(f.w / sx, f.d / sz) : def.height / sy;
  const g = new THREE.Group(); g.name = `modelo-${p.model}`;
  // o grupo interno compensa o deslocamento que o modelo já traz (a caixa foi medida com ele): o objeto não é mexido
  const inner = new THREE.Group();
  inner.scale.setScalar(s);
  inner.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  inner.add(obj); g.add(inner);
  g.position.set(f.cx, floorY({ x: f.cx, z: f.cz }) + (def.lift ?? 0), f.cz);
  g.rotation.y = f.yaw + (def.yaw ?? 0);
  g.userData.room = p.room; g.userData.model = p.model;
  return g;
}

/** Os móveis da lista que têm modelo no manifesto. */
export const modeledProps = (props: Prop[]) => props.filter((p) => p.kind === "fixture" && hasModel(p.model));

export function HeistModels({ props, rooms, parent, quality, onProgress }: {
  props: Prop[];
  /** grupos por sala do interior (interior-build) — os modelos de salas internas entram neles */
  rooms?: Map<InteriorRoom, THREE.Group>;
  /** grupo da rua/beco (exterior) para os móveis de fora */
  parent?: THREE.Group;
  quality: Quality;
  onProgress?: (done: number, total: number) => void;
}) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const list = modeledProps(props);
    if (!list.length) { onProgress?.(0, 0); return; }
    let alive = true, done = 0; const placed: THREE.Group[] = [];
    for (const p of list) {
      const def = MODELS[p.model!];
      load(def.file).then((gltf) => {
        if (!alive) return;
        const g = placeModel(gltf.scene.clone(true), def, p);
        g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = quality === "high"; m.receiveShadow = true; } });
        const room = p.room;
        if (isInterior(room) && rooms?.get(room)) { applyRoomEnv(g, room, gl); rooms.get(room)!.add(g); }
        else if (parent) parent.add(g);
        else return;
        placed.push(g);
      }).catch((e: unknown) => { console.warn(`modelo ${p.model} (${def.file}) não carregou`, e); }).finally(() => { if (alive) onProgress?.(++done, list.length); });
    }
    return () => { alive = false; for (const g of placed) g.parent?.remove(g); };
  }, [props, rooms, parent, quality, gl, onProgress]);
  return null;
}
