import type { ModeLook, Theme } from "@/components/flair/modes-shared";
import type { HandCard } from "@/components/flair/arena/deck-hand";

/** Tipos do catálogo de modos (GET /api/flair/modes) e as props comuns dos painéis. */
export interface Mode { code: string; name: string; emoji: string; group: "NUCLEO" | "ESPECIAL"; summary: string; how: string; }
export interface Square { index: number; city: string; title: string; emoji: string; type: string; theme: string; target: number; reward: number; rule: string; }
export interface Territory { map: string; code: string; name: string; emoji: string; style: string; theme: string; bonus: string; }
export interface Boss { code: string; name: string; emoji: string; theme: string; stats: Record<string, number>; lesson: string; }
export interface Catalog { architecture: string[]; modes: Mode[]; themes: Theme[]; bosses: Boss[]; board: Square[]; territories: Territory[]; chessBoard: string[]; roles: string[]; ethics: string; divisions: { from: number; code: string; label: string }[]; }
export type PanelProps = { looks: ModeLook[]; catalog: Catalog; onDone: () => void };

/** Cartas de roupa dos looks escolhidos (na ordem da escolha), para a mão que vai à partida. */
export function handOf(looks: ModeLook[], ids: string[]): HandCard[] {
  return ids.flatMap((id) => looks.find((l) => l.schemeId === id)?.cards ?? []).map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, category: c.category, rarity: c.rarity, power: c.power }));
}
export const lookOf = (looks: ModeLook[], id?: string | null): ModeLook | null => looks.find((l) => l.schemeId === id) ?? null;
/** Tema do catálogo pelo código (para a leitura tática). */
export const themeOf = (catalog: Catalog, code?: string | null): Theme | null => catalog.themes.find((t) => t.code === code) ?? null;
