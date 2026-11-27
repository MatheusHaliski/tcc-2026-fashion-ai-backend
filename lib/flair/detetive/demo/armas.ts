/**
 * As armas de estilo da demonstração (sem sangue: o golpe solta faíscas, brilho e retalhos de tecido) e o que cada
 * uma faz quando a pessoa aperta F: a pistola de alfinetes dispara um alfinete visível (precisa mirar, gasta um do
 * pente), o spray de laquê atordoa quem estiver no leque à frente (precisa mirar, 3 usos), o leque de tesoura é o
 * golpe forte de perto, e sem mirar todo F é golpe corpo a corpo. O kit de costura cura. R recarrega o pente com a
 * reserva. As funções mexem no rascunho do passo (passo.ts). Puro.
 */
import { distancia, diferencaDeGiro, giroPara, linhaLivre, moverComColisao } from "@/lib/flair/detetive/demo/colisao";
import { caixasDe, RAIO_DO_CORPO, VIDA_MAXIMA } from "@/lib/flair/detetive/demo/mundo";
import type { ArmaId, EstadoDaDemo, EventoDaDemo, TipoDeEfeito, Vigia } from "@/lib/flair/detetive/demo/tipos";

export interface Arma {
  tipo: "CORPO" | "TIRO" | "SPRAY" | "CURA";
  dano: number;
  /** alcance em metros e meia abertura do golpe (rad) */
  alcance: number;
  abertura: number;
  /** segundos entre um uso e outro */
  recarga: number;
}

export const ARMAS: Record<ArmaId, Arma> = {
  MAOS: { tipo: "CORPO", dano: 12, alcance: 1.35, abertura: 0.9, recarga: 0.45 },
  LEQUE: { tipo: "CORPO", dano: 40, alcance: 1.75, abertura: 1.1, recarga: 0.65 },
  PISTOLA: { tipo: "TIRO", dano: 25, alcance: 14, abertura: 0, recarga: 0.22 },
  LAQUE: { tipo: "SPRAY", dano: 0, alcance: 3.4, abertura: 0.62, recarga: 0.9 },
  KIT: { tipo: "CURA", dano: 0, alcance: 0, abertura: 0, recarga: 0.5 },
};

/** As armas na ordem da roda (a primeira fica no alto). */
export const ORDEM_DA_RODA: readonly ArmaId[] = ["PISTOLA", "LEQUE", "LAQUE", "KIT", "MAOS"];

export const PENTE = 12;
export const TEMPO_DE_RECARGA = 1.1;
export const VELOCIDADE_DO_ALFINETE = 18;
export const CURA_DO_KIT = 40;
export const ATORDOADO_POR = 3.5;
export const FERIDO_POR = 0.4;

export function vivo(v: Vigia): boolean {
  return v.modo !== "ABATIDO";
}

export function efeito(e: EstadoDaDemo, tipo: TipoDeEfeito, x: number, z: number): void {
  e.efeitos.push({ id: e.proximoId++, tipo, x, z, t: 0 });
}

/** Quem a mira trava: o vigia de pé mais perto, à vista, até o alcance da pistola. */
export function alvoTravado(e: EstadoDaDemo): Vigia | null {
  const j = e.jogador;
  const caixas = caixasDe(e);
  let melhor: Vigia | null = null;
  for (const v of e.vigias) {
    if (!vivo(v) || v.sumiu) continue;
    const d = distancia(j, v);
    if (d > ARMAS.PISTOLA.alcance || !linhaLivre(j, v, caixas)) continue;
    if (!melhor || d < distancia(j, melhor)) melhor = v;
  }
  return melhor;
}

/** O vigia leva o golpe: perde vida, recua (ferido) ou cai (abatido), e passa a procurar quem bateu. */
export function ferir(e: EstadoDaDemo, v: Vigia, dano: number, eventos: EventoDaDemo[]): void {
  if (!vivo(v)) return;
  v.vida = Math.max(0, v.vida - dano);
  const j = e.jogador;
  efeito(e, dano >= 30 ? "TECIDO" : "FAISCA", v.x, v.z);
  if (v.vida === 0) {
    v.modo = "ABATIDO";
    v.noModo = 0;
    eventos.push({ tipo: "ACERTO", vigia: v.id, abatido: true });
    return;
  }
  const d = Math.max(0.01, distancia(j, v));
  const recuo = { x: ((v.x - j.x) / d) * 0.35, z: ((v.z - j.z) / d) * 0.35 };
  Object.assign(v, moverComColisao(v, recuo, caixasDe(e), RAIO_DO_CORPO));
  v.modo = "FERIDO";
  v.noModo = 0;
  v.visto = { x: j.x, z: j.z };
  v.giro = giroPara(v, j);
  eventos.push({ tipo: "ACERTO", vigia: v.id, abatido: false });
}

