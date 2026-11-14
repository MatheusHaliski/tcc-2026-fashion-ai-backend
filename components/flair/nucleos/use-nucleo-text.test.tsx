// @vitest-environment jsdom
/**
 * Regressão da auditoria: os jogos FLAIR 3D mostravam códigos crus do servidor ("FAMILIA_AMARELO",
 * "FORCA_SEGUNDO_TEMPO: 23") e pontos sem arredondar ("13.333333333333334 pts").
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp } from "@/test-utils/render";
import ptBR from "@/lib/i18n/messages/pt-BR.json";
import { useNucleoText } from "./use-nucleo-text";

afterEach(cleanup);

type Tx = ReturnType<typeof useNucleoText>;
function texto(): Tx {
  let tx: Tx | null = null;
  const Probe = () => { tx = useNucleoText(); return null; };
  renderApp(<Probe />);
  return tx!;
}

const NUCLEOS = join(process.cwd(), "fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos");
const fontes = readdirSync(NUCLEOS).filter((f) => f.endsWith(".java")).map((f) => readFileSync(join(NUCLEOS, f), "utf8")).join("\n");
const codigos = (re: RegExp) => [...new Set([...fontes.matchAll(re)].map((m) => m[1]))];
const catalogo = ptBR as Record<string, string>;

describe("textos dos núcleos FLAIR 3D", () => {
  it("todo código de Evento que o servidor emite tem frase", () => {
    const eventos = [...codigos(/new Evento\("([A-Z0-9_]+)"/g), "ESPECIAL"];
    expect(eventos.length).toBeGreaterThan(25);
    expect(eventos.filter((c) => !catalogo[`flair3d.ui.evento.${c}`])).toEqual([]);
  });

  it("todo código de Efeito tem frase; os motivos têm explicação", () => {
    const efeitos = codigos(/new Efeito\("([A-Z0-9_]+)",/g);
    expect(efeitos.filter((c) => !catalogo[`flair3d.ui.efeito.${c}`])).toEqual([]);
    const motivos = [...codigos(/Efeito\.motivo\("([A-Z0-9_]+)"\)/g), "SEM_BONUS"];
    expect(motivos.filter((c) => !catalogo[`flair3d.ui.fx.reason.${c}`])).toEqual([]);
  });

  it("família de cor aparece pelo nome, nunca \"FAMILIA_AMARELO\"", () => {
    const tx = texto();
    expect(tx.evento({ codigo: "FAMILIA", valor: "FAMILIA_AMARELO" })).toBe("Família mais forte no espelho: Amarelo");
    expect(tx.efeito({ codigo: "FAMILIA_LARANJA", valor: 1, motivo: false })).toBe("família laranja");
    expect(tx.evento({ codigo: "FORCA_SEGUNDO_TEMPO", valor: 23 })).toBe("Força do seu time no segundo tempo: 23");
  });

  it("código sem frase sai em letras comuns e os números com no máximo duas casas", () => {
    const tx = texto();
    expect(tx.evento({ codigo: "CODIGO_NOVO", valor: 13.333333333333334 })).toBe("Codigo novo: 13,33");
    expect(tx.evento({ codigo: "PONTOS_DO_SALAO", valor: 13.333333333333334 })).toBe("Pontos do salão: 13,33");
    expect(tx.pontos(13.333333333333334)).toBe("13,33 pts");
    expect(tx.pontosTotal(73.33333)).toBe("73,33 pontos");
  });
});

/** Regressão da auditoria: o Fashion Sports dizia "Futebol de 5" depois de a pessoa escolher outra modalidade. */
describe("Fashion Sports — a modalidade escolhida aparece em todo texto", () => {
  it("objetivo, cenário e personagens falam da modalidade; sem escolha (ou futebol) fica o texto do futebol de 5", () => {
    const tx = texto();
    expect(tx.daVariante("FASHION_SPORTS", "objective", "BASQUETE")).toBe("Basquete 3×3: um uniforme para o seu time contra o time-padrão.");
    expect(tx.daVariante("FASHION_SPORTS", "scene", "SKATE")).toBe("Pista de skate.");
    expect(tx.daVariante("FASHION_SPORTS", "characters", "TENIS")).not.toMatch(/5 adversários/);
    expect(tx.daVariante("FASHION_SPORTS", "objective", "FUTEBOL")).toMatch(/^Futebol de 5/);
    expect(tx.daVariante("FASHION_SPORTS", "objective", null)).toMatch(/^Futebol de 5/);
    for (const m of ["BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE"]) {
      expect(tx.daVariante("FASHION_SPORTS", "objective", m)).not.toMatch(/Futebol/i);
      expect(tx.daVariante("FASHION_SPORTS", "scene", m)).not.toMatch(/futebol/i);
    }
  });

  it("a cena da ação fala em jogada e ponto fora do futebol; o evento MODALIDADE diz o esporte", async () => {
    const { textoDoPasso } = await import("./nucleo-action-text");
    const tx = texto();
    const especial = { fonte: "especial" as const, codigo: "VITORIA", ok: true, pontos: 100, vaga: null };
    expect(textoDoPasso(tx, "FASHION_SPORTS", especial, "BASQUETE")).toBe("Ponto e o time comemora");
    expect(textoDoPasso(tx, "FASHION_SPORTS", especial, "FUTEBOL")).toBe("Gol e o time comemora");
    expect(textoDoPasso(tx, "FASHION_SPORTS", especial)).toBe("Gol e o time comemora");
    expect(tx.evento({ codigo: "MODALIDADE", valor: "BASQUETE" })).toBe("Modalidade: Basquete 3×3 (placar em pontos)");
  });
});
