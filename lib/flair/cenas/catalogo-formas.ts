/** Todas as formas do elenco das cenas, por nome. */
import type { Forma } from "@/lib/flair/cenas/formas";
import { COSMETICOS } from "@/lib/flair/cenas/formas-cosmeticos";

export const FORMAS: Record<string, Forma> = { ...COSMETICOS };
