// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/i18n";
import { fitVerdict } from "@/lib/tryon/sizes";
import { SizePicker } from "./size-picker";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
afterEach(cleanup);
const OPTIONS = ["PP", "P", "M", "G", "GG", "XG"].map((label) => ({ label }));
const ui = (feedback: ReturnType<typeof fitVerdict>, personalized = true, grid: "letter" | "shoes" = "letter") => render(
  <I18nProvider initial="pt-BR"><SizePicker grid={grid} options={grid === "shoes" ? [{ label: "37" }, { label: "38" }] : OPTIONS} chosen="M" natural="G" fit="tight" feedback={feedback} personalized={personalized} label="Tamanho" onPick={() => {}} /></I18nProvider>);

describe("retorno de caimento no provador", () => {
  it("vestiu bem, no comprimento", () => {
    ui(fitVerdict("letter", { chest: 0, waist: 0.2, length: 0 }));
    expect(screen.getByRole("status").textContent).toBe("Vestiu bem");
    expect(screen.getByText("Peito: vestiu bem")).toBeTruthy(); expect(screen.getByText("Comprimento: na medida")).toBeTruthy();
    expect(screen.getByText("Seu avatar veste G")).toBeTruthy();
  });
  it("apertado no peito e na cintura, e comprido", () => {
    ui(fitVerdict("letter", { chest: -1.5, waist: -2, length: 1.2 }));
    expect(screen.getByRole("status").textContent).toBe("Ficou apertado no peito e na cintura · fica comprido");
    expect(screen.getByText("Cintura: apertado")).toBeTruthy(); expect(screen.getByText("Comprimento: comprido")).toBeTruthy();
  });
  it("justo no quadril; sem medidas pessoais, convite para Meu Avatar", () => {
    ui(fitVerdict("numeric", { waist: 0, hip: -0.6, length: 0 }), false);
    expect(screen.getByRole("status").textContent).toBe("Está justo no quadril");
    expect(screen.getByRole("link", { name: /Informe altura e peso em Meu Avatar/ }).getAttribute("href")).toBe("/avatar#medidas");
  });
  it("calçado: só a frase, sem lista de regiões", () => {
    ui(fitVerdict("shoes", { foot: 1.8 }), true, "shoes");
    expect(screen.getByRole("status").textContent).toBe("Ficou folgado no pé");
    expect(screen.getByText("Seu avatar calça G")).toBeTruthy();
    expect(screen.queryByText(/Pé:/)).toBeNull();
  });
});
