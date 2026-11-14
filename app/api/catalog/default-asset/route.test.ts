/**
 * Regressão da auditoria: com mais de 4 ilustrações diferentes pedidas ao mesmo tempo (a grade do guarda-roupa), a
 * rota respondia 503 e a tag <img> ficava quebrada. Agora o pedido espera uma vaga de renderização.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const render = vi.hoisted(() => ({ running: 0, peak: 0, calls: 0 }));
vi.mock("@/lib/catalog/default-asset-render", () => ({
  renderDefaultAsset: async (_category: string, subcategory: string) => {
    render.calls++;
    render.running++;
    render.peak = Math.max(render.peak, render.running);
    await new Promise((resolve) => setTimeout(resolve, 15));
    render.running--;
    return Buffer.from(`png:${subcategory}`);
  },
}));

import { GET } from "./route";

afterEach(() => { render.running = 0; render.peak = 0; render.calls = 0; });

const ask = (subcategory: string) => GET(new Request(`http://localhost/api/catalog/default-asset?category=upper_piece&subcategory=${subcategory}&color=%23c62b28&framing=WHOLE`));

describe("GET /api/catalog/default-asset", () => {
  it("dez ilustrações diferentes ao mesmo tempo: todas respondem 200, com no máximo 4 renderizações simultâneas", async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => ask(`fila_${i}`)));
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));
    expect(render.peak).toBeLessThanOrEqual(4);
    expect(await responses[9].text()).toBe("png:fila_9");
  });

  it("a mesma ilustração pedida várias vezes renderiza uma vez e depois vem do cache", async () => {
    const responses = await Promise.all([ask("repetida"), ask("repetida"), ask("repetida")]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(render.calls).toBe(1);
    expect((await ask("repetida")).status).toBe(200);
    expect(render.calls).toBe(1);
  });
});
