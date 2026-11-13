"use client";
/**
 * Placar do painel de LED: os números do resultado (nota, gols, pontos dos dois looks) desenhados num canvas e
 * postos na frente do painel. Só números e o sinal "×": nenhum texto de interface vai para a textura.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

const LARGURA = 512;
const ALTURA = 192;

function desenhar(texto: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.clearRect(0, 0, LARGURA, ALTURA);
  g.font = "bold 150px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#FFFFFF";
  g.shadowBlur = 18;
  g.fillStyle = "#FFFFFF";
  g.fillText(texto, LARGURA / 2, ALTURA / 2 + 8);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Placar({ em, texto }: { em: NonNullable<Sala["placar"]>; texto: string | null }) {
  const textura = useMemo(() => (texto ? desenhar(texto) : null), [texto]);
  useEffect(() => () => textura?.dispose(), [textura]);
  if (!texto || !textura) return null;
  return (
    <mesh name="placar" position={em.pos} rotation={[0, ((em.giro ?? 0) * Math.PI) / 180, 0]}>
      <planeGeometry args={em.tam} />
      <meshBasicMaterial map={textura} transparent toneMapped={false} />
    </mesh>
  );
}
