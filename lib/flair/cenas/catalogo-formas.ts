/** Todas as formas do elenco das cenas, por nome. */
import type { Forma } from "@/lib/flair/cenas/formas";
import { ANIMAIS } from "@/lib/flair/cenas/formas-animais";
import { ATELIE } from "@/lib/flair/cenas/formas-atelie";
import { COSMETICOS } from "@/lib/flair/cenas/formas-cosmeticos";

export const FORMAS: Record<string, Forma> = { ...COSMETICOS, ...ANIMAIS, ...ATELIE };
