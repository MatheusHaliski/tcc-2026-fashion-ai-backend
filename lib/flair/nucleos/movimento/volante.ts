/**
 * O volante do Meu Piloto Favorito no perfil console: as setas não apontam a direção, dirigem — ↑ acelera e ↓ dá ré
 * na direção do carro, ← e → viram o volante (mais rápido andando, devagar parado). O resultado é o eixo de andar de
 * sempre (lib/flair/entrada/eixo-de-andar.ts), na direção em que a personagem está virada. Puro.
 */
import type { Vetor } from "@/lib/flair/entrada/acoes";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/** Os jogos em que as setas são volante. */
export const VOLANTE: ReadonlySet<NucleoCodigo> = new Set<NucleoCodigo>(["PILOTO_FAVORITO"]);

/** Quanto o volante vira por segundo (radianos), andando e parado. */
export const GIRO_ANDANDO = 2.4;
export const GIRO_PARADO = 0.9;

/** Gira o carro pelo ← → do tempo `dt` (s) e devolve o eixo de andar na direção dele. 0 rad = para a frente da tela. */
export function eixoDoVolante(carro: { giro: number }, setas: Vetor, dt: number): Vetor {
  const passo = Math.min(0.1, Math.max(0, dt));
  const andando = Math.abs(setas.y) > 0.05;
  // na ré o volante inverte, como num carro
  const sentido = setas.y < 0 ? -1 : 1;
  carro.giro += setas.x * (andando ? GIRO_ANDANDO : GIRO_PARADO) * passo * sentido;
  return { x: Math.sin(carro.giro) * setas.y, y: Math.cos(carro.giro) * setas.y };
}
