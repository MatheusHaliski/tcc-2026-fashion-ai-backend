import { describe, expect, it } from "vitest";
import { looksLikeUserAgent, parseSessionDevice } from "./session-device";

/** Regressão da auditoria: a lista de sessões mostrava o texto bruto do navegador. */
describe("aparelho da sessão", () => {
  it("reconhece navegador e sistema nos User-Agents comuns", () => {
    expect(parseSessionDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")).toEqual({ browser: "Chrome", system: "Windows" });
    expect(parseSessionDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({ browser: "Safari", system: "iPhone" });
    expect(parseSessionDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0")).toEqual({ browser: "Firefox", system: "Mac" });
    expect(parseSessionDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0")).toEqual({ browser: "Edge", system: "Windows" });
    expect(parseSessionDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36")).toEqual({ browser: "Chrome", system: "Android" });
  });

  it("texto que não é User-Agent não é interpretado", () => {
    expect(looksLikeUserAgent("Celular")).toBe(false);
    expect(looksLikeUserAgent(null)).toBe(false);
    expect(looksLikeUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe(true);
    expect(parseSessionDevice("")).toEqual({ browser: null, system: null });
  });
});
