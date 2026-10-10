// @vitest-environment jsdom
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import BrandPage from "@/app/(site)/(app)/brands/[slug]/page";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); tokenStore.clear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });
it("o emissor revisa uma peça direta pelo nome e endereço da peça", async () => {
  tokenStore.clear(); nav.search = new URLSearchParams("tab=REVISAO");
  const issuer = { ...ME, user: { ...ME.user, id: "issuer", profileType: "CELEBRIDADE" as const, verified: true } };
  const api = loggedAs(issuer, {
    "GET /api/institutional/shakira": { header: { userId: "issuer", name: "Shakira", kind: "CELEBRIDADE", status: "Verificada", following: 0, activeSeals: 1 }, mode: "ADMINISTRADOR" },
    "GET /api/me/issuer-review": { status: "APROVADO" },
    "GET /api/users/issuer/seals": [], "GET /api/users/issuer/promotions": [],
    "GET /api/seal-bonds/review-queue": [{ id: "bond1", scheme: null, piece: { id: "p1", name: "Camiseta azul", owner: ME.user, visibility: "PUBLIC" }, requestedBy: ME.user, seal: { name: "Hype azul" } }],
    "POST /api/seal-bonds/bond1/review": {},
  });
  const params = Object.assign(Promise.resolve({ slug: "shakira" }), { status: "fulfilled", value: { slug: "shakira" } });
  renderApp(<Suspense fallback={null}><BrandPage params={params} /></Suspense>);
  expect(await screen.findByText("Camiseta azul")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver peça" }).getAttribute("href")).toBe("/pieces/p1");
  expect(screen.queryByRole("link", { name: "Ver look" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
  await waitFor(() => expect(api.calls.find((call) => call.path === "/api/seal-bonds/bond1/review")?.body).toEqual({ approve: true, reason: null }));
});
