/**
 * Preço da peça que vale mostrar: o cadastro grava 0 quando a pessoa não informa o preço, e a página mostrava "R$ 0,00".
 * Zero ou vazio = não informado.
 */
export function informedPrice(price: number | string | null | undefined): number | null {
  const n = price === null || price === undefined || price === "" ? NaN : Number(price);
  return Number.isFinite(n) && n > 0 ? n : null;
}
