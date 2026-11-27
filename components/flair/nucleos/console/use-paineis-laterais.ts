"use client";
/**
 * Os dois painéis laterais do palco de jogo (esquerda e direita), fechados por padrão, cada um com a aba escolhida.
 * Esc fecha o que estiver aberto (o da direita primeiro); `fecharUm` diz se fechou algo, para o Esc não ir adiante.
 */
import { useCallback, useState } from "react";

export type Lado = "esquerda" | "direita";

export interface PaineisLaterais {
  aberto: Record<Lado, boolean>;
  aba: Record<Lado, string>;
  alternar: (lado: Lado) => void;
  abrir: (lado: Lado, aba?: string) => void;
  escolherAba: (lado: Lado, aba: string) => void;
  fecharUm: () => boolean;
}

export function usePaineisLaterais(abas: Record<Lado, string>): PaineisLaterais {
  const [aberto, setAberto] = useState<Record<Lado, boolean>>({ esquerda: false, direita: false });
  const [aba, setAba] = useState(abas);
  const alternar = useCallback((lado: Lado) => setAberto((a) => ({ ...a, [lado]: !a[lado] })), []);
  const abrir = useCallback((lado: Lado, nova?: string) => {
    setAberto((a) => ({ ...a, [lado]: true }));
    if (nova) setAba((a) => ({ ...a, [lado]: nova }));
  }, []);
  const escolherAba = useCallback((lado: Lado, nova: string) => setAba((a) => ({ ...a, [lado]: nova })), []);
  const fecharUm = () => {
    const lado: Lado | null = aberto.direita ? "direita" : aberto.esquerda ? "esquerda" : null;
    if (!lado) return false;
    setAberto((a) => ({ ...a, [lado]: false }));
    return true;
  };
  return { aberto, aba, alternar, abrir, escolherAba, fecharUm };
}
