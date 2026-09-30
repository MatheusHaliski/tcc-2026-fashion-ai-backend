import { describe, expect, it } from "vitest";
import { formatIcu, icuTags, icuVariables, isTag, parseIcu } from "./icu";

const fmt = (msg: string, vars?: Record<string, unknown>, locale = "pt-BR") => formatIcu(parseIcu(msg), vars, locale);

describe("mensagens ICU dos catálogos (RF23)", () => {
  it("troca variáveis e mantém o marcador quando a variável não veio", () => {
    expect(fmt("Olá, {nome}!", { nome: "Ana" })).toBe("Olá, Ana!");
    expect(fmt("Olá, {nome}!")).toBe("Olá, {nome}!");
    expect(fmt("Olá, {nome}!", { nome: null })).toBe("Olá, {nome}!");
  });

  it("plural com caso exato, categoria do idioma e # formatado", () => {
    const msg = "{n, plural, =0 {nenhuma peça} one {# peça} other {# peças}}";
    expect(fmt(msg, { n: 0 })).toBe("nenhuma peça");
    expect(fmt(msg, { n: 1 })).toBe("1 peça");
    expect(fmt(msg, { n: 1500 })).toBe("1.500 peças");
    expect(fmt(msg, { n: 1500 }, "en")).toBe("1,500 peças");
  });

  it("plural com offset desconta antes de escolher a categoria", () => {
    const msg = "{n, plural, offset:1 =0 {ninguém} =1 {só você} one {você e # pessoa} other {você e # pessoas}}";
    expect(fmt(msg, { n: 1 })).toBe("só você");
    expect(fmt(msg, { n: 2 })).toBe("você e 1 pessoa");
    expect(fmt(msg, { n: 4 })).toBe("você e 3 pessoas");
  });

  it("ordinal em inglês usa as categorias one/two/few/other", () => {
    const msg = "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}";
    expect(fmt(msg, { n: 1 }, "en")).toBe("1st");
    expect(fmt(msg, { n: 2 }, "en")).toBe("2nd");
    expect(fmt(msg, { n: 3 }, "en")).toBe("3rd");
    expect(fmt(msg, { n: 11 }, "en")).toBe("11th");
  });

  it("select escolhe a opção pelo valor e cai em other", () => {
    const msg = "{sexo, select, feminino {ela} masculino {ele} other {a pessoa}}";
    expect(fmt(msg, { sexo: "feminino" })).toBe("ela");
    expect(fmt(msg, { sexo: "x" })).toBe("a pessoa");
    expect(fmt(msg)).toBe("a pessoa");
  });

  it("números: padrão, porcentagem e inteiro no formato do idioma", () => {
    expect(fmt("{v, number}", { v: 1234.5 })).toBe("1.234,5");
    expect(fmt("{v, number, percent}", { v: 0.25 })).toBe("25%");
    expect(fmt("{v, number, integer}", { v: 9.7 })).toBe("10");
    expect(fmt("{v, number}", { v: "abc" })).toBe("abc");
    expect(fmt("{v, number}", {})).toBe("");
  });

  it("datas e horas pelo Intl; data inválida sai como veio", () => {
    const d = new Date(Date.UTC(2026, 8, 30, 15, 0));
    expect(fmt("{d, date, short}", { d }, "en")).toBe(new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(d));
    expect(fmt("{d, date}", { d: d.toISOString() }, "pt-BR")).toBe(new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d));
    expect(fmt("{h, time}", { h: d }, "en")).toBe(new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(d));
    expect(fmt("{d, date}", { d: "não é data" })).toBe("não é data");
  });

  it("apóstrofos protegem chaves, tags e # literais", () => {
    expect(fmt("It''s ok")).toBe("It's ok");
    expect(fmt("use '{nome}' literal")).toBe("use {nome} literal");
    expect(fmt("'<b>' não é tag")).toBe("<b> não é tag");
    expect(fmt("{n, plural, other {'#' {n}}}", { n: 3 })).toBe("# 3");
    expect(fmt("d'água")).toBe("d'água");
    expect(fmt("'{it''s}'")).toBe("{it's}");
  });

  it("marcação rica: o texto das tags aparece, as tags somem, fechamento órfão fica literal", () => {
    const nodes = parseIcu("Leia os <0>termos</0><1/> agora</2>");
    expect(isTag(nodes[1])).toBe(true);
    expect(formatIcu(nodes, undefined, "pt-BR")).toBe("Leia os termos agora</2>");
    expect(fmt("a < b")).toBe("a < b");
  });

  it("mensagem malformada não trava a leitura", () => {
    expect(() => parseIcu("{n, plural, one")).not.toThrow();
    expect(() => parseIcu("{n, plural, one x}")).not.toThrow();
    expect(fmt("{n, plural, one {# item}")).toBeTypeOf("string");
  });

  it("reaproveita a análise da mesma mensagem (cache)", () => {
    const msg = "cache {x}";
    expect(parseIcu(msg)).toBe(parseIcu(msg));
  });

  it("lista variáveis e tags para a verificação de paridade entre idiomas", () => {
    expect(icuVariables("{a} e {n, plural, one {# de {b}} other {# de {c}}}")).toEqual(["a", "b", "c", "n"]);
    expect(icuTags("<0>x <1>y</1></0> {n, plural, other {<2/>}}")).toEqual(["0", "1", "2"]);
    expect(icuVariables("<0>{nome}</0>")).toEqual(["nome"]);
  });
});
