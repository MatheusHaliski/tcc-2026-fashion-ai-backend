// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { translateRich, trRich } from "./rich";
import { setCurrentLocale } from "./state";

afterEach(() => { cleanup(); setCurrentLocale("pt-BR"); });

const KEY = "admin.dashboard.resposta_por_usuario_no_periodo";

describe("mensagens com marcação", () => {
  it("troca a tag numerada pelo elemento fornecido e interpola as variáveis", () => {
    const { container } = render(<p>{translateRich("pt-BR", KEY, { countryName: "Brasil", usd: "US$ 2" }, { 0: (c) => <strong>{c}</strong> })}</p>);
    expect(container.querySelector("strong")?.textContent).toBe("Brasil");
    expect(container.textContent).toBe("Resposta: Brasil — US$ 2 por usuário no período.");
  });

  it("sem fábrica para a tag mantém só o conteúdo", () => {
    const { container } = render(<p>{translateRich("pt-BR", KEY, { countryName: "Chile", usd: "1" })}</p>);
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("Chile");
  });

  it("no pseudo-idioma pseudolocaliza texto e variáveis", () => {
    setCurrentLocale("qps-ploc");
    const { container } = render(<p>{trRich(KEY, { countryName: "Peru", usd: "dez" }, { 0: (c) => <em>{c}</em> })}</p>);
    expect(container.querySelector("em")?.textContent).toContain("Þéřú");
    expect(container.textContent).toContain("ðéž");
    expect(container.textContent).toContain("[");
  });
});
