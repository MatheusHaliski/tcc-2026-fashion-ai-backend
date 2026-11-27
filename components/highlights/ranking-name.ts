/** "PAIS:BR" → nome do ranking na tela ("Seu país · BR"); código sem nome conhecido aparece como veio. */
export function rankingName(segment: string, t: (key: string) => string): string {
  const [kind, detail] = segment.split(":", 2);
  const key = `highlights.rank.seg.${kind}`;
  const name = t(key);
  const label = name === key ? kind : name;
  return detail ? `${label} · ${detail}` : label;
}
