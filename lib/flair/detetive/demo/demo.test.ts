import { describe, expect, it } from "vitest";
import { ARMAS, CURA_DO_KIT, PENTE, TEMPO_DE_RECARGA, usarKit } from "@/lib/flair/detetive/demo/armas";
import { cruzaCaixa, lugarLivre, moverComColisao } from "@/lib/flair/detetive/demo/colisao";
import { DANO_DO_VIGIA, SOME_DEPOIS } from "@/lib/flair/detetive/demo/inimigos";
import { ALFINETES_DO_CARRETEL, interativoProximo, MUNICAO_DO_ARMARIO, promptDe } from "@/lib/flair/detetive/demo/interacao";
import { caixasDe, estadoInicial, LUGAR, MOVEIS } from "@/lib/flair/detetive/demo/mundo";
import { clonar, passo } from "@/lib/flair/detetive/demo/passo";
import type { EntradaDaDemo, EstadoDaDemo, EventoDaDemo } from "@/lib/flair/detetive/demo/tipos";

/**
 * Regras da demonstração jogável do Fashion Detective (lib/flair/detetive/demo): colisão, porta/gaveta/armário, coleta,
 * munição, recarga, dano nos dois sentidos e o fim (pega ou resolvido).
 */
const PARADA: EntradaDaDemo = { mover: { x: 0, z: 0 }, correr: false, mirando: false };

/** Sem vigias (para testar o resto sem ser atacada). */
function semVigias(): EstadoDaDemo {
  return { ...estadoInicial(), vigias: [] };
}

function em(e: EstadoDaDemo, lugar: { x: number; z: number }): EstadoDaDemo {
  const c = clonar(e);
  c.jogador.x = lugar.x;
  c.jogador.z = lugar.z;
  return c;
}

function rodar(e: EstadoDaDemo, entrada: EntradaDaDemo, segundos: number, dt = 0.05): { estado: EstadoDaDemo; eventos: EventoDaDemo[] } {
  let estado = e;
  const eventos: EventoDaDemo[] = [];
  for (let t = 0; t < segundos - 1e-9; t += dt) {
    const r = passo(estado, entrada, dt);
    estado = r.estado;
    eventos.push(...r.eventos);
  }
  return { estado, eventos };
}

describe("colisão", () => {
  it("a mesa barra o corpo; o passo escorrega pelo eixo que cabe; a porta fechada barra a visão", () => {
    const caixas = caixasDe(estadoInicial());
    const mesa = MOVEIS.find((m) => m.id === "mesa")!.caixa;
    expect(lugarLivre({ x: 0, z: 1 }, caixas, 0.3)).toBe(false);
    expect(moverComColisao({ x: 0, z: 2.2 }, { x: 0.3, z: -0.5 }, caixas, 0.3)).toEqual({ x: 0.3, z: 2.2 });
    expect(cruzaCaixa({ x: 0, z: 3 }, { x: 0, z: -1 }, mesa)).toBe(true);
    expect(lugarLivre({ x: 7, z: 0 }, caixas, 0.3)).toBe(false);
  });

  it("andar com as setas move a pessoa; Shift corre mais longe", () => {
    const anda = rodar(semVigias(), { ...PARADA, mover: { x: 1, z: 0 } }, 0.5).estado.jogador;
    const corre = rodar(semVigias(), { ...PARADA, mover: { x: 1, z: 0 }, correr: true }, 0.5).estado.jogador;
    expect(anda.x).toBeGreaterThan(0.9);
    expect(corre.x).toBeGreaterThan(anda.x + 0.5);
    expect(corre.correndo).toBe(true);
  });
});

