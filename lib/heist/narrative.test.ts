import { describe, expect, it } from "vitest";
import { EVIDENCE, F, FINAL_CLOCK, HOLD_CLOCK, STATEMENT_WEIGHT, addFact, addStatement, advanceClock, canResolveSocial, changeSuspicion, changeTrust, clockLabel, grantEvidence, hasEvidence, investigation, newNarrative, openObjectives, refreshObjectives } from "./narrative";
import type { EvidenceId } from "./types";

describe("estado narrativo validado do Afterparty Heist", () => {
  it("não concede prova sem o que a sustenta, nem duas vezes", () => {
    const n = newNarrative();
    expect(grantEvidence(n, "E_REPLICA", "galeria", "case")).toBeNull();                 // sem a inspeção resolvida
    addFact(n, F.INSPECTED);
    expect(grantEvidence(n, "E_REPLICA", "galeria", "case")).toMatchObject({ id: "E_REPLICA", room: "galeria", at: 30 });
    expect(grantEvidence(n, "E_REPLICA", "galeria", "case")).toBeNull();
    expect(n.evidence).toHaveLength(1);
  });

  it("a contradição exige o confronto resolvido e as versões de Brandt, Íris e de uma testemunha (Lia ou a foto)", () => {
    const n = newNarrative();
    addFact(n, F.CONTRADICTION);
    expect(grantEvidence(n, "E_CONTRADICTION", "salao", "board")).toBeNull();
    addStatement(n, "S_BRANDT"); addStatement(n, "S_IRIS");
    expect(grantEvidence(n, "E_CONTRADICTION", "salao", "board")).toBeNull();
    addStatement(n, "S_LIA");
    expect(grantEvidence(n, "E_CONTRADICTION", "salao", "board")).not.toBeNull();
  });

  it("a rota e o original dependem da folha de chamada; o original sai da luz UV ou da doca", () => {
    const n = newNarrative();
    addFact(n, F.LIGHTING);
    expect(grantEvidence(n, "E_ORIGINAL", "conservacao", "crates")).toBeNull();
    grantEvidence(n, "E_CALLSHEET", "bastidores", "desk");
    expect(grantEvidence(n, "E_ORIGINAL", "conservacao", "crates")).not.toBeNull();
    addFact(n, F.ROUTE);
    expect(grantEvidence(n, "E_ROUTE", "salao", "journal")).toBeNull();                  // falta a contradição
  });

  it("investigação completa soma 100 e objetivos se concluem pelo estado, em ordem parcial", () => {
    const n = newNarrative();
    for (const f of Object.values(F)) if (typeof f === "string") addFact(n, f);
    for (const s of Object.keys(STATEMENT_WEIGHT) as (keyof typeof STATEMENT_WEIGHT)[]) addStatement(n, s);
    for (const id of ["E_INVITE", "E_REPLICA", "E_PHOTO", "E_CONTRADICTION", "E_CALLSHEET", "E_MANIFEST", "E_ROUTE", "E_ORIGINAL", "E_SKETCH"] as EvidenceId[]) grantEvidence(n, id, "salao", "teste");
    expect(Object.keys(EVIDENCE).every((id) => hasEvidence(n, id as EvidenceId))).toBe(true);
    expect(investigation(n)).toBe(100);
    expect(refreshObjectives(n)).toEqual(["CHECKIN", "INSPECT", "CURATOR", "WITNESSES", "BACKSTAGE", "ROUTE", "CONSERVATION"]);
    expect(openObjectives(n)).toEqual(["RESOLVE"]);
  });

  it("começa só com o credenciamento aberto; depois dele, duas frentes ao mesmo tempo", () => {
    const n = newNarrative();
    expect(openObjectives(n)).toEqual(["CHECKIN"]);
    addFact(n, F.CHECKIN); refreshObjectives(n);
    expect(openObjectives(n)).toEqual(["INSPECT", "CURATOR"]);
  });

  it("Presença aumenta só os ganhos de confiança; a suspeita não desce abaixo da notoriedade", () => {
    const n = newNarrative();
    expect(changeTrust(n, "iris", 10, 20)).toBeCloseTo(12);
    expect(changeTrust(n, "iris", -10, 20)).toBeCloseTo(-10);
    n.notoriety = 10; changeSuspicion(n, 30); changeSuspicion(n, -100);
    expect(n.suspicion).toBe(10);
  });

  it("o relógio espera a jogadora às 23:20 e só chega às 23:30 depois da resolução", () => {
    const n = newNarrative();
    advanceClock(n, 500);
    expect(n.clock).toBe(HOLD_CLOCK); expect(clockLabel(n.clock)).toBe("23:20");
    n.resolution = "SOCIAL"; advanceClock(n, 500);
    expect(n.clock).toBe(FINAL_CLOCK); expect(clockLabel(n.clock)).toBe("23:30");
  });

  it("a resolução social pede as cinco provas essenciais e alguém da casa disposto a ouvir", () => {
    const n = newNarrative();
    for (const f of [F.INSPECTED, F.CONTRADICTION, F.ROUTE, F.LIGHTING]) addFact(n, f);
    for (const s of ["S_BRANDT", "S_IRIS", "S_LIA"] as const) addStatement(n, s);
    for (const id of ["E_REPLICA", "E_CONTRADICTION", "E_CALLSHEET", "E_ROUTE", "E_ORIGINAL"] as EvidenceId[]) grantEvidence(n, id, "salao", "teste");
    expect(canResolveSocial(n)).toBe(false);                                            // Ruth começa em 30
    changeTrust(n, "ruth", 15);
    expect(canResolveSocial(n)).toBe(true);
  });
});
