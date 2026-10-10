// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { mockApi, renderApp } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import { __resetHypeGroupStore } from "@/lib/hype/use-hype-group";
import { PublicProfileCard } from "@/components/public-profile-card";
import type { PublicProfileSummary } from "@/lib/api/public-profiles";
import SearchPage from "@/app/(site)/(app)/search/page";

const profile: PublicProfileSummary = {
  id: "person-1", username: "ana", displayName: "Ana Souza", avatarUrl: "/photos/ana.jpg", coverUrl: "/photos/cover.jpg",
  profileType: "PESSOAL", country: "BR", verified: true, privateAccount: false, visibility: "PUBLIC", contentVisible: true,
  bio: "Designer de moda\nColeções para todas as pessoas.", pronouns: "ela/dela", links: [{ title: "Meu ateliê", url: "https://atelier.example" }],
  counters: { pieces: 18, schemes: 12, followers: 123, following: 0 },
};

beforeEach(() => {
  document.cookie = "fai_rt_h=; max-age=0; path=/";
  localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); __resetHypeGroupStore();
  nav.search = new URLSearchParams("tab=PESSOAS");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); __resetHypeGroupStore(); nav.search = new URLSearchParams(); });

function stat(card: HTMLElement, label: string) { return within(card).getByText(label, { exact: true }).parentElement?.querySelector("dd")?.textContent; }

describe("perfis completos na busca de pessoas", () => {
  it("mostra foto, capa, bio, pronomes, links, verificação, visibilidade e quatro contadores", async () => {
    const { calls } = mockApi({ "GET /api/search": { results: [profile], nextCursor: null } });
    renderApp(<SearchPage />);
    const card = await screen.findByRole("article", { name: "Perfil de Ana Souza" });
    expect(within(card).getByRole("img", { name: "Foto de perfil de Ana Souza" }).getAttribute("src")).toBe("/photos/ana.jpg");
    expect(card.querySelector('img[src="/photos/cover.jpg"]')).toBeTruthy();
    expect(within(card).getByText(profile.bio!, { normalizer: (text) => text })).toBeTruthy();
    expect(within(card).getByText("@ana")).toBeTruthy();
    expect(within(card).getByText("ela/dela")).toBeTruthy();
    expect(within(card).getByText("Brasil")).toBeTruthy();
    expect(within(card).getByText("Público")).toBeTruthy();
    expect(within(card).getByText("verificado")).toBeTruthy();
    expect(stat(card, "peças")).toBe("18"); expect(stat(card, "looks")).toBe("12");
    expect(stat(card, "seguidores")).toBe("123"); expect(stat(card, "seguindo")).toBe("0");
    const link = within(card).getByRole("link", { name: /Meu ateliê/ });
    expect(link.getAttribute("href")).toBe("https://atelier.example/");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(within(card).getByRole("link", { name: /Ver perfil/ }).getAttribute("href")).toBe("/u/ana");
    expect(calls.some((call) => call.path.startsWith("/api/profiles/") || call.path.startsWith("/api/u/"))).toBe(false);
    expect(card.querySelector("a a")).toBeNull();
  });

  it("torna a restrição visível sem fingir que um perfil privado é público", () => {
    mockApi(); renderApp(<PublicProfileCard profile={{ ...profile, visibility: "FOLLOWERS", contentVisible: false, relation: "PENDENTE" }} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Só para seguidores")).toBeTruthy();
    expect(within(card).getByText("Pedido enviado")).toBeTruthy();
    expect(within(card).getByText("As publicações deste perfil têm acesso restrito.")).toBeTruthy();
    expect(within(card).queryByText("Público")).toBeNull();
  });

  it("distingue totais ausentes de zero e usa monograma quando a foto falha", () => {
    mockApi(); renderApp(<PublicProfileCard profile={{ ...profile, counters: undefined }} />);
    const card = screen.getByRole("article");
    expect(stat(card, "seguidores")).toBe("—");
    fireEvent.error(screen.getByRole("img", { name: "Foto de perfil de Ana Souza" }));
    expect(screen.queryByRole("img", { name: "Foto de perfil de Ana Souza" })).toBeNull();
    expect(within(card).getByText("AS")).toBeTruthy();
  });

  it("não transforma URLs executáveis ou com credenciais em links", () => {
    mockApi(); renderApp(<PublicProfileCard profile={{ ...profile, links: [
      { title: "inseguro", url: "javascript:alert(1)" }, { title: "dados", url: "data:text/html,<script>alert(1)</script>" },
      { title: "credenciais", url: "https://login:secret@atelier.example" }, { title: "seguro", url: "https://atelier.example/portfolio" },
    ] }} />);
    expect(screen.queryByRole("link", { name: /inseguro|dados|credenciais/ })).toBeNull();
    expect(screen.getByRole("link", { name: /seguro/ }).getAttribute("href")).toBe("https://atelier.example/portfolio");
  });

  it("preserva o estado vazio da busca, em vez de inventar cartões", async () => {
    mockApi({ "GET /api/search": { results: [], nextCursor: null, empty: { message: "Nenhuma pessoa encontrada." } } });
    renderApp(<SearchPage />);
    expect(await screen.findByText("Nenhuma pessoa encontrada.")).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
