// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { REQUIREMENT_CODE, setDevRefs, useDevRefs, useDevRefsFromUrl } from "./dev-refs";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("modo apresentação com os códigos de requisito", () => {
  it("reconhece textos formados só por códigos de requisito", () => {
    for (const ok of ["RF7", "RF7 · RF31", "RF10 · CA08–CA16", "HU20", "RNF8", "RF5.CA01"]) expect(REQUIREMENT_CODE.test(ok)).toBe(true);
    for (const no of ["Criar look", "RF", "RF7 e RF8", "rf7", ""]) expect(REQUIREMENT_CODE.test(no)).toBe(false);
  });

  it("começa desligado e liga ou desliga na hora", () => {
    const { result } = renderHook(() => useDevRefs());
    expect(result.current).toBe(false);
    act(() => setDevRefs(true));
    expect(result.current).toBe(true);
    expect(localStorage.getItem("fai.devrefs")).toBe("1");
    act(() => setDevRefs(false));
    expect(result.current).toBe(false);
    expect(localStorage.getItem("fai.devrefs")).toBeNull();
  });

  it("?rf=1 na URL liga o modo", () => {
    window.history.replaceState(null, "", "/feed?rf=1");
    renderHook(() => useDevRefsFromUrl());
    expect(localStorage.getItem("fai.devrefs")).toBe("1");
  });

  it("?rf=0 na URL desliga o modo", () => {
    localStorage.setItem("fai.devrefs", "1");
    window.history.replaceState(null, "", "/feed?rf=0");
    renderHook(() => useDevRefsFromUrl());
    expect(localStorage.getItem("fai.devrefs")).toBeNull();
  });

  it("sem o parâmetro, a escolha anterior fica como estava", () => {
    localStorage.setItem("fai.devrefs", "1");
    window.history.replaceState(null, "", "/feed");
    renderHook(() => useDevRefsFromUrl());
    expect(localStorage.getItem("fai.devrefs")).toBe("1");
  });
});
