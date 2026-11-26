// @vitest-environment jsdom
/**
 * Aparência do look no criador (useSchemeArt): "Limpar arte" volta os layouts com arte própria (LEGO, Raio-X, Bento…)
 * ao padrão junto com a arte do Studio — antes só a arte era limpa e o LEGO continuava sobreposto — e "Desfazer"
 * devolve arte e layouts de uma vez.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSchemeArt } from "./scheme-builder-art";

describe("useSchemeArt — Limpar arte e Desfazer", () => {
  it("limpar com LEGO no card e nas peças volta os dois layouts ao padrão e zera a arte; desfazer devolve tudo", () => {
    const { result } = renderHook(() => useSchemeArt());
    expect(result.current.empty).toBe(true);
    act(() => { result.current.setAnatomy("LEGO"); result.current.setPieceAnatomy("LEGO"); result.current.setBg({ aura: null, container: { color: "#0055BF" } }); });
    expect(result.current.empty).toBe(false);
    act(() => result.current.clear());
    expect(result.current.anatomy).toBe("LISTA_VERTICAL");
    expect(result.current.pieceAnatomy).toBe("PECA_AMPLIADO");
    expect(result.current.bg).toEqual({});
    expect(result.current.empty).toBe(true);
    act(() => result.current.undo.undo());
    expect(result.current.anatomy).toBe("LEGO");
    expect(result.current.pieceAnatomy).toBe("LEGO");
    expect(result.current.bg).toEqual({ aura: null, container: { color: "#0055BF" } });
  });

  it("layout da seção A (sem arte própria) continua escolhido depois de limpar; só a arte sai", () => {
    const { result } = renderHook(() => useSchemeArt());
    act(() => { result.current.setAnatomy("HERO_LISTA"); result.current.setBg({ aura: { variantId: "v1" } }); });
    act(() => result.current.clear());
    expect(result.current.anatomy).toBe("HERO_LISTA");
    expect(result.current.bg).toEqual({});
  });

  it("só o layout LEGO, sem arte do Studio, já habilita o Limpar arte", () => {
    const { result } = renderHook(() => useSchemeArt());
    act(() => result.current.setAnatomy("LEGO"));
    expect(result.current.empty).toBe(false);
  });
});
