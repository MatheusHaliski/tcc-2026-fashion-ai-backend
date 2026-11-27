"use client";
/**
 * ACERVO — marcador numerado na cena 3D: o mesmo círculo verde com número que aparece no cartão da peça marcada,
 * desenhado numa textura e sempre de frente para a câmera.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { COR_LIMA } from "@/lib/acervo/cena/materiais";
import type { V3 } from "@/lib/acervo/cena/modelo";

const LADO = 96;

function desenhar(numero: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.beginPath();
  g.arc(LADO / 2, LADO / 2, LADO / 2 - 5, 0, Math.PI * 2);
  g.fillStyle = COR_LIMA;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = "#1D2100";
  g.stroke();
  g.fillStyle = "#1D2100";
  g.font = "700 52px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(numero), LADO / 2, LADO / 2 + 3);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export function Marcador3D({ numero, pos }: { numero: number; pos: V3 }) {
  const textura = useMemo(() => desenhar(numero), [numero]);
  useEffect(() => () => textura?.dispose(), [textura]);
  if (!textura) return null;
  return (
    <sprite name={`marcador-${numero}`} position={pos} scale={[0.13, 0.13, 1]} renderOrder={5}>
      <spriteMaterial map={textura} depthTest={false} toneMapped={false} />
    </sprite>
  );
}