describe("porta, gaveta, armário e coleta (E)", () => {
  it("a porta trancada não abre sem chave; a gaveta dá a chave; com ela a porta abre e deixa passar", () => {
    let e = em(semVigias(), LUGAR.PORTA);
    expect(promptDe(e, interativoProximo(e)!)).toBe("TRANCADA");
    let r = passo(e, { ...PARADA, interagir: true }, 0.05);
    expect(r.eventos).toContainEqual({ tipo: "TRANCADA" });
    e = em(r.estado, LUGAR.GAVETA);
    r = passo(e, { ...PARADA, interagir: true }, 0.05);
    expect(r.estado.jogador.chave).toBe(true);
    expect(r.eventos).toContainEqual({ tipo: "PEGOU", item: "CHAVE" });
    e = em(r.estado, LUGAR.PORTA);
    expect(promptDe(e, interativoProximo(e)!)).toBe("DESTRANCAR");
    r = passo(e, { ...PARADA, interagir: true }, 0.05);
    expect(r.eventos).toContainEqual({ tipo: "ABRIU", id: "PORTA" });
    const atravessa = rodar(r.estado, { ...PARADA, mover: { x: 0, z: -1 } }, 1.5).estado.jogador;
    expect(atravessa.z).toBeLessThan(-2.8);
  });

  it("o armário dá alfinetes e laquê; o carretel soma alfinetes; o kit vai para a roda e cura", () => {
    const antes = semVigias().jogador.municao;
    let r = passo(em(semVigias(), LUGAR.ARMARIO), { ...PARADA, interagir: true }, 0.05);
    expect(r.estado.jogador.municao.reserva).toBe(antes.reserva + MUNICAO_DO_ARMARIO.alfinetes);
    expect(r.estado.jogador.municao.laque).toBe(antes.laque + MUNICAO_DO_ARMARIO.laque);
    r = passo(em(r.estado, LUGAR["CARRETEL-1"]), { ...PARADA, interagir: true }, 0.05);
    expect(r.estado.jogador.municao.reserva).toBe(antes.reserva + MUNICAO_DO_ARMARIO.alfinetes + ALFINETES_DO_CARRETEL);
    r = passo(em(r.estado, LUGAR["KIT-1"]), { ...PARADA, interagir: true }, 0.05);
    expect(r.estado.jogador.municao.kits).toBe(antes.kits + 1);
    expect(interativoProximo(r.estado)).toBeNull();
    const ferida = clonar(r.estado);
    ferida.jogador.vida = 30;
    const eventos: EventoDaDemo[] = [];
    expect(usarKit(ferida, eventos)).toBe(true);
    expect(ferida.jogador.vida).toBe(30 + CURA_DO_KIT);
    expect(ferida.jogador.municao.kits).toBe(antes.kits);
  });

  it("pegar o dossiê fecha a demonstração", () => {
    const r = passo(em(semVigias(), LUGAR.DOSSIE), { ...PARADA, interagir: true }, 0.05);
    expect(r.estado.fim).toBe("RESOLVIDO");
  });
});

describe("munição e recarga", () => {
  it("cada disparo mirando gasta um alfinete; pente vazio dá clique seco; R recarrega da reserva", () => {
    let e = semVigias();
    e.jogador.municao = { pente: 2, reserva: 5, laque: 0, kits: 0 };
    let r = passo(e, { ...PARADA, mirando: true, disparar: true }, 0.05);
    expect(r.estado.jogador.municao.pente).toBe(1);
    expect(r.estado.projeteis).toHaveLength(1);
    r = rodar(r.estado, { ...PARADA, mirando: true }, ARMAS.PISTOLA.recarga + 0.05);
    r = passo(r.estado, { ...PARADA, mirando: true, disparar: true }, 0.05);
    expect(r.estado.jogador.municao.pente).toBe(0);
    r = rodar(r.estado, PARADA, 0.5);
    r = passo(r.estado, { ...PARADA, mirando: true, disparar: true }, 0.05);
    expect(r.eventos).toContainEqual({ tipo: "SECO" });
    r = passo(r.estado, { ...PARADA, recarregar: true }, 0.05);
    r = rodar(r.estado, PARADA, TEMPO_DE_RECARGA + 0.1);
    expect(r.eventos).toContainEqual({ tipo: "RECARGA_FEITA" });
    expect(r.estado.jogador.municao).toMatchObject({ pente: 5, reserva: 0 });
    r = passo(r.estado, { ...PARADA, recarregar: true }, 0.05);
    expect(r.eventos).toContainEqual({ tipo: "SEM_RESERVA" });
    e = r.estado;
    expect(e.jogador.municao.pente).toBeLessThanOrEqual(PENTE);
  });

  it("o laquê sem usos também dá clique seco", () => {
    const e = semVigias();
    e.jogador.arma = "LAQUE";
    e.jogador.municao.laque = 0;
    expect(passo(e, { ...PARADA, mirando: true, disparar: true }, 0.05).eventos).toContainEqual({ tipo: "SECO" });
  });
});

