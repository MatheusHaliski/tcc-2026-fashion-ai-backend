// @vitest-environment jsdom
/**
 * ArtVideo (Auras em vídeo): trocar de Aura com o card perto da tela troca o vídeo — antes o arquivo anterior ficava
 * carregado e o card seguia tocando a Aura antiga com o pôster da nova.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ArtVideo } from "./card-art";

class NearIO {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", NearIO);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ArtVideo", () => {
  it("troca o arquivo quando a Aura muda com o card perto da tela", () => {
    const { container, rerender } = render(<ArtVideo src="/aura/a.mp4" poster="/aura/a.webp" />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/aura/a.mp4");
    rerender(<ArtVideo src="/aura/b.mp4" poster="/aura/b.webp" />);
    expect(video.getAttribute("src")).toBe("/aura/b.mp4");
    expect(video.getAttribute("poster")).toBe("/aura/b.webp");
  });

  it("desmontar solta o arquivo e o aviso de bloqueio", () => {
    const onStuck = vi.fn();
    const { container, unmount } = render(<ArtVideo src="/aura/a.mp4" onStuck={onStuck} />);
    const video = container.querySelector("video")!;
    unmount();
    expect(video.getAttribute("src")).toBeNull();
    expect(onStuck).toHaveBeenLastCalledWith(false);
  });
});
