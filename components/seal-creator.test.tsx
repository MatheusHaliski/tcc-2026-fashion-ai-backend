// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import type { SealDesign } from "./seal-medallion";

const validate = vi.hoisted(() => vi.fn());
vi.mock("./seal-medallion", async (orig) => ({ ...(await orig<typeof import("./seal-medallion")>()), validateSealImage: validate }));

import { SealCreator } from "./seal-creator";
import { DEFAULT_DESIGN } from "./seal-medallion";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); validate.mockReset(); });

function Harness({ initial, onChange, premium }: { initial?: SealDesign | null; onChange?: (d: SealDesign) => void; premium?: boolean }) {
  const [d, setD] = useState<SealDesign | null | undefined>(initial);
  return <SealCreator value={d} premium={premium} onChange={(n) => { onChange?.(n); setD(n); }} />;
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as SealDesign;

describe("SealCreator (criador de selo RF25)", () => {
  it("sem valor usa o desenho padrão, mostra as prévias e o aviso premium", () => {
    renderApp(<Harness premium />);
    expect(screen.getByText("card do look")).toBeTruthy();
    expect(screen.getByText("Selo Premium (celebridade): anel holográfico externo automático.")).toBeTruthy();
    expect(screen.getByText("Variar")).toBeTruthy();
    expect(screen.getByText("4 · Borda (bisel)")).toBeTruthy();
  });

  it("variar gera um desenho novo com semente diferente", () => {
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByText("Variar"));
    const d = last(onChange);
    expect(d.field?.seed).not.toBe(DEFAULT_DESIGN.field?.seed);
    expect(d.field?.pattern).not.toBe("NENHUM");
    expect([1, 2, 3]).toContain(d.field?.density);
  });

  it("paleta, padrão, elemento e texto do elemento alteram o desenho", () => {
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByTitle("DOURADO"));
    expect(last(onChange).palette).toBe("DOURADO");
    fireEvent.click(screen.getByText("Grade"));
    expect(last(onChange).field?.pattern).toBe("GRADE");
    fireEvent.change(screen.getByLabelText("Texto (até 3 caracteres)"), { target: { value: "a-b" } });
    expect(last(onChange).element?.text).toBe("AB");
    fireEvent.click(screen.getByText("Estrela"));
    expect(last(onChange).element?.id).toBe("STAR");
    // estrela não tem texto
    expect(screen.queryByLabelText("Texto (até 3 caracteres)")).toBeNull();
  });

  it("material metálico desabilita a cor; cores, densidade, raio e largura vão para o desenho", () => {
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.click(document.getElementById("m-border")!);
    fireEvent.click(screen.getAllByRole("option", { name: "Dourado" })[0]);
    expect(last(onChange).border?.material).toBe("DOURADO");
    expect((document.getElementById("c-border") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("metais e holográfico têm cor própria")).toBeTruthy();
    fireEvent.change(document.getElementById("c-center")!, { target: { value: "#aabbcc" } });
    expect(last(onChange).center?.color).toBe("#AABBCC");
    fireEvent.change(document.getElementById("lc")!, { target: { value: "#112233" } });
    expect(last(onChange).field?.lineColor).toBe("#112233");
    fireEvent.change(document.getElementById("dens")!, { target: { value: "3" } });
    expect(last(onChange).field?.density).toBe(3);
    fireEvent.change(document.getElementById("crad")!, { target: { value: "0.5" } });
    expect(last(onChange).center?.radius).toBe(0.5);
    fireEvent.change(document.getElementById("bw")!, { target: { value: "0.08" } });
    expect(last(onChange).border?.width).toBe(0.08);
  });

  it("cores dos nós: troca, remove e adiciona até 6", () => {
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    const before = DEFAULT_DESIGN.field?.nodeColors?.length ?? 5;
    fireEvent.click(screen.getByText("+ cor"));
    expect(last(onChange).field?.nodeColors).toHaveLength(before + 1);
    expect(screen.queryByText("+ cor")).toBeNull();
    fireEvent.click(screen.getAllByLabelText("remover cor")[0]);
    expect(last(onChange).field?.nodeColors).toHaveLength(before);
    const nodeInputs = document.querySelectorAll("input.h-8.w-10");
    fireEvent.change(nodeInputs[0], { target: { value: "#00ff00" } });
    expect(last(onChange).field?.nodeColors?.[0]).toBe("#00FF00");
  });

  it("com um só nó não oferece remover", () => {
    renderApp(<Harness initial={{ ...DEFAULT_DESIGN, field: { ...DEFAULT_DESIGN.field, nodeColors: ["#FFFFFF"] } }} />);
    expect(screen.queryByLabelText("remover cor")).toBeNull();
  });

  it("modo envio: imagem inválida mostra erro e não envia", async () => {
    const { calls } = mockApi({});
    validate.mockResolvedValue({ ok: false, message: "Precisa ser quadrada." });
    renderApp(<Harness />);
    fireEvent.click(screen.getAllByText("Enviar selo pronto")[0]);
    expect(screen.getByText("Sem arquivo enviado, o selo continua usando o desenho gerado.")).toBeTruthy();
    expect(screen.queryByText("Variar")).toBeNull();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "s.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Precisa ser quadrada.")).toBeTruthy());
    expect(calls.some((c) => c.path === "/api/seals/uploads")).toBe(false);
  });

  it("modo envio: imagem válida sobe e informa o tamanho salvo", async () => {
    mockApi({ "POST /api/seals/uploads": { url: "/media/selo.png", width: 512, height: 512, circular: true } });
    validate.mockResolvedValue({ ok: true });
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Enviar selo pronto")[0]);
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [new File(["x"], "s.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Selo salvo em 512 × 512 px · conteúdo circular OK.")).toBeTruthy());
    expect(last(onChange)).toMatchObject({ mode: "UPLOAD", uploadUrl: "/media/selo.png" });
    expect(screen.getByText("Trocar")).toBeTruthy();
    // voltar ao criador
    fireEvent.click(screen.getByText("Gerar no criador"));
    expect(last(onChange).mode).toBe("GENERATED");
  });

  it("modo envio: aviso do servidor e falha no envio", async () => {
    validate.mockResolvedValue({ ok: true });
    mockApi({ "POST /api/seals/uploads": { url: "/media/s.png", width: 300, height: 300, circular: false, warning: "Borda cortada" } });
    renderApp(<Harness initial={{ ...DEFAULT_DESIGN, mode: "UPLOAD" }} />);
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [new File(["x"], "s.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Borda cortada")).toBeTruthy());
    cleanup();
    mockApi({ "POST /api/seals/uploads": () => new Response(JSON.stringify({ status: 422, code: "X", message: "Arquivo recusado" }), { status: 422, headers: { "content-type": "application/json" } }) });
    renderApp(<Harness initial={{ ...DEFAULT_DESIGN, mode: "UPLOAD" }} />);
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [new File(["x"], "s.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Arquivo recusado")).toBeTruthy());
  });

  it("validação sem mensagem usa 'Imagem inválida.'", async () => {
    validate.mockResolvedValue({ ok: false });
    renderApp(<Harness initial={{ ...DEFAULT_DESIGN, mode: "UPLOAD" }} />);
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [new File(["x"], "s.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Imagem inválida.")).toBeTruthy());
  });

  it("desenho mínimo (sem partes) usa os valores padrão e variar parte da semente 1", () => {
    const onChange = vi.fn();
    renderApp(<Harness initial={{}} onChange={onChange} />);
    expect((document.getElementById("dens") as HTMLInputElement).value).toBe("2");
    expect((document.getElementById("lc") as HTMLInputElement).value).toBe("#f6e8cf");
    expect((document.getElementById("c-border") as HTMLInputElement).value).toBe("#000000");
    expect((screen.getByLabelText("Texto (até 3 caracteres)") as HTMLInputElement).value).toBe("FAI");
    fireEvent.click(screen.getByText("Variar"));
    expect(last(onChange).field?.seed).toBe(49);
    cleanup();
    const onChange2 = vi.fn();
    renderApp(<Harness initial={{}} onChange={onChange2} />);
    fireEvent.change(document.getElementById("bw")!, { target: { value: "0.05" } });
    expect(last(onChange2)).toMatchObject({ mode: "GENERATED", border: { width: 0.05 } });
    fireEvent.click(screen.getByText("Monograma"));
    expect(last(onChange2).element?.id).toBe("MONOGRAM");
    expect(screen.getByLabelText("Texto (até 3 caracteres)")).toBeTruthy();
  });
});
