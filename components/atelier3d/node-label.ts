/** Partes da peça base (nomes gravados no arquivo 3D em inglês) → chave do texto mostrado na lista de objetos. */
const PARTS: Record<string, string> = {
  fai_tee_prototype: "atelier3d.part.tee",
  fai_skirt_prototype: "atelier3d.part.skirt",
  fai_pants_prototype: "atelier3d.part.pants",
  fai_trousers_prototype: "atelier3d.part.pants",
  body: "atelier3d.part.body",
  sleeve_left: "atelier3d.part.sleeveLeft",
  sleeve_right: "atelier3d.part.sleeveRight",
  neck_opening: "atelier3d.part.neck",
  skirt: "atelier3d.part.skirtBody",
  waistband: "atelier3d.part.waistband",
  waist: "atelier3d.part.waist",
  leg_left: "atelier3d.part.legLeft",
  leg_right: "atelier3d.part.legRight",
};

/** Nome do objeto na língua de quem edita; objeto de arquivo importado mantém o nome que veio no arquivo. */
export function nodeLabel(name: string | undefined, fallback: string, t: (key: string) => string): string {
  if (!name) return fallback;
  const key = PARTS[name.trim().toLowerCase().replace(/[\s-]+/g, "_")];
  return key ? t(key) : name;
}

/**
 * Parte da peça do motor (material nomeado pelo papel) → texto na língua de quem edita. Papéis repetidos levam o
 * número a partir de 1 ("Estampa 1"); material sem papel conhecido mantém o nome que veio no arquivo.
 */
export function partLabel(
  part: { role: string | null; index: number | null; materialName: string; key: string },
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!part.role) return part.materialName || part.key;
  return t(`atelier3d.role.${part.role}`, { n: (part.index ?? 0) + 1 });
}
