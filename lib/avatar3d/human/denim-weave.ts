import type * as THREE from 'three';

/** Approximate 3/1 twill relief in metres; never generates a brand's wash, seams or logos. */
export function installDenimWeave(shader: THREE.WebGLProgramParametersWithUniforms): void {
 shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDenimRest;')
  .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDenimRest = position;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDenimRest;')
  .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    // Stable in the undeformed garment, so the weave follows skinning rather than sliding in world space.
    vec2 denimThreads = vDenimRest.xy / 0.00065;
    float denimPhase = 6.28318530718 * (denimThreads.x + denimThreads.y * 0.25);
    // Attenuate subpixel thread detail to prevent moiré in distant full-body views.
    float denimVisibility = 1.0 - smoothstep(0.7, 2.5, fwidth(denimPhase));
    float denimHeight = 0.000045 * sin(denimPhase) * denimVisibility;
    vec3 denimDx = dFdx(-vViewPosition), denimDy = dFdy(-vViewPosition);
    vec3 denimRx = cross(denimDy, normal), denimRy = cross(normal, denimDx);
    float denimDet = dot(denimDx, denimRx);
    if (abs(denimDet) > 1e-12) {
      normal = normalize(abs(denimDet) * normal - sign(denimDet) *
        (dFdx(denimHeight) * denimRx + dFdy(denimHeight) * denimRy));
    }
  `);
}
