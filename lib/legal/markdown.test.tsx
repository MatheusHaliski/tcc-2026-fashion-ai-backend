// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LegalMarkdown } from "./markdown";

afterEach(cleanup);

function html(markdown: string) {
  return render(<LegalMarkdown markdown={markdown} />).container;
}

describe("LegalMarkdown", () => {
  it("renderiza títulos de nível 1, 2 e 3+ com as tags e classes certas", () => {
    const root = html("# Termos\n## Seção\n### Sub\n#### Mais fundo");
    expect(root.querySelector("h1")?.textContent).toBe("Termos");
    expect(root.querySelector("h1")?.className).toContain("text-3xl");
    expect(root.querySelector("h2")?.textContent).toBe("Seção");
    expect(root.querySelector("h2")?.className).toContain("text-xl");
    const h3s = root.querySelectorAll("h3");
    expect(h3s).toHaveLength(2);
    expect(h3s[1].textContent).toBe("Mais fundo");
    expect(h3s[1].className).toContain("text-lg");
  });

  it("formata negrito, código, itálico e links internos/externos dentro do texto", () => {
    const root = html("Texto **forte** e `codigo` e *enfase* com [site](https://ex.com) e [âncora](#topo).");
    expect(root.querySelector("strong")?.textContent).toBe("forte");
    expect(root.querySelector("code")?.textContent).toBe("codigo");
    expect(root.querySelector("em")?.textContent).toBe("enfase");
    const ext = screen.getByRole("link", { name: "site" });
    expect(ext.getAttribute("href")).toBe("https://ex.com");
    expect(ext.getAttribute("target")).toBe("_blank");
    expect(ext.getAttribute("rel")).toBe("noreferrer");
    const internal = screen.getByRole("link", { name: "âncora" });
    expect(internal.getAttribute("href")).toBe("#topo");
    expect(internal.getAttribute("target")).toBeNull();
  });

  it("não transforma em link destinos que não são http(s) nem âncora", () => {
    const root = html("Veja [x](javascript:alert(1)) aqui");
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("[x](javascript:alert(1))");
  });

  it("gera régua horizontal e citação juntando linhas seguidas com >", () => {
    const root = html("antes\n\n---\n> primeira\n>segunda **forte**\n\ndepois");
    expect(root.querySelector("hr")).not.toBeNull();
    const quote = root.querySelector("blockquote");
    expect(quote?.textContent).toBe("primeira segunda forte");
    expect(quote?.querySelector("strong")?.textContent).toBe("forte");
    expect(root.querySelectorAll("p")).toHaveLength(2);
  });

  it("monta tabela com cabeçalho e preenche células faltantes com vazio", () => {
    const root = html("| Dado | Uso |\n| --- | :---: |\n| email | **login** |\n| ip |\nfim");
    const ths = Array.from(root.querySelectorAll("th")).map((th) => th.textContent);
    expect(ths).toEqual(["Dado", "Uso"]);
    const rows = root.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector("strong")?.textContent).toBe("login");
    expect(rows[1].querySelectorAll("td")[1].textContent).toBe("");
    expect(root.querySelector("p")?.textContent).toBe("fim");
  });

  it("linha com barras sem separador vira parágrafo, não tabela", () => {
    const root = html("| a | b |\n| c | d |");
    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector("p")?.textContent).toBe("| a | b | | c | d |");
  });

  it("separa listas ordenadas e não ordenadas quando o tipo muda", () => {
    const root = html("- um\n* dois\n1. primeiro\n2. segundo\n- tres");
    const uls = root.querySelectorAll("ul");
    const ols = root.querySelectorAll("ol");
    expect(uls).toHaveLength(2);
    expect(ols).toHaveLength(1);
    expect(uls[0].className).toContain("list-disc");
    expect(ols[0].className).toContain("list-decimal");
    expect(Array.from(uls[0].querySelectorAll("li")).map((li) => li.textContent)).toEqual(["um", "dois"]);
    expect(Array.from(ols[0].querySelectorAll("li")).map((li) => li.textContent)).toEqual(["primeiro", "segundo"]);
  });

  it("junta linhas de parágrafo até o próximo bloco e aceita quebras CRLF", () => {
    const root = html("linha um\r\nlinha dois\r\n## Titulo\r\noutra");
    const ps = root.querySelectorAll("p");
    expect(ps[0].textContent).toBe("linha um linha dois");
    expect(root.querySelector("h2")?.textContent).toBe("Titulo");
    expect(ps[1].textContent).toBe("outra");
  });

  it("marcador de título sem texto é descartado sem travar a leitura", () => {
    const root = html("# \ndepois");
    expect(root.querySelector("h1")).toBeNull();
    expect(root.querySelector("p")?.textContent).toBe("depois");
  });

  it("conteúdo vazio gera artigo sem blocos", () => {
    const root = html("\n\n   \n");
    expect(root.querySelector("article")?.children).toHaveLength(0);
  });
});
