// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCaptureTutorialPrefs } from "./tutorial-prefs";

const KEY = "fai.captureTutorial";

beforeEach(() => localStorage.clear());

describe("preferência \"não mostrar novamente\" do guia de fotografia", () => {
  it("começa sem guias escondidos", async () => {
    const { result } = renderHook(() => useCaptureTutorialPrefs());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
    expect(result.current.isHidden("camiseta")).toBe(false);
  });

  it("esconde só o guia escolhido e salva no navegador", async () => {
    const { result } = renderHook(() => useCaptureTutorialPrefs());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(() => result.current.setHidden("camiseta", true));
    expect(result.current.isHidden("camiseta")).toBe(true);
    expect(result.current.isHidden("relogio")).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toEqual({ camiseta: { hidden: true } });
  });

  it("lê o que já estava salvo", async () => {
    localStorage.setItem(KEY, JSON.stringify({ relogio: { hidden: true } }));
    const { result } = renderHook(() => useCaptureTutorialPrefs());
    await waitFor(() => expect(result.current.isHidden("relogio")).toBe(true));
  });

  it("guia vazio ou nulo nunca conta como escondido", async () => {
    const { result } = renderHook(() => useCaptureTutorialPrefs());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.isHidden(null)).toBe(false);
    expect(result.current.isHidden(undefined)).toBe(false);
    expect(result.current.isHidden("")).toBe(false);
  });

  it("valor corrompido no navegador volta ao padrão", async () => {
    localStorage.setItem(KEY, "{quebrado");
    const { result } = renderHook(() => useCaptureTutorialPrefs());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs).toEqual({});
  });
});
