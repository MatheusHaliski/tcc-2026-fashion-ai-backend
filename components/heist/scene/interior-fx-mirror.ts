/*
 * MET Gala Heist v2 — reflexo planar dos pisos polidos do interior (interior-fx.ts): uma passada espelhada em y = 0,
 * só no "high".
 */
import * as THREE from "three";

/* ---------- reflexo planar dos pisos polidos ---------- */
/**
 * Uma câmera espelhada em y = 0 desenha a cena (sem os pisos) numa textura de meia resolução com mipmaps; os pisos
 * polidos leem essa textura na posição projetada, borrada pela rugosidade do mapa (juntas e veios foscos não refletem),
 * deslocada pelo relevo e pesada pelo Fresnel. Um plano de corte oblíquo tira o que está abaixo do piso (a rua, a −1,6 m).
 */
export class FloorMirror {
  readonly rt: THREE.WebGLRenderTarget;
  readonly floors: THREE.Mesh[] = [];
  private cam = new THREE.PerspectiveCamera();
  private uniforms = { tMirror: { value: null as THREE.Texture | null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } };
  private size = new THREE.Vector2();
  private hidden: THREE.Object3D[] = [];
  private frames = 0;
  constructor(private scale = 0.5) {
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.rt.texture.name = "floorMirror";
    this.uniforms.tMirror.value = this.rt.texture;
  }
  /** Pisos que refletem: `k` força do reflexo, `f0` refletância de frente (mármore polido ~0,06; madeira envernizada ~0,03). */
  patch(mesh: THREE.Mesh, k: number, f0: number) {
    const src = mesh.material as THREE.MeshStandardMaterial, m = src.clone(); m.name += "+mirror";
    m.userData = { ...src.userData, mirror: true, envBase: ((src.userData.envBase as number | undefined) ?? src.envMapIntensity) * 0.55 };
    const u = this.uniforms;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tMirror = u.tMirror; sh.uniforms.uMirrorMat = u.uMirrorMat; sh.uniforms.uMirrorOn = u.uMirrorOn;
      sh.uniforms.uMirrorK = { value: k }; sh.uniforms.uMirrorF0 = { value: f0 };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMirrorW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvMirrorW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn, uMirrorK, uMirrorF0; varying vec3 vMirrorW;")
        .replace("#include <opaque_fragment>", /* glsl */ `
if (uMirrorOn > 0.5) {
  vec4 rc = uMirrorMat * vec4(vMirrorW, 1.0);
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  vec2 ruv = rc.xy / max(rc.w, 1e-4) + nW.xz * 0.04;
  float rough = clamp(roughnessFactor, 0.0, 1.0);
  vec3 refl = textureLod(tMirror, ruv, rough * 7.0).rgb;
  float NoV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float F = uMirrorF0 + (1.0 - uMirrorF0) * pow(1.0 - NoV, 5.0);
  float gloss = 1.0 - smoothstep(0.08, 0.55, rough);
  outgoingLight += refl * uMirrorK * F * gloss;
}
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => "floorMirror";
    // o reflexo de verdade substitui parte do reflexo do ambiente (o PMREM não tem as pessoas nem os móveis)
    m.envMapIntensity *= 0.55;
    mesh.material = m; this.floors.push(mesh);
  }
  /** Desliga o reflexo até o próximo `update` (fotos das sondas: a textura do espelho é da câmera principal). */
  off() { this.uniforms.uMirrorOn.value = 0; }
  /** Antes do desenho principal: espelha a câmera, corta abaixo do piso e desenha a cena sem os pisos. */
  update(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, hide: readonly THREE.Object3D[]) {
    const u = this.uniforms;
    const cam = camera as THREE.PerspectiveCamera;
    camera.updateMatrixWorld();
    const cp = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const any = this.floors.some((f) => f.visible && f.parent?.visible !== false);
    if (!any || cp.y <= 0.05 || ++this.frames < 3) { u.uMirrorOn.value = 0; return; }
    u.uMirrorOn.value = 1;
    gl.getDrawingBufferSize(this.size);
    const w = Math.max(2, Math.round(this.size.x * this.scale)), h = Math.max(2, Math.round(this.size.y * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    // câmera virtual: posição, alvo e "para cima" refletidos no plano y = 0 (como o Reflector do three)
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
    const v = this.cam;
    v.position.set(cp.x, -cp.y, cp.z);
    v.up.set(0, 1, 0).applyMatrix4(rot); v.up.y = -v.up.y;
    v.lookAt(look.x, -look.y, look.z);
    v.near = cam.near ?? 0.05; v.far = cam.far ?? 500;
    v.updateMatrixWorld(); v.projectionMatrix.copy(camera.projectionMatrix); v.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    u.uMirrorMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
    // plano de corte oblíquo (Lengyel): o plano de perto passa a ser o próprio piso
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(v.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = v.projectionMatrix.elements, q = new THREE.Vector4((Math.sign(clip.x) + pm[8]) / pm[0], (Math.sign(clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
    // desenho (sem os pisos e o que não deve aparecer no espelho; sombras do quadro anterior)
    this.hidden.length = 0;
    for (const o of this.floors) if (o.visible) { o.visible = false; this.hidden.push(o); }
    for (const o of hide) if (o.visible) { o.visible = false; this.hidden.push(o); }
    const prevTarget = gl.getRenderTarget(), prevShadow = gl.shadowMap.autoUpdate, prevXr = gl.xr.enabled;
    gl.xr.enabled = false; gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(this.rt); gl.clear(); gl.render(scene, v);
    gl.setRenderTarget(prevTarget); gl.shadowMap.autoUpdate = prevShadow; gl.xr.enabled = prevXr;
    for (const o of this.hidden) o.visible = true;
  }
  dispose() { this.rt.dispose(); }
}