function golpe(e: EstadoDaDemo, arma: Arma, eventos: EventoDaDemo[]): void {
  const j = e.jogador;
  // ajuda da mira de perto: vira para o vigia mais perto ao alcance do golpe
  const perto = e.vigias.filter((v) => vivo(v) && !v.sumiu && distancia(j, v) <= arma.alcance + 0.6).sort((a, b) => distancia(j, a) - distancia(j, b))[0];
  if (perto) j.giro = giroPara(j, perto);
  for (const v of e.vigias) {
    if (!vivo(v) || v.sumiu || distancia(j, v) > arma.alcance) continue;
    if (diferencaDeGiro(giroPara(j, v), j.giro) <= arma.abertura) ferir(e, v, arma.dano, eventos);
  }
  j.gesto = { tipo: "GOLPE", t: 0 };
}

/** F: dispara (mirando, com pistola ou laquê) ou dá o golpe corpo a corpo (o leque, se equipado; senão, as mãos). */
export function disparar(e: EstadoDaDemo, mirando: boolean, eventos: EventoDaDemo[]): void {
  const j = e.jogador;
  if (j.recarga > 0 || j.recarregando > 0) return;
  const arma = ARMAS[j.arma];
  if (mirando && j.arma === "PISTOLA") {
    j.recarga = arma.recarga;
    if (j.municao.pente === 0) return void eventos.push({ tipo: "SECO" });
    j.municao.pente -= 1;
    const alvo = alvoTravado(e);
    const giro = alvo ? giroPara(j, alvo) : j.giro;
    j.giro = giro;
    const vx = Math.sin(giro) * VELOCIDADE_DO_ALFINETE;
    const vz = Math.cos(giro) * VELOCIDADE_DO_ALFINETE;
    e.projeteis.push({ id: e.proximoId++, x: j.x + Math.sin(giro) * 0.45, z: j.z + Math.cos(giro) * 0.45, vx, vz, resta: arma.alcance });
    j.gesto = { tipo: "DISPARO", t: 0 };
    return;
  }
  if (mirando && j.arma === "LAQUE") {
    j.recarga = arma.recarga;
    if (j.municao.laque === 0) return void eventos.push({ tipo: "SECO" });
    j.municao.laque -= 1;
    const caixas = caixasDe(e);
    efeito(e, "NUVEM", j.x + Math.sin(j.giro) * 1.4, j.z + Math.cos(j.giro) * 1.4);
    for (const v of e.vigias) {
      if (!vivo(v) || v.sumiu || distancia(j, v) > arma.alcance || !linhaLivre(j, v, caixas)) continue;
      if (diferencaDeGiro(giroPara(j, v), j.giro) > arma.abertura) continue;
      v.modo = "ATORDOADO";
      v.noModo = 0;
      efeito(e, "BRILHO", v.x, v.z);
    }
    j.gesto = { tipo: "SPRAY", t: 0 };
    return;
  }
  const corpo = j.arma === "LEQUE" ? ARMAS.LEQUE : ARMAS.MAOS;
  j.recarga = corpo.recarga;
  golpe(e, corpo, eventos);
}

/** R: começa a recarregar o pente da pistola (ou avisa que a reserva acabou). */
export function recarregar(e: EstadoDaDemo, eventos: EventoDaDemo[]): void {
  const m = e.jogador.municao;
  if (e.jogador.recarregando > 0 || m.pente === PENTE) return;
  if (m.reserva === 0) return void eventos.push({ tipo: "SEM_RESERVA" });
  e.jogador.recarregando = TEMPO_DE_RECARGA;
}

/** Fim da recarga: passa da reserva para o pente o que cabe. */
export function fecharRecarga(e: EstadoDaDemo, eventos: EventoDaDemo[]): void {
  const m = e.jogador.municao;
  const vai = Math.min(PENTE - m.pente, m.reserva);
  m.pente += vai;
  m.reserva -= vai;
  eventos.push({ tipo: "RECARGA_FEITA" });
}

/** O kit de costura: cura até a vida máxima e gasta um kit. Devolve se curou. */
export function usarKit(e: EstadoDaDemo, eventos: EventoDaDemo[]): boolean {
  const j = e.jogador;
  if (j.municao.kits === 0 || j.vida >= VIDA_MAXIMA) return false;
  j.municao.kits -= 1;
  j.vida = Math.min(VIDA_MAXIMA, j.vida + CURA_DO_KIT);
  j.gesto = { tipo: "CURA", t: 0 };
  efeito(e, "CURA", j.x, j.z);
  eventos.push({ tipo: "CUROU", vida: j.vida });
  return true;
}

/** Usos que sobram de cada arma (para a roda e o canto do HUD); nulo = sem contagem (mãos, leque). */
export function usosDe(e: EstadoDaDemo, arma: ArmaId): { agora: number; reserva?: number } | null {
  const m = e.jogador.municao;
  if (arma === "PISTOLA") return { agora: m.pente, reserva: m.reserva };
  if (arma === "LAQUE") return { agora: m.laque };
  if (arma === "KIT") return { agora: m.kits };
  return null;
}
