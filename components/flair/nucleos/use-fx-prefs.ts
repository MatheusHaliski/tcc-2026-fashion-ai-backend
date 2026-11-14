"use client";
/**
 * Preferências dos efeitos da partida (som e efeitos de luz), guardadas no aparelho. Os dois podem ser desligados; o
 * som vem desligado por padrão (ETI-06).
 */
import { useCallback, useEffect, useState } from "react";
import { FX_PREFS_PADRAO, lerFxPrefs, salvarFxPrefs, type FxPrefs } from "@/lib/flair/nucleos/fx-sound";

export function useFxPrefs() {
  const [prefs, setPrefs] = useState<FxPrefs>(FX_PREFS_PADRAO);
  useEffect(() => {
    setPrefs(lerFxPrefs());
  }, []);
  const alternar = useCallback((campo: keyof FxPrefs) => {
    setPrefs((atual) => {
      const novo = { ...atual, [campo]: !atual[campo] };
      salvarFxPrefs(novo);
      return novo;
    });
  }, []);
  return { prefs, alternar };
}
