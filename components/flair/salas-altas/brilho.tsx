"use client";
/**
 * Pós-processamento leve das salas high poly no nível alto: brilho (bloom) só no que passa do branco da cena — lentes
 * dos refletores, LED do telão e da passarela, lâmpadas —, como o pós do MET Gala Heist. Um useFrame com prioridade
 * tira do R3F o desenho automático; quando o componente sai, o R3F volta a desenhar sozinho. Sem animação: não muda com
 * "reduzir movimento".
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export function BrilhoDaSala({ forca = 0.5, raio = 0.4, limiar = 1.0 }: { forca?: number; raio?: number; limiar?: number }) {
  const { gl, scene, camera, size } = useThree();
  const dpr = useThree((s) => s.viewport.dpr);
  const fx = useMemo(() => {
    const alvo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, alvo);
    const cena = new RenderPass(scene, camera);
    composer.addPass(cena);
    const brilho = new UnrealBloomPass(new THREE.Vector2(256, 256), forca, raio, limiar);
    composer.addPass(brilho);
    composer.addPass(new OutputPass());
    return { composer, cena, brilho };
  }, [gl, scene, camera, forca, raio, limiar]);
  useEffect(() => {
    fx.composer.setPixelRatio(dpr);
    fx.composer.setSize(size.width, size.height);
    fx.brilho.resolution.set(size.width * dpr * 0.5, size.height * dpr * 0.5);
  }, [fx, size, dpr]);
  useEffect(() => () => fx.composer.dispose(), [fx]);
  useFrame((state, dt) => {
    // a câmera em uso pode mudar (câmera de cinema, abertura): o passe desenha sempre com a de agora
    fx.cena.camera = state.camera;
    fx.composer.render(dt);
  }, 1);
  return null;
}
