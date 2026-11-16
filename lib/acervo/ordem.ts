/**
 * ACERVO — reordenar ambientes, móveis e compartimentos no diretório. A API pede a lista inteira de um nível (todos os
 * móveis do ambiente, inclusive os do outro modo); a tela mostra só parte dela (os móveis de "Meu espaço" ou do Dream
 * Space). Aqui o item muda de lugar entre os visíveis e os escondidos ficam onde estavam.
 */

/**
 * Nova ordem completa com {@code id} levado à posição {@code destino} entre os visíveis; null quando nada muda (posição
 * igual, fora da lista ou item que não está visível).
 */
export function reordenar(todos: string[], visiveis: string[], id: string, destino: number): string[] | null {
  const origem = visiveis.indexOf(id);
  if (origem < 0 || destino < 0 || destino >= visiveis.length || destino === origem) return null;
  const novaVisivel = visiveis.filter((v) => v !== id);
  novaVisivel.splice(destino, 0, id);
  const vagas = new Set(visiveis);
  let proximo = 0;
  return todos.map((atual) => (vagas.has(atual) ? novaVisivel[proximo++] : atual));
}

/** Um nível do diretório que pode ser reordenado. */
export interface NivelDeOrdem {
  /** identifica o nível (soltar só vale entre itens do mesmo nível) */
  chave: string;
  todos: string[];
  visiveis: string[];
  salvar: (ids: string[]) => Promise<unknown>;
}

