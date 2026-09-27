/**
 * Ocasiões e estilos da peça (RF4): listas de códigos da taxonomia, até 2 de cada. O backend recusa qualquer código fora
 * da lista permitida ("Valor fora da taxonomia"), e um código que não aparece como chip não pode ser desmarcado na tela —
 * por isso tudo o que entra no formulário (palpite da IA, troca de categoria, peça antiga) passa por aqui.
 */
export const MAX_TAGS = 2;

/** Só os códigos permitidos, sem repetidos, na ordem recebida, até `max`. Sem lista permitida (taxonomia carregando), não mexe. */
export function keepAllowed(values: readonly string[] | null | undefined, allowed: readonly string[] | null | undefined, max = MAX_TAGS): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of values ?? []) {
    const v = (raw ?? "").trim().toLowerCase();
    if (!v || seen.has(v) || (allowed && !allowed.includes(v))) continue;
    seen.add(v); out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** Mesmo conteúdo, mesma ordem — evita re-render em laço quando a limpeza não muda nada. */
export const sameTags = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Campos obrigatórios da peça que ainda estão vazios (o backend exige ao menos 1 ocasião e 1 estilo). */
export function missingTags(v: { occasion: readonly string[]; style: readonly string[] }): ("occasion" | "style")[] {
  return (["occasion", "style"] as const).filter((k) => v[k].length === 0);
}
