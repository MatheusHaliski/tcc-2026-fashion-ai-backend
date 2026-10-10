// @vitest-environment jsdom
/** Deploy novo com a página aberta: um pedaço do build antigo some; recarrega uma vez (no máximo a cada 30 s). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnceForChunk, retryImport } from "./chunk-recovery";

const reload = vi.fn();
Object.defineProperty(window, "location", { value: { ...window.location, reload }, configurable: true });
afterEach(() => { sessionStorage.clear(); reload.mockClear(); vi.useRealTimers(); });

describe("recuperação de pedaço do build que sumiu", () => {
  it("reconhece as mensagens de pedaço que não carregou", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "x" })).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 123 failed"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("outro erro"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("recarrega uma vez e não de novo antes de 30 s", () => {
    expect(reloadOnceForChunk()).toBe(true);
    expect(reloadOnceForChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("nova tentativa de import: sucesso na segunda; pedaço sumido recarrega; outro erro passa adiante", async () => {
    vi.useFakeTimers();
    let n = 0;
    const flaky = retryImport(async () => { if (n++ === 0) throw new Error("rede"); return "ok"; }, 10);
    await vi.advanceTimersByTimeAsync(20);
    await expect(flaky).resolves.toBe("ok");

    const gone = retryImport(async () => { throw new Error("Loading chunk 9 failed"); }, 10);
    gone.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(20);
    expect(reload).toHaveBeenCalledTimes(1);

    sessionStorage.clear();
    const other = retryImport(async () => { throw new Error("quebrou"); }, 10);
    const settled = other.catch((e) => e);
    await vi.advanceTimersByTimeAsync(20);
    expect(String(await settled)).toContain("quebrou");
  });
});
