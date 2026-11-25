"use client";
/**
 * Leva a personagem pela sala a cada quadro (lib/flair/nucleos/movimento/andar.ts): lê o eixo de andar da tela, anda
 * na velocidade da agilidade do look e escreve a posição em `jogador`, que o avatar e a câmera do jogo somam ao lugar
 * que o diretor de cena dá. Quando o andar livre acaba, a personagem caminha de volta à marca dela (as sequências
 * partem dali); a troca de momento ainda a recoloca de uma vez (nucleo-scene-3d).
 */
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { eixoDeAndar } from "@/lib/flair/entrada/eixo-de-andar";
import { obstaculosDaSala } from "@/lib/flair/nucleos/camera/enquadramento";
import { areaDeAndar, passo, velocidadeDaAgilidade, voltarAMarca, type Posicao } from "@/lib/flair/nucleos/movimento/andar";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

export interface Jogador {
  pos: Posicao;
  andando: boolean;
}

export const NA_MARCA: Posicao = { x: 0, z: 0, giro: 0 };

export function Andarilho({ sala, jogador, agilidade, livre }: { sala: Sala; jogador: React.MutableRefObject<Jogador>; agilidade?: number; livre: boolean }) {
  const area = useMemo(() => areaDeAndar(sala, obstaculosDaSala(sala, 0)), [sala]);
  useFrame((_, dt) => {
    const j = jogador.current;
    const { mover, ativo } = eixoDeAndar();
    if (!livre || !ativo) {
      if (j.pos === NA_MARCA) return;
      const volta = voltarAMarca(j.pos, dt);
      const chegou = volta.x === 0 && volta.z === 0;
      jogador.current = chegou ? { pos: NA_MARCA, andando: false } : { pos: volta, andando: true };
      return;
    }
    const novo = passo(j.pos, mover, dt, velocidadeDaAgilidade(agilidade), area);
    jogador.current = { pos: novo, andando: novo.x !== j.pos.x || novo.z !== j.pos.z };
  });
  return null;
}
