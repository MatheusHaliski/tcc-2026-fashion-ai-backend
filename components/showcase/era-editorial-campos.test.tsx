// @vitest-environment jsdom
/**
 * Studio de Eras: edição dos campos de cada marco e foto (e remoção), upload da foto (sucesso e erro), símbolo que sai,
 * luzes animadas, rascunho da IA remota (não local) e falha; na prévia, tema desconhecido cai no padrão e o movimento liga.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { EraEditorialEditor, EraEditorialView } from "./era-editorial";
import { emptyEditorial, type EraEditorial } from "@/lib/eras/editorial";

vi.mock("@/components/three/common", () => ({ useReducedMotion: () => false }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const fail = (message: string) => () => new Response(JSON.stringify({ status: 500, code: "ERRO", message }), { status: 500, headers: { "content-type": "application/json" } });
let last: EraEditorial;
function Editor({ start }: { start?: Partial<EraEditorial> }) {
  const [e, set] = useState<EraEditorial>({ ...emptyEditorial(), ...start });
  last = e;
  return <EraEditorialEditor value={e} onChange={set} />;
}

describe("EraEditorialView", () => {
  it("tema desconhecido usa o padrão, movimento ligado e título cai no rótulo", () => {
    const { container } = renderApp(<EraEditorialView value={{ theme: "NAO_EXISTE", symbols: [] }} label="Era Azul" />);
    expect(container.querySelector(".era-editorial")!.getAttribute("data-motion")).toBe("on");
    expect(screen.getByRole("heading", { name: "Era Azul" })).toBeTruthy();
    expect(screen.queryByText("Linha do tempo editorial")).toBeNull();
    expect(screen.queryByText("Mural de momentos")).toBeNull();
  });
});

describe("EraEditorialEditor — campos", () => {
  it("edita frase, marco (data/título/descrição) e o remove; símbolo e luzes alternam", () => {
    renderApp(<Editor />);
    fireEvent.change(screen.getByLabelText("Frase editorial"), { target: { value: "Fase dourada" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marco" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marco" }));
    fireEvent.change(screen.getAllByLabelText("Data do marco")[0], { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getAllByLabelText("Momento marcante")[0], { target: { value: "Show" } });
    fireEvent.change(screen.getAllByLabelText("Descrição")[0], { target: { value: "Primeiro show" } });
    expect(last.timeline[0]).toEqual({ date: "2026-03-01", title: "Show", description: "Primeiro show" });
    expect(last.timeline[1]).toEqual({ date: "", title: "", description: "" });
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[1]);
    expect(last.timeline.length).toBe(1);
    expect(document.querySelector(".era-timeline")!.textContent).toContain("Primeiro show");   // na prévia
    fireEvent.click(screen.getByRole("button", { name: "Microfone", exact: true }));
    expect(last.symbols).toEqual(["STAR"]);
    fireEvent.click(screen.getByRole("switch", { name: "Luzes de palco animadas" }));
    expect(last.motion).toBe(false);
    expect(document.querySelector(".era-editorial")!.getAttribute("data-motion")).toBe("off");
    expect(last.headline).toBe("Fase dourada");
  });

  it("fotos: adiciona, edita URL/descrição/legenda, remove; no limite de 24 trava", () => {
    renderApp(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar foto" }));
    fireEvent.change(screen.getByLabelText("URL da mídia no FashionAI"), { target: { value: "/media/a.jpg" } });
    fireEvent.change(screen.getByLabelText("Descrição acessível da foto"), { target: { value: "Palco" } });
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Abertura" } });
    expect(last.photos).toEqual([{ url: "/media/a.jpg", alt: "Palco", caption: "Abertura" }]);
    expect(screen.getByAltText("Palco")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(last.photos).toEqual([]);
    cleanup();
    renderApp(<Editor start={{ photos: Array.from({ length: 24 }, (_, i) => ({ url: `/m/${i}.jpg`, alt: "", caption: "" })), timeline: Array.from({ length: 40 }, () => ({ date: "", title: "", description: "" })) }} />);
    expect((screen.getByRole("button", { name: "Adicionar foto" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Adicionar marco" }) as HTMLButtonElement).disabled).toBe(true);
    expect((document.querySelector("input[type=file]") as HTMLInputElement).disabled).toBe(true);
  });

  it("upload de foto acrescenta ao mural; erro vira aviso; sem arquivo não faz nada", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/era-studio/uploads": { url: "/media/up.jpg" } });
    renderApp(<Editor />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    await waitFor(() => expect(last.photos).toEqual([{ url: "/media/up.jpg", alt: "", caption: "" }]));
    expect(calls.filter((c) => c.path === "/api/era-studio/uploads").length).toBe(1);
    cleanup();
    loggedAs(undefined, { "POST /api/era-studio/uploads": fail("Arquivo grande") });
    renderApp(<Editor />);
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(await screen.findByText("Arquivo grande")).toBeTruthy();
    expect(last.photos).toEqual([]);
  });

  it("IA remota: rascunho pronto mantém as fotos; erro vira aviso; prompt curto desabilita", async () => {
    loggedAs(undefined, { "POST /api/era-studio/draft": { editorial: { theme: "DARK_POP", headline: "Sombras", symbols: ["MOON"] }, fallbackUsed: false } });
    renderApp(<Editor start={{ photos: [{ url: "/m/k.jpg", alt: "Mantida", caption: "" }] }} />);
    fireEvent.click(screen.getByRole("radio", { name: "Copilot IA" }));
    const gen = screen.getByRole("button", { name: "Criar rascunho" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Descreva a estética e os marcos com suas datas"), { target: { value: "ab" } });
    expect(gen.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Descreva a estética e os marcos com suas datas"), { target: { value: "gótico" } });
    fireEvent.click(gen);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Rascunho da IA pronto para revisão."));
    expect(last).toMatchObject({ theme: "DARK_POP", headline: "Sombras", symbols: ["MOON"], photos: [{ url: "/m/k.jpg", alt: "Mantida", caption: "" }] });
    expect(screen.queryByLabelText("Descreva a estética e os marcos com suas datas")).toBeNull();   // volta ao manual
    cleanup();
    loggedAs(undefined, { "POST /api/era-studio/draft": fail("IA fora") });
    renderApp(<Editor />);
    fireEvent.click(screen.getByRole("radio", { name: "Copilot IA" }));
    fireEvent.change(screen.getByLabelText("Descreva a estética e os marcos com suas datas"), { target: { value: "neon total" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
    expect(await screen.findByText("IA fora")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
