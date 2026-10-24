import { expect, it } from "vitest";
import * as THREE from "three";
import { installEarScattering, skinMaterial, earMaskAttribute } from "./three-human";

it("injects ear backlighting into the installed physical shader before output", () => {
  const material = skinMaterial({ skin: "#80533f" });
  installEarScattering(material);
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain("attribute float earMask;");
  expect(shader.vertexShader).toContain("vEarMask = earMask;");
  expect(shader.fragmentShader).toContain("dot(-normal, directionalLights[earLight].direction)");
  expect(shader.fragmentShader).toContain("vEarMask * diffuseColor.rgb");
  expect(shader.fragmentShader.indexOf("vec3 earTransmission")).toBeLessThan(shader.fragmentShader.indexOf("#include <opaque_fragment>"));
  expect(material.customProgramCacheKey()).toBe("avatar-skin-ear-scattering-v2");
  material.dispose();
});

it("keeps the normalized ear mask at full strength rather than one over 255",()=>{
 const attribute=earMaskAttribute(new Uint8Array([0,1,1]),new Uint32Array([2,0,1]));
 expect(attribute.getX(0)).toBe(1);expect(attribute.getX(1)).toBe(0);expect(attribute.getX(2)).toBe(1);
});
