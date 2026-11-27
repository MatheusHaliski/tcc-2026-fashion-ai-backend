"use client";
/**
 * O aviso curto do palco de jogo (toast): uma frase de até seis palavras que some sozinha. Um por vez; um aviso novo
 * substitui o que estava. O texto inteiro do evento fica no painel, não na cena.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const DURACAO_DO_AVISO = 3200;

export interface AvisoCurto {
  id: number;
  texto: string;
  tom: "info" | "alerta";
}

export function useAvisoCurto(): [AvisoCurto | null, (texto: string, tom?: AvisoCurto["tom"]) => void] {
  const [aviso, setAviso] = useState<AvisoCurto | null>(null);
  const conta = useRef(0);
  const mostrar = useCallback((texto: string, tom: AvisoCurto["tom"] = "info") => {
    conta.current += 1;
    setAviso({ id: conta.current, texto, tom });
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso((a) => (a?.id === aviso.id ? null : a)), DURACAO_DO_AVISO);
    return () => clearTimeout(t);
  }, [aviso]);
  return [aviso, mostrar];
}
