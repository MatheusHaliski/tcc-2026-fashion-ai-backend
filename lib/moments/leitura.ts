import type { Interpretation } from "./types";

/**
 * Nome da leitura do Momento para mostrar: o rótulo cadastrado no Momento quando a tela o tem; senão a chave escrita
 * como nome ("total-denim" → "Total denim"), nunca o código cru ("TOTAL-DENIM").
 */
export function nomeDaLeitura(key: string, interpretations?: Interpretation[] | null): string {
  const cadastrada = interpretations?.find((i) => i.key === key)?.label;
  if (cadastrada) return cadastrada;
  const texto = key.replace(/[-_]+/g, " ").trim().toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
