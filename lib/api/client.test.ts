// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Client = typeof import("./client");

/** Cada teste parte de um módulo novo: o access token vive em memória, no escopo do módulo. */
async function fresh(): Promise<Client> {
  vi.resetModules();
  return import("./client");
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie.split(";").forEach((c) => { document.cookie = `${c.split("=")[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; });
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("cliente da API (RF2: sessão, erros e renovação do token)", () => {
  it("GET com JSON: base da API, Accept-Language e Bearer quando há sessão", async () => {
    const { api, tokenStore, API_BASE } = await fresh();
    tokenStore.set("tok-1");
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.get("/api/me")).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/me`);
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(init.headers["Accept-Language"]).toBeTruthy();
  });

  it("rota anônima não manda Authorization; POST vai em JSON", async () => {
    const { api, tokenStore } = await fresh();
    tokenStore.set("tok-1");
    fetchMock.mockResolvedValueOnce(json(201, { id: "x" }));
    await api.post("/api/auth/register", { a: 1 }, { anonymous: true });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("upload manda FormData sem Content-Type (o navegador põe o boundary)", async () => {
    const { api } = await fresh();
    fetchMock.mockResolvedValueOnce(json(200, {}));
    const fd = new FormData(); fd.append("file", new Blob(["x"]), "a.jpg");
    await api.upload("/api/pieces/analysis", fd, "PUT");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(fd);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("204 volta vazio e resposta que não é JSON volta como Blob", async () => {
    const { api } = await fresh();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.delete("/api/pieces/1")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response("png", { status: 200, headers: { "content-type": "image/png" } }));
    const blob = await api.get<Blob>("/api/cards/1.png");
    expect(blob.type).toBe("image/png");   // Blob do fetch do Node (outro "realm" que o do jsdom): confere pelo tipo
    expect(blob.size).toBe(3);
  });

  it("put e patch enviam o corpo; sem corpo vai {}", async () => {
    const { api } = await fresh();
    fetchMock.mockImplementation(async () => json(200, {}));   // um Response novo por chamada
    await api.put("/api/x");
    await api.patch("/api/x", { f: true });
    expect(fetchMock.mock.calls[0][1].body).toBe("{}");
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  });

  it("erro do backend vira ApiError com código, detalhes, campos e correlationId", async () => {
    const { api, ApiError } = await fresh();
    fetchMock.mockResolvedValueOnce(json(422, { status: 422, code: "VALIDACAO", message: "Revise", details: { fields: { name: "obrigatório" } }, correlationId: "abc" }));
    const err = (await api.get("/api/x").catch((e: unknown) => e)) as InstanceType<Client["ApiError"]>;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("VALIDACAO");
    expect(err.fields).toEqual({ name: "obrigatório" });
    expect(err.correlationId).toBe("abc");
  });

  it("erro sem JSON usa o status HTTP; campos sem 'fields' usam os próprios detalhes", async () => {
    const { api, ApiError } = await fresh();
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502, statusText: "Bad Gateway" }));
    const err = (await api.get("/api/x").catch((e: unknown) => e)) as InstanceType<Client["ApiError"]>;
    expect(err.status).toBe(502);
    expect(err.code).toBe("ERRO");
    expect(new ApiError(400, "X", "m", { name: "curto" }).fields).toEqual({ name: "curto" });
    expect(new ApiError(400, "X", "m").fields).toEqual({});
  });

  it("falha de rede vira OFFLINE; cancelamento (AbortError) passa adiante", async () => {
    const { api } = await fresh();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.get("/api/x")).rejects.toMatchObject({ status: 0, code: "OFFLINE" });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValueOnce(abort);
    await expect(api.get("/api/x")).rejects.toBe(abort);
  });

  it("recusa caminhos com '..', barra invertida ou barra codificada", async () => {
    const { api } = await fresh();
    for (const p of ["/api/../admin", "/api/%2e%2e/x", "/api/a\\b", "/api/a%2Fb"]) {
      await expect(api.get(p)).rejects.toMatchObject({ code: "CAMINHO_INVALIDO" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 renova o token pelo BFF e repete a chamada uma vez", async () => {
    const { api, tokenStore } = await fresh();
    tokenStore.set("velho");
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "TOKEN_EXPIRADO" }))
      .mockResolvedValueOnce(json(200, { accessToken: "novo" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api.get("/api/me")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("/bff/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer novo");
    expect(tokenStore.access).toBe("novo");
  });

  it("401 sem conseguir renovar derruba a sessão e avisa quem escuta", async () => {
    const { api, tokenStore, onUnauthorized } = await fresh();
    tokenStore.set("velho");
    localStorage.setItem("fai.user", "{}");
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, { code: "NAO_AUTENTICADO" }));
    await expect(api.get("/api/me")).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.access).toBeNull();
    expect(localStorage.getItem("fai.user")).toBeNull();
    expect(listener).toHaveBeenCalled();
    off();
  });

  it("restoreSession: sem cookie-sinal não chama o BFF; com ele, restaura o token", async () => {
    let c = await fresh();
    await expect(c.restoreSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    document.cookie = "fai_rt_h=1; path=/";
    c = await fresh();
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: "restaurado" }));
    await expect(c.restoreSession()).resolves.toBe(true);
    expect(c.tokenStore.access).toBe("restaurado");
    await expect(c.restoreSession()).resolves.toBe(true);   // já com token: não chama de novo
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("migra o refresh token antigo do localStorage e apaga a cópia", async () => {
    localStorage.setItem("fai.refresh", "rt-antigo");
    localStorage.setItem("fai.access", "at-antigo");
    const c = await fresh();
    expect(c.tokenStore.restorable).toBe(true);
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: "migrado" }));
    await expect(c.restoreSession()).resolves.toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ migrateRefreshToken: "rt-antigo" });
    expect(localStorage.getItem("fai.refresh")).toBeNull();
  });

  it("renovação que responde sem accessToken ou com erro de rede falha sem lançar", async () => {
    document.cookie = "fai_rt_h=1; path=/";
    let c = await fresh();
    fetchMock.mockResolvedValueOnce(json(200, { outro: 1 }));
    await expect(c.restoreSession()).resolves.toBe(false);
    c = await fresh();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(c.restoreSession()).resolves.toBe(false);
  });

  it("cookie do gate vai no cabeçalho X-Dev-Gate, menos nas rotas do BFF", async () => {
    document.cookie = "fai_gate_a=abc%3D; path=/";
    const { api } = await fresh();
    fetchMock.mockImplementation(async () => json(200, {}));   // um Response novo por chamada
    await api.get("/api/me");
    await api.post("/bff/auth/logout");
    expect(fetchMock.mock.calls[0][1].headers["X-Dev-Gate"]).toBe("abc=");
    expect(fetchMock.mock.calls[1][1].headers["X-Dev-Gate"]).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toBe("/bff/auth/logout");
  });

  it("403 do gate renova o token curto e repete a chamada", async () => {
    const { api } = await fresh();
    fetchMock
      .mockResolvedValueOnce(json(403, { code: "GATE" }, { "X-Dev-Gate-Required": "1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(api.get("/api/me")).resolves.toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[1][0]).toBe("/gate/renew");
  });

  it("blobUrl pede imagem e devolve uma object URL", async () => {
    const { api } = await fresh();
    const created = vi.fn(() => "blob:fake");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created }));
    fetchMock.mockResolvedValueOnce(new Response("png", { status: 200, headers: { "content-type": "image/png" } }));
    await expect(api.blobUrl("/api/cards/1.png")).resolves.toBe("blob:fake");
    expect(fetchMock.mock.calls[0][1].headers.Accept).toContain("image/png");
  });
});

