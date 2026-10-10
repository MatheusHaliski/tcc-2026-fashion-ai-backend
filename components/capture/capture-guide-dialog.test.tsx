// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderApp, mockApi } from "@/test-utils/render";
import { CaptureGuideDialog } from "@/components/capture/capture-guide-dialog";
import type { CaptureCategory } from "@/lib/capture/capture-guides";

function Harness({ onConfirm, setHidden }: { onConfirm: (id: string) => void; setHidden: (g: string, h: boolean) => Promise<void> }) {
  const [cat, setCat] = useState<CaptureCategory | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const prefs = { prefs: {}, loaded: true, isHidden: () => false, setHidden };
  return <CaptureGuideDialog open onClose={() => undefined} category={cat} subcategory={sub} prefs={prefs}
    onCategory={(c, s) => { setCat(c); setSub(s ?? null); }} onConfirm={(g) => onConfirm(g.id)} />;
}

afterEach(() => cleanup());

describe("modal Como fotografar sua peça (RF47)", () => {
  it("segmenta por categoria, depois por tipo de acessório, e mostra a orientação do relógio", async () => {
    mockApi();
    const onConfirm = vi.fn(); const setHidden = vi.fn(async () => undefined);
    renderApp(<Harness onConfirm={onConfirm} setHidden={setHidden} />);
    expect(screen.getByText("O que você vai adicionar?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Acessórios/ }));
    expect(await screen.findByText("Qual tipo de acessório você vai adicionar?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Relógio/ }));
    expect(await screen.findByText("Fotografe o mostrador de frente")).toBeTruthy();
    expect(screen.getByText("Mostrador")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Não mostrar novamente"));
    expect(setHidden).toHaveBeenCalledWith("accessory_watch", true);
    fireEvent.click(screen.getByRole("button", { name: "Entendi, adicionar foto" }));
    expect(onConfirm).toHaveBeenCalledWith("accessory_watch");
  });

  it("parte de baixo orienta a foto de trás e permite trocar a categoria", async () => {
    mockApi();
    renderApp(<Harness onConfirm={vi.fn()} setHidden={vi.fn(async () => undefined)} />);
    fireEvent.click(screen.getByRole("radio", { name: /Parte de baixo/ }));
    expect(await screen.findByText("Fotografe preferencialmente a parte de trás")).toBeTruthy();
    expect(screen.getByText("Cós")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alterar categoria" }));
    await waitFor(() => expect(screen.getByText("O que você vai adicionar?")).toBeTruthy());
  });
});