describe("combate", () => {
  /** Um vigia (longe da mesa) parado de frente para a pessoa, a `d` metros. */
  function frente(d: number, modo: "PATRULHA" | "PERSEGUE" = "PATRULHA"): EstadoDaDemo {
    const e = estadoInicial();
    e.jogador.x = -2.2;
    const v = { ...e.vigias[0], x: -2.2, z: e.jogador.z - d, giro: 0, rota: [{ x: -2.2, z: e.jogador.z - d }], alvoDaRota: 0, modo };
    return { ...e, vigias: [v] };
  }

  it("o alfinete voa, acerta e fere o vigia (recua); quatro acertos abatem; abatido some depois", () => {
    let e = frente(4);
    let r = passo(e, { ...PARADA, mirando: true, disparar: true }, 0.05);
    r = rodar(r.estado, { ...PARADA, mirando: true }, 0.3);
    expect(r.eventos).toContainEqual({ tipo: "ACERTO", vigia: "V1", abatido: false });
    expect(r.estado.vigias[0].vida).toBe(100 - ARMAS.PISTOLA.dano);
    expect(r.estado.vigias[0].modo).toBe("FERIDO");
    e = clonar(r.estado);
    e.vigias[0].vida = ARMAS.PISTOLA.dano;
    e.jogador.recarga = 0;
    r = passo(e, { ...PARADA, mirando: true, disparar: true }, 0.05);
    r = rodar(r.estado, { ...PARADA, mirando: true }, 0.3);
    expect(r.estado.vigias[0].modo).toBe("ABATIDO");
    expect(rodar(r.estado, PARADA, SOME_DEPOIS + 0.2).estado.vigias[0].sumiu).toBe(true);
  });

  it("F sem mirar é golpe corpo a corpo; o leque bate mais forte que as mãos", () => {
    const maos = passo(frente(1), { ...PARADA, disparar: true }, 0.05).estado.vigias[0].vida;
    const comLeque = frente(1);
    comLeque.jogador.arma = "LEQUE";
    const leque = passo(comLeque, { ...PARADA, disparar: true }, 0.05).estado.vigias[0].vida;
    expect(maos).toBe(100 - ARMAS.MAOS.dano);
    expect(leque).toBe(100 - ARMAS.LEQUE.dano);
  });

  it("o laquê atordoa quem está no leque à frente e gasta um uso", () => {
    const e = frente(2);
    e.jogador.arma = "LAQUE";
    const r = passo(e, { ...PARADA, mirando: true, disparar: true }, 0.05);
    expect(r.estado.vigias[0].modo).toBe("ATORDOADO");
    expect(r.estado.jogador.municao.laque).toBe(2);
  });

  it("o vigia vê, persegue, golpeia (a vida cai) e, com vida zero, a pessoa é pega", () => {
    let r = rodar(frente(3), PARADA, 1.5);
    expect(r.eventos.some((x) => x.tipo === "VISTO")).toBe(true);
    expect(r.eventos).toContainEqual({ tipo: "DANO_NO_JOGADOR", dano: DANO_DO_VIGIA });
    expect(r.estado.jogador.vida).toBeLessThan(100);
    const quase = clonar(r.estado);
    quase.jogador.vida = DANO_DO_VIGIA;
    quase.jogador.folga = 0;
    r = rodar(quase, PARADA, 3);
    expect(r.estado.fim).toBe("PEGA");
    expect(r.eventos).toContainEqual({ tipo: "FIM", fim: "PEGA" });
    // fim de jogo: o passo não mexe mais em nada
    expect(passo(r.estado, { ...PARADA, mover: { x: 1, z: 0 } }, 0.05).estado).toBe(r.estado);
  });
});
