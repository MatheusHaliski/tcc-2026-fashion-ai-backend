// @vitest-environment jsdom
/**
 * Tamanho sem formulário: o diálogo da peça e "Meus tamanhos" mostram a grade do sistema; um toque salva o tamanho,
 * sem pedir medidas, sem tabela JSON e sem chamada de API para a escolha.
 */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { tr } from "@/lib/i18n/core";
import { ProductFitDialog } from "./ProductFitDialog";
import { FitPage } from "./FitPage";
import { readMySizes } from "@/lib/tryon/sizes";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); try { localStorage.clear(); } catch { /* sem storage */ } });
const tee = { id: "p1", productName: "Camiseta básica", category: "upper_piece", subcategory: "t_shirt", gender: "FEMININO" };

it("a peça mostra a grade em letras; um toque salva o tamanho, sem formulário e sem API", async () => {
  const { calls } = mockApi({});
  renderApp(<ProductFitDialog product={tee} open onClose={vi.fn()} />);
  const group = await screen.findByRole("radiogroup", { name: tr("size.meu_tamanho") });
  expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["PPPP (XS)", "PP (S)", "MM", "GG (L)", "GGGG (XL)", "XGXG (XXL)"]);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText(/JSON/)).toBeNull();
  fireEvent.click(within(group).getByRole("radio", { name: /^G \(L\)/ }));
  expect(within(group).getByRole("radio", { name: /^G \(L\)/ }).getAttribute("aria-checked")).toBe("true");
  expect(readMySizes()).toEqual({ letter: "G" });
  expect(screen.getByRole("status").textContent).toBe(tr("size.salvo", { size: "G" }));
  fireEvent.click(screen.getByText(tr("size.tabela")));
  const table = screen.getByRole("table");
  expect(within(table).getByRole("rowheader", { name: "G (L)" }).closest("tr")!.textContent).toBe("G (L)988010" + "6");
  expect(calls).toEqual([]);
});

it("calçado usa a numeração; acessório não tem tamanho", async () => {
  mockApi({});
  renderApp(<ProductFitDialog product={{ id: "s1", productName: "Tênis", category: "shoes_piece", subcategory: "casual_sneakers" }} open onClose={vi.fn()} />);
  const radios = within(await screen.findByRole("radiogroup")).getAllByRole("radio");
  expect([radios[0].textContent, radios.at(-1)!.textContent]).toEqual(["3333", "4646"]);
  cleanup();
  renderApp(<ProductFitDialog product={{ id: "a1", productName: "Boné", category: "accessory_piece", subcategory: "cap" }} open onClose={vi.fn()} />);
  expect((await screen.findByRole("status")).textContent).toBe(tr("size.sem_grade"));
  expect(screen.queryByRole("radiogroup")).toBeNull();
});

it("Meus tamanhos: o corpo do avatar marca o tamanho dele e a escolha diz como fica", async () => {
  mockApi({ "GET /api/try-on": { sex: "FEMININO", mannequin: { sex: "FEMININO", build: "MEDIUM" }, pieces: {}, avatar: { model: { sex: "FEMININO" } } } });
  renderApp(<FitPage />);
  expect(await screen.findByText(tr("size.avatar_veste", { size: "M" }))).toBeTruthy();
  const letters = screen.getByRole("radiogroup", { name: tr("size.grade.letter") });
  expect(within(letters).getByRole("radio", { name: new RegExp(tr("size.do_avatar")) }).textContent?.startsWith("M")).toBe(true);
  expect(within(letters).getByRole("radio", { name: /^M / }).getAttribute("aria-checked")).toBe("true");      // sem escolha: o do avatar
  fireEvent.click(within(letters).getByRole("radio", { name: /^GG/ }));
  await waitFor(() => expect(screen.getByText(tr("size.fit.corpo.oversized", { natural: "M" }))).toBeTruthy());
  expect(readMySizes()).toEqual({ letter: "GG" });
  const shoes = screen.getByRole("radiogroup", { name: tr("size.grade.shoes") });
  expect(within(shoes).getByRole("radio", { name: new RegExp(tr("size.do_avatar")) }).textContent?.startsWith("37")).toBe(true);
  fireEvent.click(within(shoes).getByRole("radio", { name: /^35/ }));
  await waitFor(() => expect(screen.getByText(tr("size.fit.pe.tight", { natural: "37" }))).toBeTruthy());
});

it("Meus tamanhos sem avatar: a grade continua escolhível e o convite para criar o avatar aparece", async () => {
  mockApi({ "GET /api/try-on": { sex: "MASCULINO", mannequin: { sex: "MASCULINO", build: "MEDIUM" }, pieces: {}, avatar: null } });
  renderApp(<FitPage />);
  expect(await screen.findByText(tr("size.sem_avatar"), { exact: false })).toBeTruthy();
  const numeric = screen.getByRole("radiogroup", { name: tr("size.grade.numeric") });
  expect(within(numeric).getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
  fireEvent.click(within(numeric).getByRole("radio", { name: /^42/ }));
  expect(readMySizes()).toEqual({ numeric: "42" });
});
