// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES, hasMessage, missingKeys, resolveMessage, tr, translate, untranslatedKeys } from "./core";
import { setCurrentLocale } from "./state";

afterEach(() => { setCurrentLocale("pt-BR"); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("catálogo de mensagens", () => {
  it("hasMessage diz se a chave existe no idioma base (pseudo usa pt-BR)", () => {
    expect(hasMessage("pt-BR", "auraHype.title")).toBe(true);
    expect(hasMessage("qps-ploc", "auraHype.title")).toBe(true);
    expect(hasMessage("en", "chave.que.nao.existe")).toBe(false);
  });

  it("chave inexistente volta a própria chave, é registrada e avisa uma única vez", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveMessage("en", "teste.sem.texto")).toBe("teste.sem.texto");
    expect(resolveMessage("en", "teste.sem.texto")).toBe("teste.sem.texto");
    expect(missingKeys.has("teste.sem.texto")).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("chave sem texto");
    const qa = (window as unknown as { __faiI18n: { missing: string[] } }).__faiI18n;
    expect(qa.missing).toContain("teste.sem.texto");
  });

  it("sem tradução no idioma escolhido cai no pt-BR e marca como não traduzida", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const saved = MESSAGES.en["auraHype.hint"];
    delete MESSAGES.en["auraHype.hint"];
    try {
      expect(resolveMessage("en", "auraHype.hint")).toBe(MESSAGES["pt-BR"]["auraHype.hint"]);
      expect(untranslatedKeys.has("auraHype.hint")).toBe(true);
      expect(warn.mock.calls.some((c) => String(c[0]).includes("chave sem tradução"))).toBe(true);
    } finally {
      MESSAGES.en["auraHype.hint"] = saved;
    }
  });

  it("chave faltando também em pt-BR não registra no window quando não há window", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("window", undefined);
    expect(resolveMessage("pt-BR", "teste.sem.window")).toBe("teste.sem.window");
    expect(missingKeys.has("teste.sem.window")).toBe(true);
  });

  it("translate interpola variáveis, deixa texto puro intacto e pseudolocaliza no idioma de QA", () => {
    expect(translate("pt-BR", "admin.dashboard.ocultar", { value: "X" })).toBe("ocultar X");
    expect(translate("pt-BR", "auraHype.title")).toBe("AURA Hype");
    const pseudo = translate("qps-ploc", "auraHype.title");
    expect(pseudo).toBe("[ÁÚŘÁ Ĥýþé ~~]");
  });

  it("tr usa o idioma corrente", () => {
    setCurrentLocale("en");
    expect(tr("auraHype.title")).toBe(MESSAGES.en["auraHype.title"]);
    setCurrentLocale("pt-BR");
    expect(tr("admin.dashboard.ocultar", { value: "Y" })).toBe("ocultar Y");
  });
});
