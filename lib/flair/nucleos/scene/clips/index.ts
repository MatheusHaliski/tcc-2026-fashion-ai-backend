/** Todos os clipes, por id (os comuns e os de cada jogo). */
import type { Clip } from "@/lib/flair/nucleos/scene/clips";
import { CLIPS_ATELIE } from "@/lib/flair/nucleos/scene/clips/atelie";
import { CLIPS_COMUNS } from "@/lib/flair/nucleos/scene/clips/comuns";
import { CLIPS_ESPORTE } from "@/lib/flair/nucleos/scene/clips/esporte";
import { CLIPS_HISTORIA } from "@/lib/flair/nucleos/scene/clips/historia";
import { CLIPS_LUTA } from "@/lib/flair/nucleos/scene/clips/luta";
import { CLIPS_PALCO } from "@/lib/flair/nucleos/scene/clips/palco";
import { CLIPS_SET } from "@/lib/flair/nucleos/scene/clips/set";

const todos: Clip[] = [...CLIPS_COMUNS, ...CLIPS_PALCO, ...CLIPS_LUTA, ...CLIPS_SET, ...CLIPS_HISTORIA, ...CLIPS_ATELIE, ...CLIPS_ESPORTE];

export const CLIPS: Record<string, Clip> = Object.fromEntries(todos.map((c) => [c.id, c]));

export function clipDe(id: string): Clip {
  const c = CLIPS[id];
  if (!c) throw new Error(`clipe desconhecido: ${id}`);
  return c;
}
