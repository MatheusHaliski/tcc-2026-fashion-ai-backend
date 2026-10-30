// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { NavOrderEditor } from "./nav-order-editor";
import { getNavOrder, setNavOrder } from "@/lib/nav/nav-order";

const groupTitles = () => within(screen.getByRole("list", { name: "Ordem do menu" })).getAllByText(/^Grupo \d+: /).map((e) => e.textContent);
const puts = (calls: { method: string; path: string; body?: unknown }[]) =>
  calls.filter((c) => c.method === "PUT" && c.path === "/api/me/preferences").map((c) => (c.body as { navOrder?: unknown }).navOrder);

afterEach(async () => { cleanup(); await setNavOrder(null, { persist: false }); localStorage.clear(); });

describe("ordem do menu nas Configurações (RF23)", () => {
  it("sobe o Guarda-roupa para o primeiro lugar e salva a ordem completa no perfil", async () => {
    const { calls } = loggedAs(undefined, { "PUT /api/me/preferences": {} });
    renderApp(<NavOrderEditor />);
    expect(groupTitles().slice(0, 2)).toEqual(["Grupo 1: Descobrir", "Grupo 2: Guarda-roupa"]);
    // o primeiro grupo não sobe; o último não desce
    expect((screen.getByRole("button", { name: "Subir o grupo Descobrir" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Restaurar ordem padrão" }) as HTMLButtonElement).disabled).toBe(true);

    // a sessão precisa estar restaurada para salvar no perfil
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Subir o grupo Guarda-roupa" }));
    expect(groupTitles().slice(0, 2)).toEqual(["Grupo 1: Guarda-roupa", "Grupo 2: Descobrir"]);
    expect(getNavOrder()?.groups.slice(0, 2)).toEqual(["nav.group.wardrobe", "nav.group.discover"]);
    expect(JSON.parse(localStorage.getItem("fai.navOrder")!).groups[0]).toBe("nav.group.wardrobe");
    await waitFor(() => expect(puts(calls).length).toBe(1));
    expect((puts(calls)[0] as { groups: string[] }).groups[0]).toBe("nav.group.wardrobe");
    expect(await screen.findByText("Ordem do menu salva.")).toBeTruthy();
  });

  it("reordena itens dentro do grupo e restaura a ordem padrão", async () => {
    const { calls } = loggedAs(undefined, { "PUT /api/me/preferences": {} });
    renderApp(<NavOrderEditor />);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me")).toBe(true));
    const wardrobe = () => within(screen.getByRole("list", { name: "Guarda-roupa" })).getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d+\./, ""));
    expect(wardrobe().slice(0, 2)).toEqual(["Minhas peças", "Adicionar peça"]);
    fireEvent.click(screen.getByRole("button", { name: "Descer Minhas peças" }));
    expect(wardrobe().slice(0, 2)).toEqual(["Adicionar peça", "Minhas peças"]);
    expect(getNavOrder()?.items["nav.group.wardrobe"]?.slice(0, 2)).toEqual(["/pieces/new", "/closet"]);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar ordem padrão" }));
    expect(wardrobe().slice(0, 2)).toEqual(["Minhas peças", "Adicionar peça"]);
    expect(getNavOrder()).toBeNull();
    expect(localStorage.getItem("fai.navOrder")).toBeNull();
    await waitFor(() => expect(puts(calls)).toHaveLength(2));
    expect(puts(calls)[1]).toEqual({});
    expect(await screen.findByText("Ordem padrão restaurada.")).toBeTruthy();
  });

  it("Meu Quarto em primeiro no Guarda-roupa sem mudar de grupo, pelas setas e arrastando", async () => {
    loggedAs(undefined, { "PUT /api/me/preferences": {} });
    renderApp(<NavOrderEditor />);
    const wardrobe = () => within(screen.getByRole("list", { name: "Guarda-roupa" })).getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d+\./, ""));
    expect(wardrobe().slice(0, 3)).toEqual(["Minhas peças", "Adicionar peça", "Meu Quarto"]);
    fireEvent.click(screen.getByRole("button", { name: "Subir Meu Quarto" }));
    fireEvent.click(screen.getByRole("button", { name: "Subir Meu Quarto" }));
    expect(wardrobe().slice(0, 3)).toEqual(["Meu Quarto", "Minhas peças", "Adicionar peça"]);
    expect(getNavOrder()?.groups[1]).toBe("nav.group.wardrobe");                     // o grupo não saiu do lugar

    // arrastar o último item (Meu Avatar 3D) para o topo do grupo
    const items = within(screen.getByRole("list", { name: "Guarda-roupa" })).getAllByRole("listitem");
    fireEvent.dragStart(items[items.length - 1], { dataTransfer: { effectAllowed: "" } });
    fireEvent.dragOver(items[0]);
    fireEvent.drop(items[0]);
    expect(wardrobe()[0]).toBe("Meu Avatar 3D");
    expect(wardrobe()[1]).toBe("Meu Quarto");
    // soltar num item de outro grupo não faz nada
    const discover = within(screen.getByRole("list", { name: "Descobrir" })).getAllByRole("listitem");
    fireEvent.dragStart(within(screen.getByRole("list", { name: "Guarda-roupa" })).getAllByRole("listitem")[0], { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(discover[0]);
    expect(wardrobe()[0]).toBe("Meu Avatar 3D");
  });

  it("erro ao salvar vira aviso; a ordem continua aplicada no navegador", async () => {
    const { calls } = loggedAs(undefined, { "PUT /api/me/preferences": new Response(JSON.stringify({ status: 400, code: "ORDEM_DO_MENU_INVALIDA", message: "Ordem do menu inválida." }), { status: 400, headers: { "content-type": "application/json" } }) });
    renderApp(<NavOrderEditor />);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Descer o grupo Descobrir" }));
    expect(await screen.findByText("Ordem do menu inválida.")).toBeTruthy();
    expect(getNavOrder()?.groups[0]).toBe("nav.group.wardrobe");
  });
});
