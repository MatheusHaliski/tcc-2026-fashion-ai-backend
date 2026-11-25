import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acoesNovas, atributoEmAlta, LOOK_NEUTRO, lookNaTela, mudancas } from "@/lib/flair/recursos/perfil";
import { ATRIBUTOS, type PerfilDaPeca } from "@/lib/flair/recursos/types";

/** Os casos de referência do servidor (Flair3dRecursoTabelaTest): a tela lê exatamente o que ele calcula. */
const golden = JSON.parse(readFileSync(join(process.cwd(), "docs/flair/flair-3d/fixtures/peca-recurso-golden.json"), "utf8")) as {
  vaga: string;
  esperado: Omit<PerfilDaPeca, "vaga">;
}[];
const perfis = golden.map((c, i) => ({ id: `c${i}`, perfil: { vaga: c.vaga, ...c.esperado } as PerfilDaPeca }));
const de = (id: string) => perfis.find((p) => p.id === id)?.perfil;

describe("peça-recurso na tela", () => {
  it("os perfis de referência só usam atributos, recursos e ações conhecidos", () => {
    for (const { perfil } of perfis) {
      expect(Object.keys(perfil.atributos).every((a) => (ATRIBUTOS as readonly string[]).includes(a))).toBe(true);
      expect(perfil.usos).toBeGreaterThan(0);
    }
  });

  it("vestir o tênis sobe a agilidade e destrava correr; tirar volta ao neutro", () => {
    const tenis = lookNaTela({ CAL: "c0" }, de);
    expect(tenis.atributos.AGILIDADE).toBe(90);
    expect(tenis.acoes).toEqual(["CORRER"]);
    const m = mudancas(LOOK_NEUTRO, tenis);
    expect(m[0]).toEqual({ atributo: "AGILIDADE", delta: 40 });
    expect(m).toHaveLength(2);
    expect(acoesNovas(LOOK_NEUTRO, tenis)).toEqual(["CORRER"]);
    expect(atributoEmAlta(m)).toBe("AGILIDADE");
    expect(lookNaTela({}, de)).toBe(LOOK_NEUTRO);
  });

  it("o look é o neutro mais a média das peças, de 0 a 100, e junta as ações", () => {
    const look = lookNaTela({ CAL: "c0", SUP: "c2" }, de);
    // agilidade: (40 + 0) / 2 = 20; resistência: (0 + 26) / 2 = 13
    expect(look.atributos.AGILIDADE).toBe(70);
    expect(look.atributos.RESISTENCIA).toBe(63);
    expect(look.acoes).toEqual(["CORRER", "BLOQUEAR"]);
    expect(Object.values(look.atributos).every((v) => v >= 0 && v <= 100)).toBe(true);
    expect(lookNaTela({ CAL: "sem-perfil" }, de)).toBe(LOOK_NEUTRO);
  });

  it("trocar o tênis pelo salto: carisma sobe, agilidade desce e o salto destrava convencer", () => {
    const antes = lookNaTela({ CAL: "c0" }, de);
    const depois = lookNaTela({ CAL: "c1" }, de);
    const m = mudancas(antes, depois);
    expect(m.map((x) => x.atributo)).toEqual(["AGILIDADE", "CARISMA"]);
    expect(m[0].delta).toBeLessThan(0);
    expect(acoesNovas(antes, depois)).toEqual(["CONVENCER"]);
    expect(atributoEmAlta(m)).toBe("CARISMA");
  });
});

describe("uso da peça como recurso na tela", async () => {
  const { somar, usoOtimista, usosRestantes } = await import("@/lib/flair/recursos/uso");
  const inicio = { recursos: { VIDA: 60, ENERGIA: 40, FOCO: 40, MOEDAS: 0 }, usados: {} };
  const blazer = de("c2")!;

  it("o medidor sobe na hora com a quantidade do perfil do servidor e a carta gasta um uso", () => {
    const depois = usoOtimista(inicio, "c2", blazer);
    expect(depois.recursos.VIDA).toBe(85);
    expect(depois.uso).toEqual({ carta: "c2", recurso: "VIDA", quantidade: 25, antes: 60, depois: 85 });
    expect(usosRestantes(inicio, "c2", blazer)).toBe(1);
    expect(usosRestantes(depois, "c2", blazer)).toBe(0);
    expect(inicio.recursos.VIDA).toBe(60);
  });

  it("vida, energia e foco param em 100; moedas não têm teto", () => {
    expect(somar("VIDA", 90, 25)).toBe(100);
    expect(somar("MOEDAS", 90, 25)).toBe(115);
    expect(somar("FOCO", 0, -5)).toBe(0);
  });
});

describe("jogos de zonas: o perfil vem na prévia", async () => {
  const { lookDaPrevia } = await import("@/lib/flair/recursos/perfil");
  it("lê o PERFIL_DO_LOOK da prévia; sem ele, nada", () => {
    const look = lookDaPrevia([{ codigo: "PERFIL_DO_LOOK", valor: { atributos: { FORCA: 58, AGILIDADE: 50 }, acoes: ["REFLETIR", "VOAR"] } }]);
    expect(look?.atributos.FORCA).toBe(58);
    expect(look?.atributos.CARISMA).toBe(50);
    expect(look?.acoes).toEqual(["REFLETIR"]);
    expect(lookDaPrevia([{ codigo: "TENTATIVA", valor: 1 }])).toBeNull();
    expect(lookDaPrevia(undefined)).toBeNull();
  });
});
