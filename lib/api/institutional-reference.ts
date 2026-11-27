import type { ReferenceOption } from "@/lib/api/types";

/** O que o card e o cabeçalho institucional precisam para mostrar a categoria (marca) ou a área principal (celebridade). */
export interface InstitutionalReferenceSource {
  /** exercício 09: opção da tabela categorias_marca gravada como FK no perfil da marca */
  categoriaPrincipal?: ReferenceOption | null;
  /** exercício 10: opção da tabela areas_artisticas gravada como FK no perfil da celebridade */
  areaPrincipal?: ReferenceOption | null;
  /** texto livre antigo da marca (fashion_category), sem conversão */
  category?: string | null;
  fashionCategory?: string | null;
  /** lista livre antiga da celebridade (areas_json) */
  areas?: string[] | null;
}

export interface InstitutionalReferenceLine {
  /** nome da opção escolhida, ou o texto legado quando não há opção; nulo quando o perfil não informou nada */
  principal: string | null;
  /** "opcao": veio da tabela de opções; "legado": texto/lista antigos do cadastro */
  origem: "opcao" | "legado" | null;
  /** áreas da lista antiga que não repetem a principal (só celebridade); continuam visíveis à parte */
  outras: string[];
}

/**
 * Prefere a opção escolhida (id estável, nome atual da tabela) e só cai no texto legado quando o perfil ainda não
 * escolheu uma: o texto antigo nunca é convertido em opção. A lista de áreas da celebridade não some ao escolher a
 * principal.
 */
export function institutionalReferenceLine(source: InstitutionalReferenceSource, celebrity: boolean): InstitutionalReferenceLine {
  const areas = (source.areas ?? []).filter((area) => !!area?.trim());
  const escolhida = (celebrity ? source.areaPrincipal : source.categoriaPrincipal)?.nome?.trim();
  if (escolhida) {
    const igual = escolhida.toLocaleLowerCase();
    return { principal: escolhida, origem: "opcao", outras: celebrity ? areas.filter((area) => area.trim().toLocaleLowerCase() !== igual) : [] };
  }
  const legado = (source.category ?? source.fashionCategory)?.trim();
  if (legado) return { principal: legado, origem: "legado", outras: [] };
  if (areas.length) return { principal: areas[0], origem: "legado", outras: areas.slice(1) };
  return { principal: null, origem: null, outras: [] };
}
