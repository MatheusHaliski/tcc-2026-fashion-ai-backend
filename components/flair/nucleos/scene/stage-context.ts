/**
 * Contexto da cena: o diretor das sequências, o jogo e o "reduzir movimento". Cada ator (avatar, figurante, móvel
 * animado, luz) pergunta ao contexto, a cada quadro, a amostra somada (sequências + ambiente) e o lugar dele.
 */
import { createContext, useContext } from "react";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { amostraDeAmbiente } from "@/lib/flair/nucleos/scene/ambient";
import type { Amostra } from "@/lib/flair/nucleos/scene/clips";
import { Diretor, type Lugar } from "@/lib/flair/nucleos/scene/director";

export interface Cena {
  codigo: NucleoCodigo;
  diretor: Diretor;
  reduzido: boolean;
}

export const CenaContexto = createContext<Cena | null>(null);

/** Relógio da cena, em segundos (o mesmo para quem toca e para quem amostra). */
export const agora = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

export function useCena(): Cena {
  const cena = useContext(CenaContexto);
  if (!cena) throw new Error("cena sem contexto");
  return cena;
}

export interface EstadoDoAtor {
  amostra: Amostra;
  lugar: Lugar;
}

/** Amostra e lugar do ator neste instante. */
export function estadoDoAtor(cena: Cena, ator: string, origem: Lugar, t = agora()): EstadoDoAtor {
  const amostra = cena.diretor.amostra(ator, t);
  const ambiente = amostraDeAmbiente(cena.codigo, ator, t, cena.reduzido);
  for (const k of Object.keys(ambiente)) amostra[k] = (amostra[k] ?? 0) + ambiente[k];
  return { amostra, lugar: cena.diretor.lugar(ator, t, origem) };
}

const RAD = Math.PI / 180;

/** Aplica os canais de um alvo ("raiz", "movel", "bracoE") da amostra num objeto 3D, sobre a posição de repouso. */
export function aplicarNoObjeto(o: { position: { set(x: number, y: number, z: number): unknown }; rotation: { set(x: number, y: number, z: number): unknown } }, amostra: Amostra, alvo: string, repouso: [number, number, number] = [0, 0, 0]): void {
  const v = (canal: string) => amostra[`${alvo}.${canal}`] ?? 0;
  o.position.set(repouso[0] + v("px"), repouso[1] + v("py"), repouso[2] + v("pz"));
  o.rotation.set(v("rx") * RAD, v("ry") * RAD, v("rz") * RAD);
}
