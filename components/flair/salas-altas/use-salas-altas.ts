/**
 * O manifesto das salas high poly (buscado uma vez por sessão) e a qualidade escolhida pela pessoa. Enquanto o
 * manifesto não chega, ou se falha, a lista é vazia e as salas ficam procedurais.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { lerSalasAltas, SALAS_ALTAS_MANIFESTO, type SalaAlta } from "@/lib/flair/salas-altas/manifesto";
import { lerPreferencia, ouvirPreferencia, type PreferenciaDeQualidade } from "@/lib/flair/salas-altas/preferencia";

let pedido: Promise<SalaAlta[]> | null = null;
const VAZIO: SalaAlta[] = [];

function buscar(): Promise<SalaAlta[]> {
  pedido ??= fetch(SALAS_ALTAS_MANIFESTO)
    .then((r) => (r.ok ? r.json() : []))
    .then(lerSalasAltas)
    .catch(() => VAZIO);
  return pedido;
}

export function useSalasAltas(): SalaAlta[] {
  const [lista, setLista] = useState<SalaAlta[]>(VAZIO);
  useEffect(() => {
    let vivo = true;
    if (typeof fetch !== "function") return;
    void buscar().then((l) => {
      if (vivo && l.length > 0) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return lista;
}

export function usePreferenciaDeQualidade(): PreferenciaDeQualidade {
  return useSyncExternalStore(ouvirPreferencia, lerPreferencia, () => "AUTO" as const);
}
