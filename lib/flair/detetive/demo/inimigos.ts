/**
 * Os vigias da demonstração: patrulham a rota andando; quem vê a pessoa (cone à frente, sem parede no meio, ou de muito
 * perto) corre atrás dela, um pouco mais devagar que a corrida dela; perto, prepara o golpe e acerta se ela ainda
 * estiver ao alcance. Perdendo-a de vista, vai até onde a viu, olha em volta e volta à ronda. Ferido recua um instante;
 * atordoado (laquê) fica parado; abatido cai e some depois de alguns segundos. Puro (mexe no rascunho do passo).
 */
import { ATORDOADO_POR, FERIDO_POR } from "@/lib/flair/detetive/demo/armas";
import { diferencaDeGiro, distancia, giroPara, linhaLivre, moverComColisao } from "@/lib/flair/detetive/demo/colisao";
import { caixasDe, RAIO_DO_CORPO } from "@/lib/flair/detetive/demo/mundo";
import type { EstadoDaDemo, EventoDaDemo, Ponto, Vigia } from "@/lib/flair/detetive/demo/tipos";

export const VISAO = 7;
export const MEIA_VISAO = (55 * Math.PI) / 180;
/** De tão perto o vigia percebe a pessoa mesmo de costas. */
export const OUVE = 1.6;
export const RONDA = 1.2;
export const PERSEGUICAO = 3.1;
export const ALCANCE_DO_GOLPE = 1.45;
export const COMECA_O_GOLPE = 1.05;
export const PREPARO = 0.45;
export const FIM_DO_GOLPE = 0.95;
export const DANO_DO_VIGIA = 14;
export const SOME_DEPOIS = 4;
export const PROCURA_POR = 2.5;

/** O vigia vê a pessoa agora? */
export function ve(e: EstadoDaDemo, v: Vigia): boolean {
  const j = e.jogador;
  if (j.vida <= 0) return false;
  const d = distancia(v, j);
  if (d < OUVE) return true;
  if (d > VISAO || diferencaDeGiro(giroPara(v, j), v.giro) > MEIA_VISAO) return false;
  return linhaLivre(v, j, caixasDe(e));
}

function irAte(e: EstadoDaDemo, v: Vigia, alvo: Ponto, velocidade: number, dt: number): boolean {
  const d = distancia(v, alvo);
  if (d < 0.15) return true;
  const passo = Math.min(d, velocidade * dt);
  const novo = moverComColisao(v, { x: ((alvo.x - v.x) / d) * passo, z: ((alvo.z - v.z) / d) * passo }, caixasDe(e), RAIO_DO_CORPO);
  // não entra no corpo da pessoa
  if (distancia(novo, e.jogador) >= 0.7 || distancia(novo, e.jogador) > distancia(v, e.jogador)) {
    v.x = novo.x;
    v.z = novo.z;
  }
  v.giro = giroPara(v, alvo);
  return false;
}

function mudar(v: Vigia, modo: Vigia["modo"]): void {
  v.modo = modo;
  v.noModo = 0;
}

function golpear(e: EstadoDaDemo, v: Vigia, eventos: EventoDaDemo[]): void {
  const j = e.jogador;
  v.giro = giroPara(v, j);
  if (!v.golpeou && v.noModo >= PREPARO) {
    v.golpeou = true;
    if (distancia(v, j) <= ALCANCE_DO_GOLPE && j.folga <= 0 && j.vida > 0) {
      j.vida = Math.max(0, j.vida - DANO_DO_VIGIA);
      j.folga = 0.6;
      j.gesto = { tipo: "RECUO", t: 0 };
      const d = Math.max(0.01, distancia(v, j));
      Object.assign(j, moverComColisao(j, { x: ((j.x - v.x) / d) * 0.3, z: ((j.z - v.z) / d) * 0.3 }, caixasDe(e), RAIO_DO_CORPO));
      eventos.push({ tipo: "DANO_NO_JOGADOR", dano: DANO_DO_VIGIA });
    }
  }
  if (v.noModo >= FIM_DO_GOLPE) mudar(v, "PERSEGUE");
}

/** Um passo de um vigia. */
export function passoDoVigia(e: EstadoDaDemo, v: Vigia, dt: number, eventos: EventoDaDemo[]): void {
  if (v.sumiu) return;
  v.noModo += dt;
  const j = e.jogador;
  switch (v.modo) {
    case "ABATIDO":
      if (v.noModo >= SOME_DEPOIS) v.sumiu = true;
      return;
    case "ATORDOADO":
      if (v.noModo >= ATORDOADO_POR) {
        mudar(v, "PERSEGUE");
        v.visto = { x: j.x, z: j.z };
      }
      return;
    case "FERIDO":
      if (v.noModo >= FERIDO_POR) mudar(v, "PERSEGUE");
      return;
    case "ATACA":
      return golpear(e, v, eventos);
    case "PATRULHA":
      if (ve(e, v)) {
        mudar(v, "PERSEGUE");
        v.visto = { x: j.x, z: j.z };
        eventos.push({ tipo: "VISTO", vigia: v.id });
        return;
      }
      if (irAte(e, v, v.rota[v.alvoDaRota], RONDA, dt)) v.alvoDaRota = (v.alvoDaRota + 1) % v.rota.length;
      return;
    case "PROCURA":
      if (ve(e, v)) {
        mudar(v, "PERSEGUE");
        v.visto = { x: j.x, z: j.z };
        return;
      }
      v.giro += dt * 1.8;
      if (v.noModo >= PROCURA_POR) mudar(v, "PATRULHA");
      return;
    case "PERSEGUE": {
      if (ve(e, v)) v.visto = { x: j.x, z: j.z };
      if (j.vida > 0 && distancia(v, j) <= COMECA_O_GOLPE && v.recarga <= 0) {
        mudar(v, "ATACA");
        v.golpeou = false;
        v.recarga = 1.2;
        return;
      }
      v.recarga = Math.max(0, v.recarga - dt);
      const chegou = !v.visto || irAte(e, v, v.visto, PERSEGUICAO, dt);
      if (chegou && !ve(e, v)) mudar(v, "PROCURA");
      return;
    }
  }
}
