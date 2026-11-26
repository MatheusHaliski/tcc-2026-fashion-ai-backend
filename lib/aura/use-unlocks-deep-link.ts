"use client";
import { useEffect, useRef, useState } from "react";
import { unlocksRequested } from "@/lib/aura/unlocks";

/**
 * Circuito Aura — link direto do aviso de marco ("/pieces/<id>?destrava=<id>"): quando o endereço pede o painel deste
 * card, abre a análise uma vez (depois de montar, para não divergir do HTML do servidor) e devolve se o painel deve
 * ficar em foco.
 */
export function useUnlocksDeepLink(id: string, open: () => void): boolean {
  const [requested, setRequested] = useState(false);
  const opener = useRef(open);
  opener.current = open;
  useEffect(() => {
    if (unlocksRequested(id)) {
      setRequested(true);
      opener.current();
    }
  }, [id]);
  return requested;
}
