"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GarmentStudio } from "./use-garment-studio";

/**
 * Luz de prévia do tecido (ambiente refletido gerado localmente, sem baixar HDR) e captura de miniatura.
 * Fica só no viewport: nada disso entra no GLB exportado.
 */
export function GarmentEnvironment({ studio }: { studio: GarmentStudio }) {
  const { gl, scene, camera } = useThree();
  const light = studio.light;
  useEffect(() => {
    if (light === "neutral") return;
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = light === "warm" ? 0.3 : 0.45;
    scene.environmentRotation.set(0, light === "warm" ? Math.PI * 0.75 : 0, 0);
    return () => {
      scene.environment = null;
      target.dispose();
      generator.dispose();
      room.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
    };
  }, [gl, scene, light]);
  const { captureRef } = studio;
  useEffect(() => {
    captureRef.current = () => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, captureRef]);
  return light === "warm" ? <directionalLight position={[-3, 2, 4]} intensity={0.9} color="#ffd2a1" /> : null;
}
