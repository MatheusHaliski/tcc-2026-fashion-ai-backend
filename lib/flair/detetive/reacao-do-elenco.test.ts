import { describe, expect, it } from "vitest";
import { PAPEIS } from "@/lib/flair/detetive/elenco";
import { acusadoDoAlibi, elencoDaCena, PAPEL_DO_SUSPEITO } from "@/lib/flair/detetive/reacao-do-elenco";
import { SUSPEITOS } from "@/lib/flair/detetive/types";

/**
 * Fashion Detective: o elenco reage à acusação de acordo com o desfecho que o servidor mandou (o final ou o álibi).
 * Antes da acusação, e fora da passarela, ninguém muda.
 */
const de = (pessoas: ReturnType<typeof elencoDaCena>, papel: string) => pessoas.find((p) => p.papel === papel);

describe("reação do elenco à acusação", () => {
  it("antes da acusação e fora da passarela todos ficam parados", () => {
    const passarela = elencoDaCena({ sala: "PASSARELA", final: null, cutscene: "ABERTURA:PASSARELA" });
    expect(passarela.map((p) => [p.papel, p.anim, p.gesto])).toEqual([["IOLANDA", "idle", undefined], ["BENTO", "idle", undefined]]);
    // o final só muda a cena da passarela
    const salao = elencoDaCena({ sala: "SALAO", final: "COMPLETO", cutscene: "FINAL:COMPLETO" });
    expect(salao.every((p) => p.anim === "idle" && !p.gesto)).toBe(true);
    expect(elencoDaCena({ sala: "ARQUIVO", final: null, cutscene: null })).toEqual([]);
  });

  it("acusação certa com provas: Iolanda comemora e Bento baixa a cabeça", () => {
    const cena = elencoDaCena({ sala: "PASSARELA", final: "COMPLETO", cutscene: "FINAL:COMPLETO" });
    expect(de(cena, "IOLANDA")?.anim).toBe("cheer");
    expect(de(cena, "BENTO")).toMatchObject({ anim: "idle", gesto: "lamentar" });
  });

  it("acusação certa com poucas provas: Bento nega e recua, Iolanda lamenta", () => {
    const cena = elencoDaCena({ sala: "PASSARELA", final: "PARCIAL", cutscene: "FINAL:PARCIAL" });
    expect(de(cena, "BENTO")?.gesto).toBe("recuar");
    expect(de(cena, "IOLANDA")?.gesto).toBe("lamentar");
  });

  it("segunda acusação errada: Iolanda aponta quem foi", () => {
    const cena = elencoDaCena({ sala: "PASSARELA", final: "ERRADO_REVELA", cutscene: "FINAL:ERRADO_REVELA" });
    expect(de(cena, "IOLANDA")?.anim).toBe("point");
    expect(de(cena, "BENTO")?.gesto).toBe("lamentar");
  });

  it("primeira acusação errada: o acusado entra em cena com o álibi e os outros reagem, sem apontar o culpado", () => {
    const cena = elencoDaCena({ sala: "PASSARELA", final: null, cutscene: "ALIBI:4" });
    expect(cena.map((p) => p.papel)).toEqual(["IOLANDA", "BENTO", "RAFA"]);
    expect(de(cena, "RAFA")).toMatchObject({ anim: "talk", gesto: "defender" });
    expect(de(cena, "IOLANDA")?.gesto).toBe("pensar");
    // Bento reage como qualquer um do salão: nada nele diz que foi ele
    expect(de(cena, "BENTO")).toMatchObject({ anim: "look" });
    expect(de(cena, "BENTO")?.gesto).toBeUndefined();
    // ninguém fica em cima de ninguém
    const lugares = new Set(cena.map((p) => `${p.x}:${p.z}`));
    expect(lugares.size).toBe(cena.length);
  });

  it("todo suspeito do quadro tem um papel com roupa, e o álibi só vale com número", () => {
    for (const n of SUSPEITOS) expect(PAPEIS).toContain(PAPEL_DO_SUSPEITO[n]);
    expect(acusadoDoAlibi("ALIBI:7")).toBe(7);
    expect(acusadoDoAlibi("FINAL:COMPLETO")).toBeNull();
    expect(acusadoDoAlibi(null)).toBeNull();
    // álibi de um número fora do quadro não põe ninguém em cena
    expect(elencoDaCena({ sala: "PASSARELA", final: null, cutscene: "ALIBI:1" }).map((p) => p.papel)).toEqual(["IOLANDA", "BENTO"]);
  });
});
