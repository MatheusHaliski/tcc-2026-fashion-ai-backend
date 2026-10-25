// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { DEFAULT_BODY, defaultBodyModel, validateBody, withPersonalMeasures } from "@/lib/avatar3d/body-spec";
import { BodyMeasuresCard } from "./body-measures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("medidas pessoais no corpo do avatar", () => {
  it("altura muda a estatura e peso estima a compleição; apagar desfaz; fita fica guardada à parte", () => {
    const base = defaultBodyModel("FEMININO");
    const m = withPersonalMeasures(base, 175, 80, { waist: 90, neck: 30 });
    expect(m.params.stature).toBe(1.75); expect(m.sources.stature).toBe("user");
    expect(m.params.build).toBeGreaterThan(0.5); expect(m.sources.build).toBe("estimated");
    expect(m.measuresCm).toEqual({ waist: 90 });
    const cleared = withPersonalMeasures(m, null, null, {});
    expect(cleared.params.stature).toBe(DEFAULT_BODY.FEMININO.stature); expect(cleared.params.build).toBe(0);
    expect(cleared.measuresCm).toBeUndefined();
    // medida fora da faixa é descartada pela validação (não "corrigida")
    expect(validateBody({ ...m, measuresCm: { chest: 400, shoe: 38 } })!.measuresCm).toEqual({ shoe: 38 });
  });
});

describe("cartão Suas medidas (Meu Avatar)", () => {
  it("altura e peso atualizam o tamanho estimado e salvam no corpo do avatar", async () => {
    const { calls } = loggedAs(undefined, { "PATCH /api/me/avatar3d": { exists: true } });
    const onSaved = vi.fn();
    renderApp(<BodyMeasuresCard sex="FEMININO" initial={null} canSave onSaved={onSaved} />);
    expect(screen.getByRole("status").textContent).toContain("parte de cima M");
    fireEvent.change(screen.getByLabelText("Altura (cm)"), { target: { value: "168" } });
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "82" } });
    expect(screen.getByRole("status").textContent).not.toContain("parte de cima M ");
    fireEvent.click(screen.getByRole("button", { name: "Mais medidas (fita métrica)" }));
    fireEvent.change(screen.getByLabelText("Número do calçado"), { target: { value: "38" } });
    expect(screen.getByRole("status").textContent).toContain("calçado 38");
    fireEvent.click(screen.getByRole("button", { name: "Salvar medidas" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = (calls.find((c) => c.method === "PATCH")!.body as { body: { heightCm: number; weightKg: number; measuresCm: unknown; params: { stature: number } } }).body;
    expect(body.heightCm).toBe(168); expect(body.weightKg).toBe(82); expect(body.params.stature).toBe(1.68);
    expect(body.measuresCm).toEqual({ shoe: 38 });
  });

  it("valor fora da faixa: aviso no campo e nada é salvo; sem avatar, as medidas vão junto dele", () => {
    loggedAs();
    const onDraft = vi.fn();
    renderApp(<BodyMeasuresCard sex="MASCULINO" initial={null} canSave={false} onDraft={onDraft} />);
    expect(screen.queryByRole("button", { name: "Salvar medidas" })).toBeNull();
    expect(screen.getByText("As medidas vão junto quando você salvar o avatar.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Altura (cm)"), { target: { value: "300" } });
    expect(screen.getByText("Use um valor entre 120 e 220.")).toBeTruthy();
    expect(onDraft).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText("Altura (cm)"), { target: { value: "181" } });
    expect(onDraft.mock.calls.at(-1)![0].heightCm).toBe(181);
  });
});
