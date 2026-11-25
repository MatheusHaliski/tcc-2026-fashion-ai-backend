"use client";
/**
 * O look da pessoa pela regra peça-recurso (lib/flair/recursos): os atributos de agora e, por pouco mais de um segundo
 * depois de vestir ou trocar uma peça, o que mudou — os dois atributos que mais mudaram, as ações que a peça destravou
 * e o atributo que subiu (a cor do brilho no avatar). Os perfis vêm do servidor; a tela não muda a nota.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { acoesNovas, atributoEmAlta, lookNaTela, mudancas, type LookNaTela, type MudancaDeAtributo } from "@/lib/flair/recursos/perfil";
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

export function useLookDosRecursos(vestidas: Record<string, string>, perfil: (cardId: string) => PerfilDaPeca | undefined, ativo: boolean): LookDosRecursos {
  const look = useMemo(() => lookNaTela(vestidas, perfil), [vestidas, perfil]);
  const antes = useRef({ look, vestidas });
  const contador = useRef(0);
  const [ultima, setUltima] = useState<MudancaNaTela | null>(null);
  useEffect(() => {
    const anterior = antes.current;
    antes.current = { look, vestidas };
    // só a troca de peça anima; a chegada dos perfis do servidor (mesmo look) só atualiza a roda
    if (!ativo || anterior.vestidas === vestidas) return;
    const m = mudancas(anterior.look, look);
    const acoes = acoesNovas(anterior.look, look);
    if (m.length === 0 && acoes.length === 0) return;
    contador.current += 1;
    setUltima({ mudancas: m, acoes, emAlta: atributoEmAlta(m), chave: contador.current });
  }, [look, ativo, vestidas]);
  useEffect(() => {
    if (!ultima) return;
    const t = window.setTimeout(() => setUltima(null), MUDANCA_MS);
    return () => window.clearTimeout(t);
  }, [ultima]);
  return { look, ultima };
}
