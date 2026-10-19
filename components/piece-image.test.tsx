// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { PieceImage, useImageBatch } from "./piece-image";
import { clearImageCache, preloadImage } from "@/lib/image-preload";

let requests: string[] = [];
let failing = new Set<string>();
let failOnce = new Set<string>();
let release: (() => void) | null = null;
let gate: Promise<void> | null = null;

class FakeImage {
  decoding = "";
  src = "";
  decode() {
    requests.push(this.src);
    const url = this.src;
    const run = () => {
      if (failOnce.delete(url) || failing.has(url)) return Promise.reject(new Error("x"));
      return Promise.resolve();
    };
    return gate ? gate.then(run) : run();
  }
}

beforeEach(() => {
  requests = []; failing = new Set(); failOnce = new Set(); gate = null; release = null;
  clearImageCache();
  vi.stubGlobal("Image", FakeImage);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const state = (c: HTMLElement) => c.querySelector(".piece-image")!.getAttribute("data-state");

describe("PieceImage / preload", () => {
  it("mantém o skeleton até a imagem ser decodificada", async () => {
    gate = new Promise<void>((r) => { release = r; });
    const { container } = render(<PieceImage sources={["/a.jpg"]} />);
    expect(state(container)).toBe("loading");
    expect(container.querySelector("img")).toBeNull();
    await act(async () => { release!(); });
    await waitFor(() => expect(state(container)).toBe("ready"));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/a.jpg");
  });

  it("cacheia por URL: não baixa de novo", async () => {
    await preloadImage("/b.jpg");
    await preloadImage("/b.jpg");
    const { container } = render(<PieceImage sources={["/b.jpg"]} />);
    expect(state(container)).toBe("ready");
    expect(requests.filter((u) => u === "/b.jpg")).toHaveLength(1);
  });

  it("faz retry antes de desistir", async () => {
    failOnce.add("/c.jpg");
    expect(await preloadImage("/c.jpg")).toBe(true);
    expect(requests.filter((u) => u === "/c.jpg")).toHaveLength(2);
  });

  it("usa fallback: thumbnail, original e depois placeholder", async () => {
    // Dois fallbacks esgotam 900 ms de backoff: avance o relógio em vez de
    // disputar o timeout real de 1 s do waitFor com os demais testes do CI.
    vi.useFakeTimers();
    failing.add("/thumb.jpg");
    const { container, rerender } = render(<PieceImage sources={["/thumb.jpg", "/orig.jpg"]} />);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/orig.jpg");
    failing.add("/orig2.jpg");
    rerender(<PieceImage sources={["/thumb.jpg", "/orig2.jpg"]} />);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(state(container)).toBe("fallback");
    expect(requests.filter((url) => url === "/orig2.jpg")).toHaveLength(3);
    expect(container.querySelector("img")).toBeNull();
  });

  it("revela o lote de forma coordenada", async () => {
    gate = new Promise<void>((r) => { release = r; });
    function Grid() {
      const ready = useImageBatch([["/g1.jpg"], ["/g2.jpg"]]);
      return <div>{["/g1.jpg", "/g2.jpg"].map((u) => <PieceImage key={u} sources={[u]} hold={!ready} />)}</div>;
    }
    const { container } = render(<Grid />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    await act(async () => { release!(); });
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(2));
  });
});
