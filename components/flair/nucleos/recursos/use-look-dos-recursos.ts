"use client";
/**
 * O look da pessoa pela regra peça-recurso (lib/flair/recursos): os atributos de agora e, por pouco mais de um segundo
 * depois de vestir ou trocar uma peça, o que mudou — os dois atributos que mais mudaram, as ações que a peça destravou
 * e o atributo que subiu (a cor do brilho no avatar). Os perfis vêm do servidor; a tela não muda a nota.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { acoesNovas, atributoEmAlta, lookDaPrevia, lookNaTela, mudancas, type LookNaTela, type MudancaDeAtributo } from "@/lib/flair/recursos/perfil";
import type { AcaoDestravada, Atributo, PerfilDaPeca } from "@/lib/flair/recursos/types";

/** Quanto tempo o texto "+20 Agilidade" e o brilho ficam na tela. */
export const MUDANCA_MS = 1400;

export interface MudancaNaTela {
  mudancas: MudancaDeAtributo[];
  acoes: AcaoDestravada[];
  emAlta: Atributo | null;
  /** muda a cada troca: reinicia a animação */
  chave: number;
}

export interface LookDosRecursos {
  look: LookNaTela;
  ultima: MudancaNaTela | null;
}

/** `previa`: nos jogos de zonas (sem cartas), o perfil das zonas pintadas vem na prévia do servidor. */
export function useLookDosRecursos(vestidas: Record<string, string>, perfil: (cardId: string) => PerfilDaPeca | undefined, ativo: boolean,
  previa?: { eventos: { codigo: string; valor?: unknown }[] } | null): LookDosRecursos {
  const dasCartas = useMemo(() => lookNaTela(vestidas, perfil), [vestidas, perfil]);
  const daPrevia = useMemo(() => lookDaPrevia(previa?.eventos), [previa]);
  const look = dasCartas.pecas > 0 || !daPrevia ? dasCartas : daPrevia;
  const antes = useRef({ look, vestidas });
  const contador = useRef(0);
  const [ultima, setUltima] = useState<MudancaNaTela | null>(null);
  useEffect(() => {
    const anterior = antes.current;
    antes.current = { look, vestidas };
    // só a troca de peça (ou a zona pintada, que muda a prévia) anima; a chegada dos perfis das cartas só atualiza a roda
    const trocou = anterior.vestidas !== vestidas || (look === daPrevia && anterior.look !== look);
    if (!ativo || !trocou) return;
    const m = mudancas(anterior.look, look);
    const acoes = acoesNovas(anterior.look, look);
    if (m.length === 0 && acoes.length === 0) return;
    contador.current += 1;
    setUltima({ mudancas: m, acoes, emAlta: atributoEmAlta(m), chave: contador.current });
  }, [look, ativo, vestidas, daPrevia]);
  useEffect(() => {
    if (!ultima) return;
    const t = window.setTimeout(() => setUltima(null), MUDANCA_MS);
    return () => window.clearTimeout(t);
  }, [ultima]);
  return { look, ultima };
}
