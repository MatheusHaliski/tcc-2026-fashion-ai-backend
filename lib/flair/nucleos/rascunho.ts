/**
 * O rascunho do look na preparação, guardado no navegador por partida (ou por brief, no MAKE UP): quem recarrega a página
 * ou sai e volta reencontra as peças que já tinha vestido. Só conveniência deste navegador: a partida em si (deck,
 * entregas, passos) fica no servidor. Sem armazenamento (janela privada, bloqueado), não guarda e não quebra.
 */
const PREFIXO = "fai.flair3d.rascunho.";

export function lerRascunho<T>(chave: string | null | undefined): T | null {
  if (!chave) return null;
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function gravarRascunho(chave: string, valor: unknown, vazio: boolean) {
  try {
    if (vazio) localStorage.removeItem(PREFIXO + chave);
    else localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: o rascunho só não fica guardado
  }
}
