// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { gravarRascunho, lerRascunho } from "./rascunho";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("FLAIR CBC › elenco em montagem", () => {
  it("guarda e devolve as cartas por elenco; vazio apaga", () => {
    gravarRascunho("primeiro-elenco", { TOP: "c1", BOTTOM: "c2" });
    expect(lerRascunho("primeiro-elenco")).toEqual({ TOP: "c1", BOTTOM: "c2" });
    expect(lerRascunho("outro")).toEqual({});
    gravarRascunho("primeiro-elenco", {});
    expect(lerRascunho("primeiro-elenco")).toEqual({});
  });

  it("dado estragado ou armazenamento bloqueado não quebra", () => {
    localStorage.setItem("fai:cbc:rascunho:x", "{nao-json");
    expect(lerRascunho("x")).toEqual({});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => gravarRascunho("x", { TOP: "c1" })).not.toThrow();
  });
});
