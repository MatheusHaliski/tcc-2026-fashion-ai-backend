/*
 * O Espelho é uma navegação derivada do Meu Quarto (RF27 ↔ RF28): não há mais tela própria — o link leva ao quarto, que
 * vai até o espelho e abre a prova ali mesmo. `/mirror` continua existindo só para redirecionar links antigos.
 *
 *   /room?espelho=1                 quarto com a prova do espelho aberta
 *   /room?espelho=1&vestir=<id>     leva a peça ao espelho (lista do espelho) e veste
 *   /room?espelho=1&vista=2d        abre com a prévia 2D (foto parada do mesmo avatar) no painel
 *
 * `?piece=` no quarto continua significando "Mostrar no quarto" (RF32.CA09) e por isso não é reaproveitado.
 */
export const MIRROR_ROOM_PATH = "/room?espelho=1";

export function mirrorHref({ piece, vista }: { piece?: string | null; vista?: string | null } = {}): string {
  const q = new URLSearchParams({ espelho: "1" });
  if (piece) q.set("vestir", piece);
  if (vista === "2d") q.set("vista", "2d");
  return `/room?${q.toString()}`;
}
