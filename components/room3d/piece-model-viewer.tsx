"use client";
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useI18n } from "@/lib/i18n/i18n";

/** RF16.CA02 — modelo 3D da peça com rotação e zoom; a versão 2D continua disponível na página. */
export default function PieceModelViewer({ url, name }: { url: string; name: string }) {
  const { t } = useI18n();
  const [scene, setScene] = useState<THREE.Group | null>(null); const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true; setScene(null); setError(false);
    new GLTFLoader().load(url, (g) => {
      if (!alive) return; const box = new THREE.Box3().setFromObject(g.scene); const size = box.getSize(new THREE.Vector3());
      g.scene.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z, 0.001)); g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; }); setScene(g.scene);
    }, undefined, () => alive && setError(true));
    return () => { alive = false; };
  }, [url]);
  if (error) return <div className="grid h-full place-items-center p-4 text-center type-body text-muted">{t("room3d.pieceModelViewer.nao_foi_possivel_carregar_o")}</div>;
  return (
    <Canvas shadows camera={{ position: [0, 0.6, 3], fov: 40 }} aria-label={t("room3d.pieceModelViewer.modelo_3d_de", { name })}>
      <color attach="background" args={["#f1eee8"]} />
      <hemisphereLight args={["#ffffff", "#d9cbb5", 1]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow />
      {scene && <Center><primitive object={scene} /></Center>}
      <ContactShadows position={[0, -0.85, 0]} opacity={0.35} scale={4} blur={2.2} />
      <OrbitControls enablePan={false} minDistance={1.4} maxDistance={5} autoRotate autoRotateSpeed={0.8} />
    </Canvas>
  );
}
