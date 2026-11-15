// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { ApiError } from "@/lib/api/client";
import type { GenderEvidence } from "./contracts";
import { EditorBackLink } from "./editor-back-link";
import { nodeLabel } from "./node-label";
import { useGenderEvidence } from "./use-gender-evidence";

const EVIDENCE: GenderEvidence = { sources: [], status: "INCOMPLETE", suggestion: null, hash: "h", options: [] };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Editor 3D do Atelier › dados da composição", () => {
  it("uma falha passageira é refeita: o editor não fica em Carregando para sempre", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue(EVIDENCE);
    const onError = vi.fn();
    const ids: string[] = [];
    const { result } = renderHook(() => useGenderEvidence(load, ids, onError));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current[0]).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current[0]).toEqual(EVIDENCE);
    expect(onError).not.toHaveBeenCalled();
  });

  it("acesso negado não é repetido e avisa o erro", async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, "FORBIDDEN", "negado"));
    const onError = vi.fn();
    const ids: string[] = [];
    renderHook(() => useGenderEvidence(load, ids, onError));
    await act(async () => { await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("Editor 3D do Atelier › sair e nomes", () => {
  it("com alterações não salvas, Voltar ao projeto pergunta antes de sair", () => {
    router.push.mockClear();
    renderApp(<EditorBackLink projectId="p1" dirty />);
    fireEvent.click(screen.getByRole("link", { name: "Voltar ao projeto" }));
    expect(screen.getByRole("dialog", { name: "Sair sem salvar?" })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    expect(router.push).toHaveBeenCalledWith("/atelier/projects/p1");
  });

  it("sem alterações, o link sai direto (sem pergunta)", () => {
    renderApp(<EditorBackLink projectId="p1" dirty={false} />);
    fireEvent.click(screen.getByRole("link", { name: "Voltar ao projeto" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("as partes da peça base aparecem em português; objeto importado mantém o nome", () => {
    const t = (key: string) => ({ "atelier3d.part.sleeveLeft": "Manga esquerda", "atelier3d.part.tee": "Camiseta base" })[key] ?? key;
    expect(nodeLabel("Sleeve_left", "n1", t)).toBe("Manga esquerda");
    expect(nodeLabel("FAI tee prototype", "n0", t)).toBe("Camiseta base");
    expect(nodeLabel("Bolso_cargo", "n2", t)).toBe("Bolso_cargo");
    expect(nodeLabel("", "n3", t)).toBe("n3");
  });
});
