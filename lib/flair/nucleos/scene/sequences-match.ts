/**
 * Disputas que rodam sozinhas depois de entregar (seção 2, coluna "Automático"): a luta do Dress Fighter em três
 * rounds e a partida do Fashion Sports, montadas com os eventos do resultado que o servidor já calculou. A cena só
 * mostra: nenhum golpe ou gol muda a nota.
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types";
import type { Sequencia } from "@/lib/flair/nucleos/scene/director";
import { lancesDaLuta, type LanceDaLuta } from "@/lib/flair/nucleos/luta";
import { QUADRA_GOL_Z } from "@/lib/flair/nucleos/scene/salas/fashion-sports";
import { AVATAR, fig, luzId, movelId, Roteiro } from "@/lib/flair/nucleos/scene/script";

export interface Round {
  round: number;
  atributo: string;
  venceu: boolean;
}

/** Rounds da luta, lidos dos eventos ROUND do resultado. */
export function roundsDaLuta(resultado: NucleoResultado): Round[] {
  return resultado.eventos
    .filter((e) => e.codigo === "ROUND" && !!e.valor && typeof e.valor === "object")
    .map((e) => {
      const v = e.valor as Record<string, unknown>;
      return { round: Number(v.round ?? 0), atributo: String(v.atributo ?? ""), venceu: v.venceu === true };
    });
}

/** Golpe do avatar em cada round: velocidade = soco, ataque = chute, defesa = golpe especial. */
const GOLPE: Record<string, string> = { VELOCIDADE: "SOCO", ATAQUE: "CHUTE", DEFESA: "GOLPE_ESPECIAL" };
const OPONENTE = fig("OPONENTE", 0);
/** A torcida do beco (as calçadas da arena): vibra com o golpe da avatar e lamenta o que ela leva. */
const TORCIDA_DA_ARENA = fig("TORCEDOR");

/** A reação da torcida ao lance: quem acertou sem levar, quem só levou, ou a troca de golpes. */
export function reacaoDaArena(dano: number, sofrido: number): string | null {
  if (dano > 0 && sofrido > 0) return "F_APLAUSO";
  if (dano > 0) return "F_COMEMORA";
  return sofrido > 0 ? "F_LAMENTA" : null;
}

/** Onde o oponente luta: a um passo largo do avatar, de frente para ele (de onde fica no preparo, ele vem andando). */
const DISTANCIA_DA_LUTA = { x: 1.1, z: -0.3 };

/** A luta acabou? No meio dela (EM_ACAO) o servidor ainda não disse quem venceu: não há queda nem comemoração. */
export const lutaEncerrada = (resultado: NucleoResultado): boolean => resultado.resultado === "VITORIA" || resultado.resultado === "DERROTA";

/** O movimento da avatar para cada golpe (a cor da carta jogada no lance). */
const CLIPE_DO_GOLPE: Record<string, string> = {
  GOLPE_FORTE: "CHUTE", GOLPE_RAPIDO: "SOCO", GOLPE_BASICO: "SOCO", GUARDA: "DEFESA", GUARDA_BASICA: "DEFESA",
  ESQUIVA: "ESQUIVA", FOLEGO: "GUARDA", FOCO: "DEFESA", ESPECIAL: "GOLPE_ESPECIAL",
};
/** O movimento da oponente para o golpe dela. */
const CLIPE_DA_OPONENTE: Record<string, string> = { GOLPE_FORTE: "F_SOCO", GOLPE_RAPIDO: "F_SOCO", GUARDA: "F_DEFESA", ESQUIVA: "F_ESQUIVA" };

/** Um lance na cena: os dois golpes juntos, depois quem levou dano recua; o foco devolve com um soco. */
function lanceNaCena(r: Roteiro, l: LanceDaLuta): void {
  r.junto(OPONENTE, "F_GUARDA").depois(AVATAR, "GUARDA");
  if (l.golpe === "ESPECIAL" || l.combo) r.junto(luzId("rastro"), "L_RASTRO");
  r.junto(OPONENTE, CLIPE_DA_OPONENTE[l.golpeOponente] ?? "F_GUARDA").depois(AVATAR, CLIPE_DO_GOLPE[l.golpe] ?? "GUARDA");
  if (l.golpe === "FOCO" && l.dano > 0) r.depois(AVATAR, "SOCO");
  const torcida = reacaoDaArena(l.dano, l.sofrido);
  if (torcida) r.junto(TORCIDA_DA_ARENA, torcida);
  if (l.dano > 0 && l.sofrido > 0) r.junto(OPONENTE, "F_RECUO").depois(AVATAR, "RECUO");
  else if (l.dano > 0) r.depois(OPONENTE, "F_RECUO");
  else if (l.sofrido > 0) r.depois(AVATAR, "RECUO");
}

/** O formato antigo (um round por atributo, sem lances): resultados guardados antes da luta lance a lance. */
function roundNaCena(r: Roteiro, round: Round): void {
  r.junto(OPONENTE, "F_GUARDA").depois(AVATAR, "GUARDA");
  if (round.venceu) {
    const golpe = GOLPE[round.atributo] ?? "SOCO";
    if (golpe === "GOLPE_ESPECIAL") r.junto(luzId("rastro"), "L_RASTRO");
    r.junto(TORCIDA_DA_ARENA, "F_COMEMORA", {}, 0.3).junto(OPONENTE, "F_RECUO", {}, 0.3).depois(AVATAR, golpe);
  } else {
    r.junto(TORCIDA_DA_ARENA, "F_LAMENTA", {}, 0.3).junto(OPONENTE, "F_SOCO").depois(AVATAR, round.atributo === "VELOCIDADE" ? "ESQUIVA" : "DEFESA");
  }
}

