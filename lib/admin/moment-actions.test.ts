import { describe, expect, it } from "vitest";
import { momentActions, momentDateOptions } from "./moment-actions";

describe("Administração › Momentos", () => {
  it("só oferece as ações que cabem no estado", () => {
    expect(momentActions("ACTIVE", false)).toEqual(["feature", "end", "cancel"]);
    expect(momentActions("ACTIVE", true)).toEqual(["unfeature", "end", "cancel"]);
    expect(momentActions("DRAFT", false)).toEqual(["schedule", "archive"]);
    expect(momentActions("ENDED", false)).toEqual(["archive"]);
    expect(momentActions("ACTIVE", false)).not.toContain("draft");
  });

  it("a data sai no fuso do Momento, não no do navegador", () => {
    const end = new Date("2026-11-26T01:59:00Z"); // 25/11 22:59 em São Paulo
    const text = new Intl.DateTimeFormat("pt-BR", momentDateOptions("America/Sao_Paulo")).format(end);
    expect(text).toContain("25 de nov. de 2026");
    expect(new Intl.DateTimeFormat("pt-BR", momentDateOptions("Asia/Tokyo")).format(end)).toContain("26 de nov. de 2026");
    expect(momentDateOptions("Fuso/Invalido")).toEqual({ dateStyle: "medium", timeStyle: "short" });
  });
});
