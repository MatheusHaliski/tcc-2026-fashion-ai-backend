/*
 * Avatar 3D (RF40) — fios de cabelo: atlas de fibras e o material com brilho de fio Kajiya-Kay.
 */
import * as THREE from "three";
import type { HairLod } from "./hair-lod";
import { installHairCoverage } from "./hair-coverage";
import { rng } from "./strand-math";

// ------------------------------------------------------------------ textura de fibras

/**
 * Atlas de fibras: 8 colunas (uma mecha cada) com ~40 fios finos (0,4–1,2 px) cada, mais densos no meio da mecha e
 * mais fracos e ralos na borda (a fita não tem borda dura), alguns interrompidos (fios que acabam e recomeçam).
 * O fundo fica vazio: um véu de baixo alfa por trás revelava placas translúcidas nas mechas externas.
 */
function fiberTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 512, H = 512, C = 8; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); if (!g) return null;
  const r = rng(11); g.clearRect(0, 0, W, H);
  const gauss = () => (r() + r() + r() + r() - 2) / 1.15;                  // ~normal, desvio ≈ 0,5
  for (let c = 0; c < C; c++) {
    const x0 = (c * W) / C, cw = W / C, mid = x0 + cw / 2;
    for (let f = 0; f < 40; f++) {
      const o = Math.max(-0.45, Math.min(0.45, gauss() * 0.24)); const x = mid + o * cw; const edge = Math.abs(o) / 0.45;
      const a = (0.65 + r() * 0.35) * (1 - 0.6 * edge);
      const ph = r() * 6.28, per = 70 + r() * 110, amp = 0.25 + r() * 0.6;
      // A textura só define cobertura. Pintar brilho nela somava faixas claras ao reflexo e cintilava ao girar.
      g.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.lineWidth = 0.7 + r() * 0.65; g.beginPath();
      let pen = true; g.moveTo(x + Math.sin(ph) * amp, 0);
      for (let y = 4; y <= H; y += 4) {
        const xx = x + Math.sin((y / per) * 6.283 + ph) * amp;
        if (pen ? r() < 0.001 : r() < 0.06) pen = !pen;
        if (pen) g.lineTo(xx, y); else g.moveTo(xx, y);
      }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ sombreamento de fio

/** Brilho de fio (Kajiya-Kay, dois lóbulos) somado à luz direta, sobre a tangente do fio (tbn[0]). */
const KAJIYA_KAY = /* glsl */ `
#include <lights_fragment_end>
#if defined( USE_TANGENT )
{
  vec3 hT = normalize( tbn[ 0 ] );
  float band = 0.0;
  #ifdef USE_MAP
  band = floor( vMapUv.x * 8.0 );
  #endif
  float jit = fract( sin( band * 12.9898 + 4.1414 ) * 43758.5453 ) - 0.5;      // variação do brilho por mecha
  vec3 T1 = normalize( hT + normal * ( hairShift1 + 0.025 * jit ) );
  vec3 T2 = normalize( hT + normal * ( hairShift2 + 0.025 * jit ) );
  // a fita é plana: o lóbulo GGX dela e o reflexo do ambiente em ângulo rasante deixam o fio prateado; o brilho de fio
  // (Kajiya-Kay) substitui o especular direto e o do ambiente fica só um resto
  reflectedLight.directSpecular = vec3( 0.0 );
  reflectedLight.indirectSpecular *= hairEnvSpec;
  // Filtra lóbulos estreitos quando a direção muda mais que um pixel, evitando pontos cintilantes em movimento.
  float specAA = 1.0 + 12.0 * length( fwidth( hT ) );
  vec3 primaryTint = mix( diffuseColor.rgb, vec3( 1.0 ), 0.12 );
  #if NUM_DIR_LIGHTS > 0
  vec3 hairL, hairH;
  float d1, d2, s1, s2, facing, hairShadow;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  DirectionalLightShadow hShadowInfo;
  #endif
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    hairL = directionalLights[ i ].direction;
    hairH = normalize( hairL + geometryViewDir );
    d1 = dot( T1, hairH ); d2 = dot( T2, hairH );
    s1 = pow( sqrt( max( 0.0, 1.0 - d1 * d1 ) ), hairExp1 / specAA );
    s2 = pow( sqrt( max( 0.0, 1.0 - d2 * d2 ) ), hairExp2 / specAA );
    facing = smoothstep( -0.15, 0.35, dot( normal, hairL ) );
    hairShadow = 1.0;
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
    hShadowInfo = directionalLightShadows[ i ];
    hairShadow = receiveShadow ? getShadow( directionalShadowMap[ i ], hShadowInfo.shadowMapSize,
      hShadowInfo.shadowIntensity, hShadowInfo.shadowBias, hShadowInfo.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
    #endif
    reflectedLight.directSpecular += directionalLights[ i ].color * hairShadow * facing / sqrt( specAA ) *
      ( hairSpec1 * s1 * primaryTint + hairSpec2 * s2 * diffuseColor.rgb );
  }
  #pragma unroll_loop_end
  #endif
}
#endif
`;

/**
 * Material dos fios: cor do cabelo, fibras em alfa, raiz escura e oclusão (cor de vértice), brilho de fio Kajiya-Kay.
 * A anisotropia baixa só liga a tangente por vértice (USE_TANGENT); o brilho principal é o do fio.
 */
export function strandMaterial(color: string, lod: HairLod = 1): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color, map: fiberTexture(), vertexColors: true, side: THREE.DoubleSide,
    alphaTest: 0.12, alphaToCoverage: true, dithering: true,    // recorte de fibras/pontas, sem transparência no miolo
    roughness: 0.72, metalness: 0, anisotropy: 0.05,
    // A geometria já tem folga. Viés dependente da inclinação trazia fios de trás para a frente da bochecha.
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -1,
  });
  // cabelo escuro (níveis 1–3): o brilho de fio é o que revela a forma — sem reforço, vira uma massa preta na cena
  const cc = new THREE.Color(color); const darkHair = 0.2126 * cc.r + 0.7152 * cc.g + 0.0722 * cc.b < 0.025;
  const uniforms = {
    hairShift1: { value: -0.12 }, hairShift2: { value: 0.2 },                // primário para a raiz, secundário para a ponta
    hairExp1: { value: lod === 2 ? 48 : 64 }, hairExp2: { value: 18 },
    hairSpec1: { value: 0.18 }, hairSpec2: { value: darkHair ? 0.34 : 0.22 }, hairEnvSpec: { value: darkHair ? 0.3 : 0.18 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = "uniform float hairShift1, hairShift2, hairExp1, hairExp2, hairSpec1, hairSpec2, hairEnvSpec;\n" +
      shader.fragmentShader.replace("#include <lights_fragment_end>", KAJIYA_KAY);
  };
  m.customProgramCacheKey = () => "fai-hair-kk-coverage-v4";
  const hairCoverageAA = installHairCoverage(m);
  m.userData.hairShading = "kajiya-kay"; m.userData.hairUniforms = { ...uniforms, hairCoverageAA };     // ajuste fino ao vivo (laboratório)
  m.name = "cabelo-fios";
  return m;
}
