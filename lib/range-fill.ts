/**
 * Seletor de porcentagem (token FashionAI): o CSS preenche o trilho até --pct. Aplique o resultado no `style` do
 * <input type="range"> para o preenchimento acompanhar o valor em todas as abas (Arte da peça, selos, foto, avatar).
 */
export function rangeFill(value: number, min: number, max: number): { "--pct": string } {
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return { "--pct": `${pct.toFixed(1)}%` };
}
