// @vitest-environment jsdom
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";
vi.mock("@/components/lookbook-tabs", () => ({ LookbookTabs: () => null }));
vi.mock("@/components/hype/hype-group-badge", () => ({ HypeGroupBadge: () => null }));
vi.mock("@/components/insights/insight-strip", () => ({ InsightStrip: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const person = { user: { ...ME.user, id: "other", username: "bia", displayName: "Bia" }, layout: "PESSOAL", self: false, relation: "NENHUMA", visibility: "PUBLIC", contentVisible: true, counters: { followers: 4, following: 2, published: 1, pieces: 3, schemes: 1 } };
const params = (value: { username: string }) => Object.assign(Promise.resolve(value), { status: "fulfilled", value });
function deferred() { let resolve!: (v: unknown) => void; let reject!: (v: Error) => void; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
describe("seguir perfil", () => {
  it.each(["PUBLIC", "FOLLOWERS"])("atualiza imediatamente e impede requisições duplicadas (%s)", async visibility => {
    const request = deferred(); 
    loggedAs(ME, { "GET /api/profiles/bia": { ...person, visibility }, "POST /api/users/other/followers": {} });
    let posts = 0;
    const fetchMock = fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/users/other/followers") && init?.method === "POST") {
        posts++;
        const response = await request.promise;
        return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
      }
      return fetchMock(input, init);
    });
    renderApp(<Suspense><ProfilePage params={params({ username: "bia" })} /></Suspense>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Seguir" }))[0]);
    const label = visibility === "PUBLIC" ? "Deixar de seguir" : "Solicitado";
    const button = screen.getAllByRole("button", { name: label })[0] as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(posts).toBe(1);
    await act(async () => { request.resolve({}); });
  });
  it("restaura o estado anterior quando o servidor recusa", async () => {
    const request = deferred();
    loggedAs(ME, { "GET /api/profiles/bia": person, "POST /api/users/other/followers": () => request.promise });
    let posts = 0;
    const fetchMock = fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/users/other/followers") && init?.method === "POST") {
        posts++;
        const response = await request.promise;
        return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
      }
      return fetchMock(input, init);
    });
    renderApp(<Suspense><ProfilePage params={params({ username: "bia" })} /></Suspense>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Seguir" }))[0]);
    expect(screen.getAllByRole("button", { name: "Deixar de seguir" })[0]).toBeTruthy();
    await act(async () => { request.reject(new Error("Recusado")); });
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Seguir" })[0] as HTMLButtonElement).disabled).toBe(false));
  });
});
