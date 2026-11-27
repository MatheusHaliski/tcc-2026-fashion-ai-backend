// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { revealHypePreview, revealHypePreviewSoon } from "./reveal-preview";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("Arte do card › prévia do AURA Hype", () => {
  it("rola a prévia até o painel de Hype", () => {
    document.body.innerHTML = '<aside class="pae-preview"><div class="foto"></div><span class="fashion-hype-metadata"></span></aside>';
    const panel = document.querySelector<HTMLElement>(".fashion-hype-metadata")!;
    panel.scrollIntoView = vi.fn();
    expect(revealHypePreview()).toBe(true);
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });

  it("sem painel na prévia (fora do editor) não faz nada", () => {
    document.body.innerHTML = '<span class="fashion-hype-metadata"></span>';
    expect(revealHypePreview()).toBe(false);
  });

  it("espera a prévia redesenhar antes de rolar", () => {
    vi.useFakeTimers();
    revealHypePreviewSoon(250);
    document.body.innerHTML = '<aside class="pae-preview"><dl class="fashion-hype-matrix"></dl></aside>';
    const panel = document.querySelector<HTMLElement>(".fashion-hype-matrix")!;
    panel.scrollIntoView = vi.fn();
    vi.advanceTimersByTime(260);
    expect(panel.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
