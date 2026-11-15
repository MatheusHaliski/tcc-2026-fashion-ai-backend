import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { amostrar, cruzamentos, laco, pontoEm, quebrada, suave } from "@/lib/flair/cenas/caminho";
import { CENA_DO_CENARIO, CENA_DO_ELENCO, CENA_RESERVA, CENAS, cenaDoCenario, cenaDoElenco } from "@/lib/flair/cenas/catalogo";
import { FORMAS } from "@/lib/flair/cenas/catalogo-formas";
import { alfaEm, girosEm, nivelEm, preparar, pulsosEm, viajantesEm } from "@/lib/flair/cenas/motor";
import { adiantoDoFloreio, brilhoDoFloreio, FLOREIO_S, tempoDaCena } from "@/lib/flair/cenas/relogio";
import { enderecoDaMarca } from "@/lib/flair/cenas/sprites";
import { trechosNoNivel } from "@/lib/flair/cenas/tubos";
import { ELENCO_CODIGOS } from "@/lib/flair/elencos/types";
import { SCENES } from "@/lib/flair/cbc";
import en from "@/lib/i18n/messages/en.json";
import es from "@/lib/i18n/messages/es.json";
import pt from "@/lib/i18n/messages/pt-BR.json";

/** Motor das cenas dinâmicas: geometria dos trilhos, elenco sempre no trilho, laço sem emenda, pontes e floreio. */
const cenas = Object.values(CENAS);

/** Distância do ponto ao trilho amostrado (ao segmento mais próximo). */
function longe(a: ReturnType<typeof amostrar>, x: number, y: number): number {
  let menor = Infinity;
  for (let i = 0; i + 1 < a.acumulado.length; i++) {
    const [x1, y1, x2, y2] = [a.pontos[i * 2], a.pontos[i * 2 + 1], a.pontos[i * 2 + 2], a.pontos[i * 2 + 3]];
    const comprimento = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const k = comprimento > 0 ? Math.min(1, Math.max(0, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / comprimento)) : 0;
    menor = Math.min(menor, Math.hypot(x1 + k * (x2 - x1) - x, y1 + k * (y2 - y1) - y));
  }
  return menor;
}

describe("caminho", () => {
  it("amostra retas e curvas com o comprimento certo e acha o ponto em qualquer fração", () => {
    const reta = amostrar("M0 0L30 0L30 40");
    expect(reta.total).toBeCloseTo(70, 3);
    expect(pontoEm(reta, 0.5).x).toBeCloseTo(30, 4);
    expect(pontoEm(reta, 0.5).y).toBeCloseTo(5, 4);
    const circulo = amostrar(laco(50, 50, 20, 20));
    expect(circulo.fechado).toBe(true);
    expect(circulo.total).toBeGreaterThan(2 * Math.PI * 20 * 0.995);
    expect(circulo.total).toBeLessThan(2 * Math.PI * 20 * 1.005);
    // em caminho fechado a fração dá a volta: 1,25 é o mesmo ponto que 0,25
    expect(pontoEm(circulo, 1.25).x).toBeCloseTo(pontoEm(circulo, 0.25).x, 4);
    // em caminho aberto fica preso entre as pontas
    expect(pontoEm(reta, 7)).toMatchObject({ x: 30, y: 40 });
  });

  it("curva suave passa pelos pontos; linha quebrada arredonda as quinas; cruzamentos são achados", () => {
    const pts: [number, number][] = [[0, 0], [20, 10], [40, 0], [60, 10]];
    const curva = amostrar(suave(pts));
    for (const [x, y] of pts) expect(longe(curva, x, y)).toBeLessThan(0.7);
    const quina = amostrar(quebrada([[0, 0], [20, 20], [40, 0]], 3));
    expect(longe(quina, 20, 20)).toBeGreaterThan(0.5);
    expect(longe(quina, 10, 10)).toBeLessThan(0.7);
    const x = cruzamentos(amostrar("M0 0L40 40"), amostrar("M0 40L40 0"));
    expect(x).toHaveLength(1);
    expect(x[0]).toBeCloseTo(0.5, 2);
  });
});

