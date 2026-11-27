/**
 * FASHION_DETECTIVE: o salão da vez no caso de 6 salões (docs/flair/flair-3d/CORES_E_ACOES.md). O servidor diz o próximo
 * salão no evento PROXIMO_SALAO da última entrega; antes da primeira entrega, a pessoa está no salão 1.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export const SALOES_DO_CASO = ["ENTRADA_DA_GALA", "SALAO_PRINCIPAL", "CAMARIM", "CLUBE_UNDERGROUND", "ATELIE", "ARQUIVO"] as const;

export interface SalaoDaVez {
  numero: number;
  codigo: string;
  total: number;
}

export function salaoDaVez(ultima: NucleoResultado | null | undefined): SalaoDaVez {
  const proximo = valorDoEvento(ultima, "PROXIMO_SALAO");
  const total = SALOES_DO_CASO.length;
  if (proximo && typeof proximo === "object") {
    const { salao, codigo } = proximo as { salao?: unknown; codigo?: unknown };
    if (typeof salao === "number" && typeof codigo === "string") return { numero: salao, codigo, total };
  }
  return { numero: 1, codigo: SALOES_DO_CASO[0], total };
}
