/**
 * APIs de navegador que o jsdom não tem e os componentes usam: rolagem até o item focado e observador de tamanho.
 * Só valem nos testes com `// @vitest-environment jsdom`; no ambiente node não há window.
 */
if (typeof window !== "undefined") {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
  }
}

// ---------------------------------------------------------------- Next.js fora do servidor do Next
import { vi } from "vitest";
import { createElement, type ReactNode } from "react";

/** Roteador falso: as telas navegam com push/replace; os testes conferem as chamadas em `router`. */
export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export const nav = { pathname: "/", search: new URLSearchParams(), params: {} as Record<string, string> };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
  useParams: () => nav.params,
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, replace: _r, scroll: _s, ...rest }: { href: string | { pathname?: string }; children?: ReactNode; [k: string]: unknown }) =>
    createElement("a", { href: typeof href === "string" ? href : href?.pathname ?? "#", ...rest }, children),
}));

// componentes carregados sob demanda (cenas 3D/WebGL): nos testes não carregam nada
vi.mock("next/dynamic", () => ({ default: () => function DynamicStub() { return null; } }));