describe("todas as cenas do catálogo", () => {
  it("há pelo menos oito cenas diferentes, e cada elenco e cada cenário dos desafios tem a sua", () => {
    expect(cenas.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cenas.map((c) => c.id)).size).toBe(cenas.length);
    for (const codigo of ELENCO_CODIGOS) expect(CENA_DO_ELENCO[codigo], codigo).toBeTruthy();
    expect(new Set(ELENCO_CODIGOS.map((c) => cenaDoElenco(c).id)).size).toBe(ELENCO_CODIGOS.length);
    for (const cenario of Object.keys(SCENES)) expect(CENA_DO_CENARIO[cenario], cenario).toBeTruthy();
    // toda cena tem nome e descrição (o texto lido por leitores de tela) nos três idiomas
    for (const cena of cenas) {
      for (const catalogo of [pt, en, es] as Record<string, string>[]) {
        expect(catalogo[`flair3d.cenas.${cena.id}.name`], cena.id).toBeTruthy();
        expect(catalogo[`flair3d.cenas.${cena.id}.description`], cena.id).toBeTruthy();
      }
    }
    expect(cenaDoCenario("cenario-novo")).toBe(CENA_RESERVA);
    expect(cenaDoElenco("ELENCO_NOVO")).toBe(CENA_RESERVA);
  });

  it.each(cenas.map((c) => [c.id, c] as const))("%s: o elenco anda sempre em cima do trilho, com formas que existem", (_id, cena) => {
    const p = preparar(cena);
    expect(cena.elenco.length).toBeGreaterThanOrEqual(2);
    for (const t of [0, 3.7, cena.quadro, 61.3, 1234.56]) {
      const elenco = viajantesEm(p, t);
      expect(elenco.length).toBe(cena.elenco.reduce((n, g) => n + g.n, 0));
      for (const v of elenco) {
        expect(longe(p.amostras.get(v.trilho)!, v.x, v.y - v.desvio), `${v.trilho} em t=${t}`).toBeLessThan(0.05);
        expect(v.alfa).toBeGreaterThanOrEqual(0);
        expect(v.alfa).toBeLessThanOrEqual(1);
      }
    }
    for (const g of cena.elenco) {
      expect(p.amostras.has(g.trilho), g.trilho).toBe(true);
      for (const forma of g.formas) {
        const marca = enderecoDaMarca(forma);
        if (marca) expect(existsSync(join(process.cwd(), "public", marca)), marca).toBe(true);
        else expect(FORMAS[forma], forma).toBeTruthy();
      }
    }
    for (const g of cena.giros ?? []) expect(FORMAS[g.forma], g.forma).toBeTruthy();
  });

  it.each(cenas.map((c) => [c.id, c] as const))("%s: o movimento é contínuo e o laço não tem emenda", (_id, cena) => {
    const p = preparar(cena);
    cena.elenco.forEach((g, gi) => {
      const meu = (t: number) => viajantesEm(p, t).filter((v) => v.trilho === g.trilho && cena.elenco.indexOf(g) === gi);
      // uma volta inteira depois, cada viajante está exatamente onde estava
      const [antes, depois] = [meu(2.5), meu(2.5 + g.periodo)];
      antes.forEach((v, i) => {
        expect(depois[i].x).toBeCloseTo(v.x, 2);
        expect(depois[i].y).toBeCloseTo(v.y, 2);
      });
      // quadro a quadro ninguém salta: ou anda pouco, ou está invisível (a ponta de um trilho aberto)
      for (let k = 0; k < 600; k++) {
        const t = (k * g.periodo) / 600;
        const [a, b] = [meu(t), meu(t + 1 / 60)];
        a.forEach((v, i) => {
          const passo = Math.hypot(b[i].x - v.x, b[i].y - v.y);
          if (passo > 1.5) expect(Math.max(v.alfa, b[i].alfa), `${g.trilho} salta em t=${t}`).toBeLessThan(0.02);
        });
      }
    });
    // os grupos não andam todos no mesmo ritmo
    expect(new Set(cena.elenco.map((g) => g.periodo)).size).toBeGreaterThan(1);
  });

  it("trilho aberto: o viajante surge e some em fade; fechado: sempre inteiro", () => {
    const aberto = amostrar("M0 0L100 0");
    expect(alfaEm(aberto, 0)).toBe(0);
    expect(alfaEm(aberto, 1)).toBe(0);
    expect(alfaEm(aberto, 0.5)).toBe(1);
    expect(alfaEm(aberto, 0.02)).toBeGreaterThan(0);
    expect(alfaEm(aberto, 0.02)).toBeLessThan(1);
    expect(alfaEm(amostrar(laco(0, 0, 5, 5)), 0)).toBe(1);
  });

  it("pontes: onde um túnel passa por cima de outro, o trecho sobe um nível e o viajante vai junto", () => {
    const cena = CENAS["tuneis-de-cor"];
    const p = preparar(cena);
    expect(p.niveis).toBe(2);
    const rosa = p.trilhos.get("rosa")!;
    expect(rosa.pontes!.length).toBeGreaterThanOrEqual(1);
    const [de, ate] = rosa.pontes![0];
    expect(nivelEm(rosa, (de + ate) / 2)).toBe(1);
    expect(nivelEm(rosa, Math.max(0, de - 0.02))).toBe(0);
    // os trechos dos dois níveis juntos cobrem o trilho inteiro, sem sobra
    const soma = [...trechosNoNivel(rosa, 0), ...trechosNoNivel(rosa, 1)].reduce((s, [a, b]) => s + (b - a), 0);
    expect(soma).toBeCloseTo(1, 6);
    expect(viajantesEm(p, 0).every((v) => v.z === nivelEm(p.trilhos.get(v.trilho)!, v.u))).toBe(true);
  });

  it("pulsos de luz ficam dentro do trilho e os elementos que giram dão a volta sem salto", () => {
    for (const cena of cenas) {
      const p = preparar(cena);
      for (const pulso of pulsosEm(p, 12.34)) {
        expect(pulso.de).toBeGreaterThanOrEqual(0);
        expect(pulso.ate).toBeLessThanOrEqual(1);
        expect(pulso.ate).toBeGreaterThan(pulso.de);
      }
      (cena.giros ?? []).forEach((g, i) => {
        expect(Math.abs(girosEm(p, 5)[i] - girosEm(p, 5 + g.periodo)[i])).toBeLessThan(1e-6);
      });
    }
  });
});

