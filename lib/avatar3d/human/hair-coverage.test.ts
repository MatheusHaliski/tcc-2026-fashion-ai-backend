import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { installHairCoverage } from "./hair-coverage";
import { strandMaterial } from "./hair-strands";

const shader = () => ({ uniforms: {} as Record<string, THREE.IUniform>, vertexShader: "", fragmentShader: "#include <alphatest_fragment>\n#include <lights_fragment_end>" });
const draw = (material: THREE.Material, renderer: THREE.WebGLRenderer) =>
  material.onBeforeRender(renderer, {} as THREE.Scene, {} as THREE.Camera, {} as THREE.BufferGeometry, {} as THREE.Object3D, {} as THREE.Group);

describe("hair coverage across framebuffers", () => {
  it("uses an opaque fallback until the actual draw has multisampling, including target switches without recompiling", () => {
    const material = strandMaterial("#b98e58", 2);
    const compiled = shader();
    material.onBeforeCompile(compiled as never, {} as THREE.WebGLRenderer);
    const coverage = compiled.uniforms.hairCoverageAA;
    expect(coverage.value).toBe(0); // No context does not mean that MSAA exists.

    let samples = 4;
    const gl = { SAMPLES: 32937, getParameter: vi.fn(() => samples) };
    const renderer = { getContext: () => gl } as unknown as THREE.WebGLRenderer;
    draw(material, renderer);
    expect(coverage.value).toBe(1);
    samples = 0;
    draw(material, renderer);
    expect(coverage.value).toBe(0);
    samples = 4;
    draw(material, renderer);
    expect(coverage.value).toBe(1);
    draw(material, {} as THREE.WebGLRenderer);
    expect(coverage.value).toBe(0);
    expect(gl.getParameter).toHaveBeenCalledTimes(3);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it("chains grooming shaders and render callbacks; every LOD clips the empty atlas and preserves opaque fiber interiors", () => {
    for (const lod of [0, 1, 2, 3] as const) {
      const material = strandMaterial("#b98e58", lod);
      const compiled = shader();
      material.onBeforeCompile(compiled as never, {} as THREE.WebGLRenderer);
      expect(compiled.fragmentShader).toContain("if ( diffuseColor.a < alphaTest ) discard;");
      expect(compiled.fragmentShader).toContain("diffuseColor.a = 1.0;");
      expect(compiled.fragmentShader).toContain("clamp( fwidth( diffuseColor.a ), 0.001, 0.12 )");
      expect(compiled.fragmentShader).not.toContain("diffuseColor.a < 0.004");
      expect(compiled.fragmentShader).toContain("hairShift1");
      expect(material.color.getHexString()).toBe("b98e58");
    }

    const material = new THREE.MeshPhysicalMaterial({ alphaTest: 0.3, alphaToCoverage: true });
    const beforeRender = vi.fn(); material.onBeforeRender = beforeRender;
    const beforeCompile = vi.fn(); material.onBeforeCompile = beforeCompile;
    installHairCoverage(material);
    material.onBeforeCompile(shader() as never, {} as THREE.WebGLRenderer);
    draw(material, {} as THREE.WebGLRenderer);
    expect(beforeCompile).toHaveBeenCalledOnce();
    expect(beforeRender).toHaveBeenCalledOnce();
  });
});
