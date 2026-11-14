"use client";
/**
 * Câmera da abertura do salão (lib/flair/nucleos/scene/opening.ts): a cada troca de `chave` (o salão da vez) faz o
 * travelling e termina no enquadramento normal do avatar, que o Rig já calculou. Fica depois do Rig na cena, para
 * valer sobre ele só enquanto a abertura dura. Com "reduzir movimento" não faz nada.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ABERTURA_S, cameraDaAbertura, type Tomada } from "@/lib/flair/nucleos/scene/opening";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import { agora } from "@/components/flair/nucleos/scene/stage-context";

interface Props {
  chave: string | null | undefined;
  sala: Sala;
  /** enquadramento normal do avatar (onde a abertura termina) */
  fim: Tomada;
  reduzido: boolean;
}

export function CameraDeAbertura({ chave, sala, fim, reduzido }: Props) {
  const { camera } = useThree();
  const inicio = useRef<number | null>(null);
  const ate = useRef(fim);
  ate.current = fim;

  useEffect(() => {
    inicio.current = chave && !reduzido ? agora() : null;
  }, [chave, reduzido]);

  useFrame(() => {
    if (inicio.current == null) return;
    const t = agora() - inicio.current;
    const tomada = cameraDaAbertura(t, ate.current, sala);
    camera.position.set(...tomada.pos);
    camera.lookAt(...tomada.alvo);
    if (t >= ABERTURA_S) inicio.current = null;
  });
  return null;
}