describe("base de tempo e floreio", () => {
  it("o floreio adianta o tempo sem salto: começa e termina na velocidade normal", () => {
    expect(adiantoDoFloreio(0)).toBe(0);
    expect(adiantoDoFloreio(-3)).toBe(0);
    let antes = 0;
    for (let tau = 0.01; tau <= FLOREIO_S; tau += 0.01) {
      const agora = adiantoDoFloreio(tau);
      expect(agora).toBeGreaterThanOrEqual(antes);
      expect(agora - antes).toBeLessThan(0.03);
      antes = agora;
    }
    // no começo e no fim o adianto quase não cresce (a velocidade volta a 1); no meio o elenco acelera
    expect(adiantoDoFloreio(0.05)).toBeLessThan(0.002);
    expect(adiantoDoFloreio(FLOREIO_S + 5)).toBeCloseTo(adiantoDoFloreio(FLOREIO_S), 6);
    expect(adiantoDoFloreio(FLOREIO_S)).toBeGreaterThan(2);
    expect(tempoDaCena(100, null)).toBe(100);
    expect(tempoDaCena(100, 99)).toBeGreaterThan(100);
  });

  it("os túneis acendem no floreio e apagam no fim", () => {
    expect(brilhoDoFloreio(0)).toBe(0);
    expect(brilhoDoFloreio(FLOREIO_S)).toBe(0);
    const pico = Math.max(...Array.from({ length: 100 }, (_, i) => brilhoDoFloreio((i / 100) * FLOREIO_S)));
    expect(pico).toBeGreaterThan(0.95);
  });
});
