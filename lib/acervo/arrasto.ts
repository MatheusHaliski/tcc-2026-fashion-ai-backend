/** ACERVO — arrastar peças entre compartimentos (HTML drag and drop): o que vai no arrasto são os ids das peças. */
const TIPO = "application/x-acervo-pecas";

interface Transferencia {
  setData(formato: string, dados: string): void;
  getData(formato: string): string;
  types: readonly string[];
  effectAllowed: string;
  dropEffect: string;
}

export function iniciarArrasto(evento: { dataTransfer: Transferencia | null }, pieceIds: string[]): void {
  if (!evento.dataTransfer) return;
  evento.dataTransfer.setData(TIPO, JSON.stringify(pieceIds));
  evento.dataTransfer.effectAllowed = "move";
}

export function temArrasto(evento: { dataTransfer: Transferencia | null }): boolean {
  return !!evento.dataTransfer && Array.from(evento.dataTransfer.types).includes(TIPO);
}

/** Ids das peças soltas; lista vazia quando o que foi solto não veio do ACERVO. */
export function lerArrasto(evento: { dataTransfer: Transferencia | null }): string[] {
  if (!evento.dataTransfer) return [];
  try {
    const ids: unknown = JSON.parse(evento.dataTransfer.getData(TIPO) || "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