/**
 * A luta na cena. Lance a lance, só o lance novo (os anteriores já passaram na tela); no fim, o desfecho de quem venceu
 * a luta: a queda é de quem perdeu, nunca depois de um lance ou round vencido. No meio da luta não há desfecho.
 */
export function sequenciaDaLuta(resultado: NucleoResultado): Sequencia {
  const r = new Roteiro("luta");
  const encerrada = lutaEncerrada(resultado);
  const lances = lancesDaLuta(resultado);
  r.junto(OPONENTE, "F_GUARDA", { mover: DISTANCIA_DA_LUTA }).depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 75 } });
  if (lances.length) lanceNaCena(r, lances[lances.length - 1]);
  else {
    const rounds = roundsDaLuta(resultado);
    for (const round of encerrada ? rounds : rounds.slice(-1)) roundNaCena(r, round);
  }
  // o desfecho de verdade: o beco grita o nome de quem venceu, ou lamenta a queda da avatar
  if (resultado.resultado === "VITORIA") r.junto(TORCIDA_DA_ARENA, "F_COMEMORA").depois(OPONENTE, "F_QUEDA");
  else if (encerrada) r.junto(TORCIDA_DA_ARENA, "F_LAMENTA").junto(OPONENTE, "F_COMEMORA").depois(AVATAR, "QUEDA");
  return r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } }).fim();
}

/** Placar "nós-eles" do evento PLACAR; sem evento, 0 a 0. */
export function golsDaPartida(resultado: NucleoResultado): [number, number] {
  const placar = resultado.eventos.find((e) => e.codigo === "PLACAR")?.valor;
  const m = /^(\d+)\D+(\d+)$/.exec(String(placar ?? ""));
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Coesão do uniforme (0 a 100): abaixo de 100, a jogada tem um passe errado. */
export function coesaoDaPartida(resultado: NucleoResultado): number {
  const v = resultado.eventos.find((e) => e.codigo === "COESAO")?.valor;
  return typeof v === "number" ? v : 100;
}

const BOLA = movelId("bola");
const AREA_Z = QUADRA_GOL_Z + 2.6;

/** Um gol do time do avatar: o colega passa, o avatar corre, chuta e comemora; depois todos voltam. */
function golNosso(r: Roteiro): void {
  r.junto(fig("COLEGA", 0), "F_CHUTAR").junto(BOLA, "M_BOLA_NO_AR", { mover: { x: 0.4, z: AREA_Z + 0.5 } });
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 180 } });
  r.junto(AVATAR, "BRACOS_DE_CORRIDA").junto(fig("COLEGA"), "F_CORRER", { repete: 3 }).depois(AVATAR, "CORRER", { repete: 3, mover: { z: AREA_Z } });
  r.junto(luzId("rastro"), "L_RASTRO").junto(BOLA, "M_BOLA_NO_AR", { mover: { x: 0.8, z: QUADRA_GOL_Z - 0.5 } }, 0.5).depois(AVATAR, "CHUTAR");
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } });
  r.junto(fig("COLEGA"), "F_COMEMORA").junto(fig("TORCIDA"), "F_COMEMORA").junto(fig("RESERVA"), "F_COMEMORA").junto(fig("ADVERSARIO"), "F_LAMENTA").depois(AVATAR, "COMEMORAR");
  r.junto(BOLA, "M_BOLA_NO_AR", { mover: { x: 0.55, z: 0.5 } }).depois(AVATAR, "CAMINHAR", { repete: 2, mover: { z: 0 } });
}

/** Um gol do adversário: ele chuta, o avatar tenta defender e o time lamenta; com pouca coesão, um passe errado antes. */
function golDeles(r: Roteiro, passeErrado: boolean): void {
  if (passeErrado) r.junto(fig("COLEGA", 1), "F_LAMENTA").depois(AVATAR, "PASSE_ERRADO");
  r.junto(fig("ADVERSARIO"), "F_CORRER", { repete: 2 }).depois(BOLA, "M_BOLA_NO_AR", { mover: { x: -0.9, z: -3 } });
  r.junto(BOLA, "M_BOLA_NO_AR", { mover: { x: 1.3, z: 0.9 } }, 0.4).junto(fig("ADVERSARIO", 2), "F_CHUTAR").depois(AVATAR, "DEFENDER");
  r.junto(fig("ADVERSARIO"), "F_COMEMORA").junto(fig("TORCIDA"), "F_LAMENTA").junto(fig("RESERVA"), "F_LAMENTA").depois(fig("COLEGA"), "F_LAMENTA");
  r.depois(BOLA, "M_BOLA_NO_AR", { mover: { x: 0.55, z: 0.5 } });
}

/** No máximo três jogadas na tela; o placar inteiro aparece no painel. */
const JOGADAS_MAX = 3;

export function sequenciaDaPartida(resultado: NucleoResultado): Sequencia {
  const [nos, eles] = golsDaPartida(resultado);
  const passeErrado = coesaoDaPartida(resultado) < 100;
  const r = new Roteiro("partida");
  const jogadas: ("nos" | "eles")[] = [];
  for (let i = 0; i < Math.max(nos, eles); i++) {
    if (i < nos) jogadas.push("nos");
    if (i < eles) jogadas.push("eles");
  }
  for (const quem of jogadas.slice(0, JOGADAS_MAX)) {
    if (quem === "nos") golNosso(r);
    else golDeles(r, passeErrado);
  }
  return r.fim();
}
