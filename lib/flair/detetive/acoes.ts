/**
 * As ações que a pessoa pode tentar no ponto em que está (o servidor confere de novo e recusa o que não vale): andar até
 * um ponto vizinho, esperar, portas, armários, esconderijo, bolso, confronto, vida, completar pista e mercado. Cada uma
 * diz a cor de carta que pede (a ação da tabela DETETIVE: ABRIR verde, FURTIVIDADE preto, VIDA amarelo, DANO azul,
 * PISTA branco, MOEDA vermelho) ou nula, quando não gasta carta. Puro.
 */
import type { Retrato, VigiaDaSala } from "@/lib/flair/detetive/types";

export type AcaoDeCor = "ABRIR" | "FURTIVIDADE" | "VIDA" | "DANO" | "PISTA" | "MOEDA";
/** A cor que a ação pede; QUALQUER = trocar uma carta (qualquer cor serve). */
export type CorPedida = AcaoDeCor | "QUALQUER";
export const ACOES_DE_COR: readonly AcaoDeCor[] = ["ABRIR", "FURTIVIDADE", "VIDA", "DANO", "PISTA", "MOEDA"];
/** O que o balcão do mercado vende (a carta vermelha paga). */
export const COMPRAVEIS: readonly AcaoDeCor[] = ["ABRIR", "FURTIVIDADE", "VIDA", "DANO", "PISTA"];

export interface AcaoPossivel {
  /** o alvo que vai ao servidor ("IR:meio", "ABRIR:MESA_DA_RECEPCAO"...) */
  alvo: string;
  /** o verbo (chave do texto) e o assunto */
  verbo: string;
  assunto: string;
  /** a cor de carta que a ação pede; nula = não gasta carta */
  cor: CorPedida | null;
}

const acao = (verbo: string, assunto: string, cor: CorPedida | null): AcaoPossivel => ({ alvo: assunto ? `${verbo}:${assunto}` : verbo, verbo, assunto, cor });

function pertoDe(r: Retrato, v: VigiaDaSala): boolean {
  const p = r.layout.pontos.find((x) => x.id === r.ponto);
  return !!p && Math.hypot(p.x - v.x, p.z - v.z) <= r.passoMaximo;
}

/** Os pontos a que se chega com um passo, do mais perto ao mais longe. */
export function vizinhos(r: Retrato): string[] {
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
  if (!aqui) return [];
  return r.layout.pontos
    .filter((p) => p.id !== aqui.id && Math.hypot(p.x - aqui.x, p.z - aqui.z) <= r.passoMaximo)
    .sort((a, b) => Math.hypot(a.x - aqui.x, a.z - aqui.z) - Math.hypot(b.x - aqui.x, b.z - aqui.z))
    .map((p) => p.id);
}

export function acoesPossiveis(r: Retrato): AcaoPossivel[] {
  if (r.final) return [];
  const out: AcaoPossivel[] = [];
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
  for (const s of r.layout.saidas.filter((x) => x.ponto === r.ponto)) {
    if (s.barrada) {
      out.push(acao("AJUDA", s.para, null));
    } else if (s.aberta) {
      out.push(acao("PORTA", s.para, null));
    } else {
      if (s.chave && r.chaves.includes(s.chave)) out.push(acao("PORTA", s.para, "ABRIR"));
      out.push(acao("AJUDA", s.para, null));
    }
  }
  for (const a of r.layout.armarios.filter((x) => x.ponto === r.ponto && !x.aberto)) out.push(acao("ABRIR", a.id, "ABRIR"));
  if (aqui?.esconderijo && !r.escondido) out.push(acao("ESCONDER", "", "FURTIVIDADE"));
  for (const v of r.layout.vigias.filter((x) => pertoDe(r, x))) {
    if (v.temBolso) out.push(acao("BOLSO", v.id, "FURTIVIDADE"));
    if (v.barra && !v.convencido) out.push(acao("CONFRONTO", v.id, "DANO"));
  }
  if (r.vida < 3) out.push(acao("VIDA", "", "VIDA"));
  for (const p of r.pistas.filter((x) => !x.completa)) out.push(acao("COMPLETAR", p.id, "PISTA"));
  if (r.sala === "CLUBE" && r.ponto === "bar") for (const c of COMPRAVEIS) out.push(acao("MERCADO", c, "MOEDA"));
  if (r.mao.length > 0) out.push(acao("TROCAR", "", "QUALQUER"));
  return out;
}

/** O ponto está no cone de visão do vigia agora? (o mesmo cálculo do servidor, para pintar o aviso na tela) */
export function noCone(r: Retrato, v: VigiaDaSala, x: number, z: number): boolean {
  if (!v.vigia || v.convencido) return false;
  const dx = x - v.x;
  const dz = z - v.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return true;
  if (dist > r.alcance) return false;
  const angulo = (Math.atan2(dx, dz) * 180) / Math.PI;
  const diferenca = Math.abs(((((angulo - v.olhar) % 360) + 540) % 360) - 180);
  return diferenca <= r.meiaAbertura;
}
