import { describe, expect, it } from "vitest";
import { INFO_DEFAULT, infoGridOf, infoGridView, toggleInfoField } from "./info-grid";

describe("cards · grade de informações", () => {
  it("sem configuração: só os campos mínimos, 2 colunas, células em caixa, com rótulo; conservação fica de fora", () => {
    expect(infoGridOf(undefined, "piece")).toEqual({ fields: ["brand", "color", "category", "size"], columns: 2, cells: "boxed", labels: true, align: "start", density: "normal" });
    expect(infoGridOf({}, "look").fields).toEqual(["pieces", "brand", "color", "occasion"]);
    expect(INFO_DEFAULT.piece).not.toContain("condition");
  });
  it("respeita a escolha gravada, na ordem do catálogo, e ignora o que não conhece ou não é do tipo do card", () => {
    const v = infoGridView({ fields: ["condition", "pieces", "brand", "xyz"], columns: 3, cells: "pill", labels: false, align: "center", density: "compact" }, "piece");
    expect(v).toEqual({ fields: ["brand", "condition"], columns: 3, cells: "pill", labels: false, align: "center", density: "compact" });
    expect(infoGridView({ fields: [], columns: 9, cells: "x" }, "look")).toMatchObject({ fields: [], columns: 2, cells: "boxed" });
  });
  it("ligar e desligar um campo mantém a ordem", () => {
    const base = infoGridView(null, "piece");
    expect(toggleInfoField(base, "piece", "condition")).toEqual(["brand", "color", "category", "size", "condition"]);
    expect(toggleInfoField(base, "piece", "color")).toEqual(["brand", "category", "size"]);
  });
});
