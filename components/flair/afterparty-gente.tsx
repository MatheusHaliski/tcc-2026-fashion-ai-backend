"use client";
/**
 * Os seguranças da portaria e os convidados do MET Gala Heist como gente (components/flair/nucleos/gente, o mesmo corpo
 * humano do avatar): os dois seguranças e os convidados mais perto da câmera de corpo inteiro; os outros, no corpo humano
 * leve. Cada convidado faz uma coisa (conversa, bebe, fotografa, dança); o segurança distraído olha em volta.
 */
import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { pessoaDoPapel } from "@/lib/flair/detetive/elenco";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

/** Quem vem à festa (roupas de gala do elenco do Fashion Detective) e o que cada um faz parado. */
const CONVIDADOS = ["DALIA", "BENTO", "NINA", "TEO", "IOLANDA", "OTTO", "CLEO", "RAFA", "LIA"] as const;
const O_QUE_FAZEM: AtorDeCena["anim"][] = ["talk", "drink", "talk", "photo", "dance", "idle"];
/** Corpos inteiros ao mesmo tempo: os dois seguranças e os dois convidados mais perto. */
const CORPOS_INTEIROS = 4;
const SEMENTE = 2026;

interface Props {
  /** onde os seguranças ficam (x, z) e se cada um está distraído */
  segurancas: { x: number; z: number; distraido: boolean }[];
  /** os lugares dos convidados presentes (x, z) */
  convidados: [number, number][];
  reduzido: boolean;
  /** a primeira pessoa entrou em cena: quem chama tira as figuras simples */
  onPronta: () => void;
}

export function GenteDoSalao({ segurancas, convidados, reduzido, onPronta }: Props) {
  const prontos = useRef(new Set<string>());
  const avisou = useRef(false);
  const pessoas = useMemo(() => {
    const m = new Map<string, PessoaDoElenco>();
    segurancas.forEach((_, i) => m.set(`seguranca-${i}`, pessoaDoPapel(SEMENTE, `seguranca-${i}`, "SEGURANCA")));
    convidados.forEach((_, i) => m.set(`convidado-${i}`, pessoaDoPapel(SEMENTE, `convidado-${i}`, CONVIDADOS[i % CONVIDADOS.length])));
    return m;
  }, [segurancas.length, convidados.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const atores = useCallback((): AtorDeCena[] => [
    // o segurança olha para a entrada (+z); os convidados, para o meio do salão
    ...segurancas.map((s, i): AtorDeCena => ({ id: `seguranca-${i}`, x: s.x, z: s.z, giro: 0, anim: s.distraido ? "look" : "idle", velocidade: 0, naJogada: true })),
    ...convidados.map(([x, z], i): AtorDeCena => ({ id: `convidado-${i}`, x, z, giro: Math.atan2(-x, -z - 1), anim: reduzido ? "idle" : O_QUE_FAZEM[i % O_QUE_FAZEM.length], velocidade: 0 })),
  ], [segurancas, convidados, reduzido]);
  useFrame(() => {
    if (avisou.current || prontos.current.size === 0) return;
    avisou.current = true;
    onPronta();
  });
  return <Elenco3D pessoas={pessoas} atores={atores} prontos={prontos} reduzido={reduzido} limite={CORPOS_INTEIROS} />;
}
