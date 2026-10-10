// @vitest-environment jsdom
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor, ME } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import BrandPage from "@/app/(site)/(app)/brands/[slug]/page";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";
import DashboardPage from "@/app/(site)/(app)/dashboard/page";
import { __resetHypeGroupStore } from "@/lib/hype/use-hype-group";

const celeb = { ...ME, user: { ...ME.user, id: "c1", username: "celebteste1", displayName: "Celebridade001", profileType: "CELEBRIDADE" as const, verified: true } };
const profile = (approved = true) => ({ header: { userId: "c1", username: "celebteste1", slug: "celebridade001", name: "Celebridade001", kind: "CELEBRIDADE", status: approved ? "Verificada" : "PENDENTE", following: 0, activeSeals: 0, viewerFollows: false }, mode: "ADMINISTRADOR" });
const review = (approved = true) => ({ profileType: "CELEBRIDADE", name: "Celebridade001", slug: "celebridade001", status: approved ? "APROVADO" : "PENDENTE", emailVerified: true, adminsNotified: true, attempts: 1, maxAttempts: 5, slaBusinessDays: 3, reasons: [], checks: [], editable: {}, verificationCode: "FAI-CELEB" });
const params = <T extends object>(value: T) => Object.assign(Promise.resolve(value), { status: "fulfilled", value });
const routes = { "GET /api/institutional/celebridade001": profile(), "GET /api/me/issuer-review": review(), "GET /api/users/c1/seals": [], "GET /api/users/c1/promotions": [], "GET /api/institutional/celebridade001/tabs/ESQUEMAS_DESTAQUE": [] };
const officialPage = () => <Suspense fallback={null}><BrandPage params={params({ slug: "celebridade001" })} /></Suspense>;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); nav.search = new URLSearchParams(); __resetHypeGroupStore(); });

describe("perfil de celebridade após a aprovação", () => {
  it("link antigo CENTRAL abre o perfil sem critérios, prazos ou dashboards redundantes", async () => {
    nav.search = new URLSearchParams("tab=CENTRAL&origem=notificacao");
    const api = loggedAs(celeb, routes);
    renderApp(officialPage());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/brands/celebridade001?origem=notificacao", { scroll: false }));
    expect(screen.queryByText("Status da verificação")).toBeNull();
    expect(screen.queryByText("Critérios da verificação")).toBeNull();
    expect(screen.queryByText("Prazos e regras")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Central do emissor" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Central do emissor/ })).toBeNull();
    expect(screen.getByRole("tab", { name: "Looks em destaque" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: /Selos/ }));
    expect(await screen.findByRole("button", { name: "Novo selo" })).toBeTruthy();
    expect(api.calls.some(c => c.path.startsWith("/api/me/issuer-dashboard"))).toBe(false);
  });

  it("reconhece aprovação do administrador ao voltar à página sem novo login", async () => {
    let approved = false;
    const api = loggedAs({ ...celeb, user: { ...celeb.user, verified: false }, status: "PENDING_VALIDATION" }, {
      ...routes, "GET /api/institutional/celebridade001": () => profile(approved), "GET /api/me/issuer-review": () => review(approved),
    });
    renderApp(officialPage());
    expect(await screen.findByText("Status da verificação")).toBeTruthy();
    const meRequests = api.calls.filter(c => c.path === "/api/me").length;
    approved = true;
    fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Central do emissor" })).toBeNull());
    await waitFor(() => expect(api.calls.filter(c => c.path === "/api/me").length).toBeGreaterThan(meRequests));
    expect(screen.queryByText("Critérios da verificação")).toBeNull();
    expect(screen.getByRole("tab", { name: "Looks em destaque" }).getAttribute("aria-selected")).toBe("true");
  });

  it("o perfil público aprovado abre sem ferramentas exclusivas do dono", async () => {
    const api = mockApi({ ...routes, "GET /api/institutional/celebridade001": { ...profile(), mode: "VISITANTE" } });
    renderApp(officialPage());
    expect(await screen.findByRole("tab", { name: "Looks consagrados" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Métricas" })).toBeNull();
    expect(api.calls.some(c => c.path === "/api/me/issuer-review")).toBe(false);
  });

  it("Meu perfil usa o slug oficial e mantém a aba pedida, mesmo com username diferente", async () => {
    nav.search = new URLSearchParams("tab=SELOS");
    loggedAs(celeb, { "GET /api/profiles/celebteste1": { user: celeb.user, layout: "INSTITUCIONAL", institutionalSlug: "celebridade001" } });
    renderApp(<Suspense fallback={null}><ProfilePage params={params({ username: "celebteste1" })} /></Suspense>);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/brands/celebridade001?tab=SELOS"));
  });

  it("API antiga sem slug usa o id aceito pelo perfil oficial", async () => {
    loggedAs(celeb, { "GET /api/profiles/celebteste1": { user: celeb.user, layout: "INSTITUCIONAL" } });
    renderApp(<Suspense fallback={null}><ProfilePage params={params({ username: "celebteste1" })} /></Suspense>);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/brands/c1"));
  });

  it("conta pessoal que abre o painel antigo segue para seu perfil", async () => {
    const api = loggedAs();
    renderApp(<DashboardPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/lookbook"));
    expect(api.calls.some(c => c.path === "/api/me/issuer-review")).toBe(false);
  });

  it.each([true, false])("painel antigo leva à gestão do perfil (aprovado=%s)", async approved => {
    const api = loggedAs(celeb, { "GET /api/me/issuer-review": review(approved) });
    renderApp(<DashboardPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/brands/celebridade001?tab=${approved ? "METRICAS" : "CENTRAL"}`));
    expect(api.calls.some(c => c.path.startsWith("/api/me/issuer-dashboard"))).toBe(false);
  });
});
