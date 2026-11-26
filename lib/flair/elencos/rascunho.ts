/**
 * Elenco em montagem guardado no navegador: recarregar a página ou voltar depois não zera as vagas. É só conveniência
 * de quem monta (o elenco vale quando é entregue no servidor); sem armazenamento disponível, nada quebra.
 */
const chave = (codigo: string) => `fai:cbc:rascunho:${codigo}`;

export function lerRascunho(codigo: string): Record<string, string> {
  try {
    const bruto = window.localStorage.getItem(chave(codigo));
    const dados = bruto ? JSON.parse(bruto) : null;
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) return {};
    return Object.fromEntries(Object.entries(dados).filter(([, id]) => typeof id === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function gravarRascunho(codigo: string, cartas: Record<string, string>): void {
  try {
    if (Object.keys(cartas).length === 0) window.localStorage.removeItem(chave(codigo));
    else window.localStorage.setItem(chave(codigo), JSON.stringify(cartas));
  } catch {
    /* navegador sem armazenamento: o elenco só não é lembrado */
  }
}
