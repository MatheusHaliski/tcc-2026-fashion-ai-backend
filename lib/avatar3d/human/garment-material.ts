/*
 * Avatar 3D (RF40) / Provador — material da peça: aspereza/brilho por tecido e a mistura foto × tecido no shader.
 */
import * as THREE from "three";
import { installDenimWeave } from "./denim-weave";
import type { GarmentSpec } from "./garment-spec";

export function fabricSurface(material?: string): { roughness: number; sheen: number } | null {
  switch (material?.toUpperCase()) {
    case "DENIM": case "CANVAS": return { roughness: .94, sheen: .08 };
    case "COTTON": case "LINEN": return { roughness: .88, sheen: .25 };
    case "WOOL": case "CASHMERE": case "FLEECE": case "KNIT": return { roughness: .93, sheen: .5 };
    case "SILK": case "SATIN": return { roughness: .4, sheen: .65 };
    case "LEATHER": return { roughness: .55, sheen: .08 };
    default: return null;
  }
}

export function garmentMaterial(tex: THREE.Texture, sp: GarmentSpec): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: sp.construction === "cargo" ? .94 : sp.kind === "jacket" || sp.kind === "coat" ? 0.7 : 0.85,
    sheen: sp.construction === "cargo" ? .08 : sp.kind === "jacket" || sp.kind === "coat" ? 0.15 : 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff"), polygonOffset: true, polygonOffsetFactor: -sp.layer, polygonOffsetUnits: -sp.layer,
  });
  const surface = fabricSurface(sp.fabric);
  if (surface) { m.roughness = surface.roughness; m.sheen = surface.sheen; }
  m.name = `roupa-${sp.kind}`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
      attribute vec2 fabricUv; attribute float photoWeight;
      varying vec2 vGarmentFabricUv; varying float vGarmentPhotoWeight;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vGarmentFabricUv = fabricUv; vGarmentPhotoWeight = photoWeight;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      varying vec2 vGarmentFabricUv; varying float vGarmentPhotoWeight;`)
      .replace("#include <map_fragment>", `#ifdef USE_MAP
        vec4 garmentPhoto = texture2D(map, vMapUv);
        vec4 garmentFabric = texture2D(map, vGarmentFabricUv);
        diffuseColor *= mix(garmentFabric, garmentPhoto, clamp(vGarmentPhotoWeight, 0.0, 1.0));
      #endif`);
  };
  const compile = m.onBeforeCompile;
  if (sp.weave === "denim" || sp.fabric === "DENIM") m.onBeforeCompile = (shader, renderer) => { compile.call(m, shader, renderer); installDenimWeave(shader); };
  m.customProgramCacheKey = () => `garment-fabric-blend-v2-${sp.weave === "denim" || sp.fabric === "DENIM" ? "denim" : "plain"}`;
  return m;
}

