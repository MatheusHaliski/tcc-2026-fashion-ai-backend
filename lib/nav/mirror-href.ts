/*
 * O Espelho (RF28) tem casa própria: /mirror. O Meu Quarto deixou de ser uma tela (o quarto continua como dados e como
 * cenário dos jogos da Suíte de Vidro), e os links do app — detalhe da peça, insights, lookbook — apontam direto ao espelho.
 *
 *   /mirror                       o espelho com o look de agora
 *   /mirror?vestir=<id>           veste a peça ao abrir (parâmetro de uma vez só: sai da URL depois)
 *   /mirror?vestir=<id>&vista=2d  idem, com a prévia 2D (o palco do espelho já é a foto parada do avatar)
 *
 * `/room` e `/room?espelho=1…` (links antigos) são redirecionados em app/(site)/(app)/room/page.tsx.
 */
export const MIRROR_ROOM_PATH = "/mirror";

export function mirrorHref({ piece, vista }: { piece?: string | null; vista?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (piece) q.set("vestir", piece);
  if (vista === "2d") q.set("vista", "2d");
  const s = q.toString();
  return s ? `${MIRROR_ROOM_PATH}?${s}` : MIRROR_ROOM_PATH;
}
