import { afterEach, describe, expect, it } from "vitest";
import { acceptLanguage, baseLocale, currentIntl, detectLocale, fromServerLanguage, getCurrentLocale, intlOf, isLocale, setCurrentLocale, toServerLanguage } from "./state";

afterEach(() => setCurrentLocale("pt-BR"));

describe("estado do idioma", () => {
  it("reconhece só os códigos suportados", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("qps-ploc")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("pseudo-idioma usa a base pt-BR em todo lugar", () => {
    expect(baseLocale("qps-ploc")).toBe("pt-BR");
    expect(baseLocale("es")).toBe("es");
    expect(acceptLanguage("qps-ploc")).toBe("pt-BR");
    expect(toServerLanguage("qps-ploc")).toBe("PT_BR");
    expect(toServerLanguage("en")).toBe("EN");
    expect(toServerLanguage("es")).toBe("ES");
  });

  it("converte o enum do backend e devolve null para desconhecido ou vazio", () => {
    expect(fromServerLanguage("PT_BR")).toBe("pt-BR");
    expect(fromServerLanguage("EN")).toBe("en");
    expect(fromServerLanguage("ES")).toBe("es");
    expect(fromServerLanguage("FR")).toBeNull();
    expect(fromServerLanguage(null)).toBeNull();
    expect(fromServerLanguage()).toBeNull();
  });

  it("detecta o idioma do navegador com pt-BR como padrão", () => {
    expect(detectLocale("es-AR")).toBe("es");
    expect(detectLocale("EN-us")).toBe("en");
    expect(detectLocale("de")).toBe("pt-BR");
    expect(detectLocale(null)).toBe("pt-BR");
    expect(detectLocale()).toBe("pt-BR");
  });

  it("tag Intl acompanha o idioma corrente, com pt-BR quando o código é desconhecido", () => {
    expect(intlOf("en")).toBe("en-US");
    expect(intlOf("zz" as never)).toBe("pt-BR");
    setCurrentLocale("es");
    expect(getCurrentLocale()).toBe("es");
    expect(currentIntl()).toBe("es-ES");
  });
});
