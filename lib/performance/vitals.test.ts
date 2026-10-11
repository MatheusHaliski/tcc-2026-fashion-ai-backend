import { describe, expect, it, vi, afterEach } from "vitest";
import { metricRoute, validVital } from "./vitals";
import { POST } from "@/app/bff/metrics/route";
afterEach(() => vi.unstubAllEnvs());
describe("performance sem dados pessoais", () => {
  it("retira parâmetros e identificadores de perfis e fotos", () => {
    expect(metricRoute("/u/matheus?token=secret")).toBe("/u/:id");
    expect(metricRoute("/lens/scans/abc")).toBe("/lens/scans/:id");
    expect(metricRoute("/schemes/new")).toBe("/schemes/new");
    expect(metricRoute("/u/name%40example.com")).toBe("/other");
  });
  it("recusa valores inválidos e propriedades extras", () => {
    const v = { name: "CLS", value: 0.02, route: "/u/:id", device: "mobile" };
    expect(validVital(v)).toBe(true);
    for (const bad of [{ ...v, value: NaN }, { ...v, value: -1 }, { ...v, token: "secret" }, { ...v, route: "/u/matheus" }, { ...v, name: "PASSWORD" }]) expect(validVital(bad)).toBe(false);
  });
  it("coleta só quando habilitada, na mesma origem e com corpo válido", async () => {
    const req = (body: string, origin = "https://fashion.example") => new Request("https://fashion.example/bff/metrics", { method: "POST", headers: { origin, "content-type": "application/json" }, body });
    const body = JSON.stringify({ name: "CLS", value: .02, route: "/feed", device: "mobile" });
    vi.stubEnv("NEXT_PUBLIC_RUM_ENABLED", "false");
    expect((await POST(req(body))).status).toBe(404);
    vi.stubEnv("NEXT_PUBLIC_RUM_ENABLED", "true");
    expect((await POST(req(body, "https://external.example"))).status).toBe(403);
    expect((await POST(req("{"))).status).toBe(400);
    expect((await POST(req("x".repeat(1100)))).status).toBe(413);
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try { expect((await POST(req(body))).status).toBe(204); expect(spy).toHaveBeenCalledWith(expect.stringContaining("fashionai.web_vital")); } finally { spy.mockRestore(); }
  });
});
