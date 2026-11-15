import { describe, expect, it } from "vitest";
import { CENAS } from "@/lib/flair/cenas/catalogo";
import { criarCtxFalso, fabricaDeTelas } from "@/lib/flair/cenas/ctx-falso";
import { criarPalco } from "@/lib/flair/cenas/palco";
import { alvoDaCelula, aproximar, assentada, comporPecas, PARADA, prepararRecortes, type EstadoDaCelula } from "@/lib/flair/cenas/pecas";
import { FLOREIO_S } from "@/lib/flair/cenas/relogio";
import type { PecaEstado } from "@/lib/flair/elencos/board";

/**
 * O desenho é o quebra-cabeça: cada peça é um recorte do mesmo quadro; a mola leva a peça ao lugar; a arte completa
 * dispara o floreio; com movimento reduzido o quadro é parado e as peças mudam de lugar na hora.
 */
const CENA = CENAS["tuneis-de-cor"];

/** Posição em que cada carimbo do elenco foi pintado na tela (o que muda de um quadro para o outro). */
function carimbos(falso: ReturnType<typeof criarCtxFalso>): string {
  return falso.chamadas.filter((c) => c.metodo === "setTransform").map((c) => (c.args as number[]).map((n) => n.toFixed(2)).join(",")).join(";");
}

describe("peças como janelas do mesmo quadro", () => {
  it("um recorte por peça posta, todas copiando o mesmo quadro; peça que falta não mostra a cena", () => {
    const tela = criarCtxFalso();
    const quadro = { width: 320, height: 200 } as unknown as CanvasImageSource;
    const r = prepararRecortes(5);
    expect(r.recortes).toHaveLength(6);
    const estados: EstadoDaCelula[] = ["verde", "laranja", "vermelha", "chegando", "coberta", "moldura"];
    comporPecas(tela.ctx, quadro, r, { estados, folgas: estados.map((e, i) => alvoDaCelula(i, e)), corte: 1 }, 320);
    // cinco janelas (quatro peças postas e a moldura); a coberta fica só no contorno tracejado
    expect(tela.conta("clip")).toBe(5);
    const copias = tela.chamadas.filter((c) => c.metodo === "drawImage");
    expect(copias).toHaveLength(5);
    expect(copias.every((c) => c.args[0] === quadro)).toBe(true);
    // todas copiam o quadro inteiro na mesma posição: a emenda entre duas peças encaixadas não existe
    expect(new Set(copias.map((c) => c.args.slice(1).join(","))).size).toBe(1);
    expect(tela.chamadas.filter((c) => c.metodo === "setLineDash" && (c.args[0] as number[]).length > 0)).toHaveLength(1);
    // a peça encaixada não sai do lugar; a solta é deslocada e girada com a janela
    const giros = tela.chamadas.filter((c) => c.metodo === "rotate").map((c) => c.args[0] as number);
    expect(giros.filter((g) => g === 0).length).toBe(2);
    expect(giros.filter((g) => g !== 0).length).toBe(3);
  });

  it("a mola leva a peça até o alvo, passa um pouco do ponto e assenta", () => {
    let f = { ...PARADA, dx: 12, dy: -8, giro: 14 };
    const alvo = { dx: 0, dy: 0, giro: 0 };
    let passou = false;
    for (let i = 0; i < 240; i++) {
      f = aproximar(f, alvo, 1 / 60);
      if (f.dx < -0.01) passou = true;
    }
    expect(passou).toBe(true);
    expect(assentada(f, alvo)).toBe(true);
    expect(assentada({ ...PARADA, dx: 3 }, alvo)).toBe(false);
    // quadro atrasado (aba que voltou): o passo é limitado e a mola não dispara
    expect(Math.abs(aproximar({ ...PARADA, dx: 10 }, alvo, 5).dx)).toBeLessThan(10);
  });
});

