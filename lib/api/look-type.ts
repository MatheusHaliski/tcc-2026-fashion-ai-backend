import type { ReferenceOption } from "@/lib/api/types";

type Translate = (key: string) => string;

/**
 * Nome do tipo de look na tela. O cadastro (tabela tipos_look) guarda "Unisex"; a tela mostra pelo código, no idioma de
 * quem lê ("Unissex"). Código sem tradução usa o nome do cadastro, sem precisar de migração.
 */
export function lookTypeName(tipo: Pick<ReferenceOption, "codigo" | "nome">, t: Translate): string {
  const key = `lookType.${String(tipo.codigo).toUpperCase()}`;
  const text = t(key);
  return text === key ? tipo.nome : text;
}
