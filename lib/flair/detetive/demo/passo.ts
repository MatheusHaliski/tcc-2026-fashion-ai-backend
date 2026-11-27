/**
 * Um passo da demonstração (chamado a cada quadro com o tempo que passou): a pessoa anda (Shift corre; mirando, anda
 * devagar virada para o alvo travado), usa o que está perto (E), recarrega (R), dispara ou golpeia (F); os alfinetes
 * voam e acertam; os vigias andam e atacam; os efeitos de impacto se apagam. Devolve um estado novo e o que aconteceu
 * (para o aviso curto, o flash vermelho e o tremor da câmera). Puro: o estado de entrada não muda.
 */
import { alvoTravado, ARMAS, disparar, efeito, fecharRecarga, ferir, recarregar, vivo } from "@/lib/flair/detetive/demo/armas";
import { distancia, linhaLivre, lugarLivre, moverComColisao } from "@/lib/flair/detetive/demo/colisao";
import { passoDoVigia } from "@/lib/flair/detetive/demo/inimigos";
import { interagir } from "@/lib/flair/detetive/demo/interacao";
import { ANDAR, caixasDe, CORRER, RAIO_DO_CORPO } from "@/lib/flair/detetive/demo/mundo";
import type { EntradaDaDemo, EstadoDaDemo, EventoDaDemo } from "@/lib/flair/detetive/demo/tipos";

export const PASSO_MAXIMO = 0.1;
export const VIDA_DO_EFEITO = { FAISCA: 0.45, BRILHO: 0.7, TECIDO: 0.9, NUVEM: 1.2, CURA: 0.9 } as const;
const VIDA_DO_GESTO = 0.6;

/** Cópia funda o bastante para o passo mexer à vontade. */
export function clonar(e: EstadoDaDemo): EstadoDaDemo {
  return {
    ...e,
    jogador: { ...e.jogador, municao: { ...e.jogador.municao }, gesto: e.jogador.gesto && { ...e.jogador.gesto } },
    vigias: e.vigias.map((v) => ({ ...v, visto: v.visto && { ...v.visto } })),
    interativos: e.interativos.map((i) => ({ ...i })),
    projeteis: e.projeteis.map((p) => ({ ...p })),
    efeitos: e.efeitos.map((x) => ({ ...x })),
  };
}

function voarAlfinetes(e: EstadoDaDemo, dt: number, eventos: EventoDaDemo[]): void {
  const caixas = caixasDe(e);
  e.projeteis = e.projeteis.filter((p) => {
    const de = { x: p.x, z: p.z };
    const ate = { x: p.x + p.vx * dt, z: p.z + p.vz * dt };
    const alvo = e.vigias.find((v) => vivo(v) && !v.sumiu && distanciaAoSegmento(v, de, ate) < 0.45);
    if (alvo) {
      ferir(e, alvo, ARMAS.PISTOLA.dano, eventos);
      return false;
    }
    if (!linhaLivre(de, ate, caixas) || !lugarLivre(ate, [], 0)) {
      efeito(e, "FAISCA", de.x, de.z);
      return false;
    }
    p.x = ate.x;
    p.z = ate.z;
    p.resta -= distancia(de, ate);
    return p.resta > 0;
  });
}

function distanciaAoSegmento(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = dx * dx + dz * dz;
  const t = n === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / n));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

export function passo(e0: EstadoDaDemo, entrada: EntradaDaDemo, dtCru: number): { estado: EstadoDaDemo; eventos: EventoDaDemo[] } {
  if (e0.fim) return { estado: e0, eventos: [] };
  const dt = Math.max(0, Math.min(PASSO_MAXIMO, dtCru));
  const e = clonar(e0);
  const eventos: EventoDaDemo[] = [];
  const j = e.jogador;
  e.t += dt;
  j.recarga = Math.max(0, j.recarga - dt);
  j.folga = Math.max(0, j.folga - dt);
  if (j.gesto) j.gesto.t += dt;
  if (j.gesto && j.gesto.t > VIDA_DO_GESTO) j.gesto = null;
  if (j.recarregando > 0) {
    j.recarregando = Math.max(0, j.recarregando - dt);
    if (j.recarregando === 0) fecharRecarga(e, eventos);
  }
  // andar: mirando, devagar; Shift corre
  const forca = Math.min(1, Math.hypot(entrada.mover.x, entrada.mover.z));
  const velocidade = entrada.mirando ? ANDAR * 0.5 : entrada.correr ? CORRER : ANDAR;
  j.andando = forca > 0.05;
  j.correndo = j.andando && entrada.correr && !entrada.mirando;
  if (j.andando) {
    const k = (velocidade * dt) / Math.max(1, Math.hypot(entrada.mover.x, entrada.mover.z));
    Object.assign(j, moverComColisao(j, { x: entrada.mover.x * k, z: entrada.mover.z * k }, caixasDe(e), RAIO_DO_CORPO));
  }
  const alvo = entrada.mirando ? alvoTravado(e) : null;
  if (alvo) j.giro = Math.atan2(alvo.x - j.x, alvo.z - j.z);
  else if (j.andando) j.giro = Math.atan2(entrada.mover.x, entrada.mover.z);
  if (entrada.interagir) interagir(e, eventos);
  if (entrada.recarregar) recarregar(e, eventos);
  if (entrada.disparar) disparar(e, entrada.mirando, eventos);
  voarAlfinetes(e, dt, eventos);
  for (const v of e.vigias) passoDoVigia(e, v, dt, eventos);
  e.efeitos = e.efeitos.filter((x) => (x.t += dt) < VIDA_DO_EFEITO[x.tipo]);
  if (j.vida <= 0 && !e.fim) {
    e.fim = "PEGA";
    eventos.push({ tipo: "FIM", fim: "PEGA" });
  }
  return { estado: e, eventos };
}
