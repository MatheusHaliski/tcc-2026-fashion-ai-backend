import { label } from "@/lib/api/taxonomy";

type Translate = (key: string) => string;

/**
 * Nomes dos gráficos do painel: o servidor manda códigos (APPROVED, TEN_X_TEN, MULTI_PIECE_DETECTOR). Cada grupo tem as
 * suas chaves de texto; código sem tradução cai no rótulo genérico, nunca no código cru em maiúsculas.
 */
function named(prefix: string, code: string, t: Translate): string {
  const key = `${prefix}.${code.toUpperCase()}`;
  const text = t(key);
  return text === key ? label(code) : text;
}

/** Estado do vínculo de selo (funil de selos). */
export const sealStatusName = (code: string, t: Translate) => named("adminDash.selo", code, t);

/** Tipo de desafio (participantes por desafio). */
export const challengeName = (code: string, t: Translate) => named("adminDash.desafio", code, t);

/** Capacidade de IA (uso e custo por capacidade). */
export const aiCapabilityName = (code: string, t: Translate) => named("adminDash.ia", code, t);