describe("palco", () => {
  const novo = () => {
    const f = fabricaDeTelas();
    return { palco: criarPalco(CENA, f.criar, 320)!, telas: f.telas };
  };

  it("base de tempo única: dois palcos da mesma cena pintam o mesmo quadro no mesmo instante", () => {
    const [a, b] = [novo().palco, novo().palco];
    const [ta, tb] = [criarCtxFalso(), criarCtxFalso()];
    a.pintar(ta.ctx, 42.5, false);
    b.pintar(tb.ctx, 42.5, false);
    expect(carimbos(ta)).toBe(carimbos(tb));
    expect(carimbos(ta).length).toBeGreaterThan(100);
    const depois = criarCtxFalso();
    a.pintar(depois.ctx, 43.5, false);
    expect(carimbos(depois)).not.toBe(carimbos(ta));
  });

  it("movimento reduzido: o quadro parado é sempre o mesmo e a peça muda de lugar na hora", () => {
    const { palco } = novo();
    const [t1, t2] = [criarCtxFalso(), criarCtxFalso()];
    palco.definir(null, false, 10, true);
    palco.pintar(t1.ctx, 10, true);
    palco.pintar(t2.ctx, 99, true);
    expect(carimbos(t1)).toBe(carimbos(t2));
    const pecas: PecaEstado[] = ["coberta", "coberta", "coberta"];
    palco.definir(pecas, false, 10, true);
    palco.definir(["verde", "coberta", "coberta"], false, 11, true);
    expect(palco.emMovimento(11)).toBe(false);
    // a arte completa, parada, não dispara o floreio
    palco.definir(["verde", "verde", "verde"], true, 12, true);
    expect(palco.emMovimento(12)).toBe(false);
  });

  it("a peça nova entra de fora e encaixa; a arte completa acende, acelera e assenta", () => {
    const { palco } = novo();
    const tela = criarCtxFalso();
    palco.definir(["coberta", "coberta", "coberta"], false, 0, false);
    expect(palco.emMovimento(0)).toBe(false);
    palco.definir(["verde", "coberta", "coberta"], false, 0, false);
    expect(palco.emMovimento(0)).toBe(true);
    let relogio = 0;
    for (let i = 0; i < 300; i++) palco.pintar(tela.ctx, (relogio += 1 / 60), false);
    expect(palco.emMovimento(relogio)).toBe(false);
    // enquanto há peça faltando, a cena é pintada por janelas
    tela.limpar();
    palco.pintar(tela.ctx, (relogio += 1 / 60), false);
    expect(tela.conta("clip")).toBeGreaterThanOrEqual(2);
    // completa: floreio em curso; no fim, a cena inteira sem recorte nem linha de corte
    palco.definir(["verde", "verde", "verde"], true, relogio, false);
    expect(palco.emMovimento(relogio + 0.1)).toBe(true);
    const fim = relogio + FLOREIO_S + 0.2;
    while (relogio < fim) palco.pintar(tela.ctx, (relogio += 1 / 60), false);
    expect(palco.emMovimento(relogio)).toBe(false);
    tela.limpar();
    palco.pintar(tela.ctx, relogio + 1 / 60, false);
    expect(tela.conta("clip")).toBe(0);
  });

  it("no floreio os túneis acendem (a tela de brilho é somada) e o elenco anda mais que no tempo normal", () => {
    const [normal, festa] = [novo(), novo()];
    const [tn, tf] = [criarCtxFalso(), criarCtxFalso()];
    for (const p of [normal.palco, festa.palco]) p.definir(null, false, 0, false);
    festa.palco.definir(null, true, 100, false);
    normal.palco.pintar(tn.ctx, 100 + FLOREIO_S / 2, false);
    festa.palco.pintar(tf.ctx, 100 + FLOREIO_S / 2, false);
    expect(carimbos(tf)).not.toBe(carimbos(tn));
    // a camada dos túneis acesos (a tela criada logo depois das camadas da cena) só é somada no floreio
    const acesa = (telas: typeof festa.telas, t: typeof tf) => t.chamadas.some((c) => c.metodo === "drawImage" && c.args[0] === telas[3].canvas);
    expect(acesa(festa.telas, tf)).toBe(true);
    expect(acesa(normal.telas, tn)).toBe(false);
  });

  it("sem canvas (criar devolve null) não há palco", () => {
    expect(criarPalco(CENA, () => null, 320)).toBeNull();
  });
});
