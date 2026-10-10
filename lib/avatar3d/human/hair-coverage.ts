import type * as THREE from "three";

/** The interior of a surviving fiber is opaque. MSAA smooths only its cutout edge;
 * keeping the atlas alpha everywhere turns a whole ribbon into a translucent veil.
 */
const HAIR_COVERAGE = /* glsl */ `
#ifdef USE_ALPHATEST
  if ( diffuseColor.a < alphaTest ) discard;
  #ifdef ALPHA_TO_COVERAGE
    if ( hairCoverageAA > 0.5 ) {
      float hairEdgeWidth = clamp( fwidth( diffuseColor.a ), 0.001, 0.12 );
      diffuseColor.a = smoothstep( alphaTest, alphaTest + hairEdgeWidth, diffuseColor.a );
    } else {
      diffuseColor.a = 1.0;
    }
  #else
    diffuseColor.a = 1.0;
  #endif
#endif
`;

/** Read the framebuffer at draw time, since a multisampled canvas can render to a
 * single-sample target too. An absent/unknown context uses opaque cutouts safely.
 */
export function installHairCoverage(material: THREE.Material): { value: number } {
  const coverage = { value: 0 };
  const beforeCompile = material.onBeforeCompile;
  const beforeRender = material.onBeforeRender;
  const cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    beforeCompile.call(material, shader, renderer);
    shader.uniforms.hairCoverageAA = coverage;
    shader.fragmentShader = "uniform float hairCoverageAA;\n" +
      shader.fragmentShader.replace("#include <alphatest_fragment>", HAIR_COVERAGE);
  };
  material.onBeforeRender = (renderer, ...args) => {
    beforeRender.call(material, renderer, ...args);
    const gl = renderer?.getContext?.();
    const samples = gl?.getParameter(gl.SAMPLES);
    coverage.value = typeof samples === "number" && samples > 1 ? 1 : 0;
  };
  material.customProgramCacheKey = () => `${cacheKey}|fai-hair-cutout-v1`;
  return coverage;
}