describe("utilitários de URL", () => {
  it("qs ignora vazios e repete arrays", async () => {
    const { qs } = await fresh();
    expect(qs({ a: 1, b: "", c: null, d: undefined, e: [], f: ["x", "y"], g: false })).toBe("?a=1&f=x&f=y&g=false");
    expect(qs({})).toBe("");
  });

  it("mediaUrl resolve /media no backend e deixa o resto como está", async () => {
    const { mediaUrl, API_BASE } = await fresh();
    expect(mediaUrl(undefined)).toBeUndefined();
    expect(mediaUrl("/media/a.png")).toBe(`${API_BASE}/media/a.png`);
    expect(mediaUrl("https://cdn/x.png")).toBe("https://cdn/x.png");
    expect(mediaUrl("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    expect(mediaUrl("/assets/x.png")).toBe("/assets/x.png");
  });

  it("thumbUrl e thumbSrcSet usam as miniaturas WebP das imagens padrão", async () => {
    const { thumbUrl, thumbSrcSet } = await fresh();
    const asset = "/assets_pecas/01_Parte_superior/01_camiseta_referencia.png";
    expect(thumbUrl(asset, 320)).toMatch(/-320\.webp$/);
    expect(thumbUrl(`${asset}?v=2`)).toMatch(/-640\.webp$/);
    expect(thumbSrcSet(asset)).toMatch(/320w, .*640w$/);
    expect(thumbUrl("/media/x.png")).toMatch(/\/media\/x\.png$/);
    expect(thumbSrcSet("/media/x.png")).toBeUndefined();
    expect(thumbUrl(null)).toBeUndefined();
    expect(thumbSrcSet(null)).toBeUndefined();
  });
});
