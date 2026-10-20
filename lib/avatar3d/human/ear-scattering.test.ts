import { expect, it } from "vitest";
import * as THREE from "three";
import { installEarScattering, skinMaterial } from "./three-human";

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