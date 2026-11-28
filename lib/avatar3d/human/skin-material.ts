/*
 * Avatar 3D (RF40) — material da pele do corpo e o espalhamento quente da orelha contra a luz.
 */
import * as THREE from "three";
import type { HumanLook } from "./three-human";

export function skinMaterial(look: HumanLook): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: look.skinMap ? "#ffffff" : look.skin, map: look.skinMap ?? null, roughness: 0.55, metalness: 0,
    // sheen discreto e quase na cor da própria pele: o véu claro de antes esbranquiçava o corpo sob a luz do estúdio
    sheen: 0.22, sheenRoughness: 0.6, sheenColor: new THREE.Color(look.skin).lerp(new THREE.Color("#ffd9c8"), 0.18),
  });
  m.name = "pele";
  return m;
}

/**
 * Pele da orelha: a pinna é fina e vascularizada, portanto precisa de uma resposta quente quando recebe luz de
 * contraluz. A máscara vem da topologia do asset, não de uma heurística por UV, para acompanhar a forma do rosto.
 */
export function installEarScattering(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\nattribute float earMask;\nvarying float vEarMask;`);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>\n  vEarMask = earMask;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying float vEarMask;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      #if NUM_DIR_LIGHTS > 0
        vec3 earTransmission = vec3(0.0);
        for (int earLight = 0; earLight < NUM_DIR_LIGHTS; earLight++) {
          float earBacklight = pow(max(dot(-normal, directionalLights[earLight].direction), 0.0), 2.0);
          earTransmission += directionalLights[earLight].color * earBacklight;
        }
        outgoingLight += vEarMask * diffuseColor.rgb * vec3(1.0, 0.28, 0.14) * earTransmission * 0.18;
      #endif
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "avatar-skin-ear-scattering-v2";
}

/** Binary topological masks need 255 when normalized as an unsigned-byte attribute. */
export function earMaskAttribute(mask:Uint8Array,vertices:Uint32Array|Uint16Array){
  return new THREE.BufferAttribute(Uint8Array.from(vertices,v=>mask[v]?255:0),1,true);
}
