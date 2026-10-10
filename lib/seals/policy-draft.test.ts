import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api/client";
import { requestSealPolicyDraft } from "./policy-draft";
afterEach(() => { vi.restoreAllMocks(); });
describe("rota de rascunhos do Copilot", () => {
  it("envia o mesmo contexto ao alias apenas quando a rota estável retorna404", async () => {
    const payload = { tier: "LOOK", message: "#createsealpolicy Azul", conversation: [{ role: "user", text: "Duas peças" }] };
    const post = vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(404, "NAO_ENCONTRADO", "ausente")).mockResolvedValueOnce({ status: "VALID" });
    expect(await requestSealPolicyDraft(payload)).toEqual({ status: "VALID" });
    expect(post.mock.calls).toEqual([["/api/seals/draft", payload], ["/api/copilot/seal-policy", payload]]);
  });
  it("não repete inferência após uma falha503", async () => {
    const failure = new ApiError(503, "AI_UNAVAILABLE", "indisponível");
    const post = vi.spyOn(api, "post").mockRejectedValue(failure);
    await expect(requestSealPolicyDraft({ message: "Azul" })).rejects.toBe(failure);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
