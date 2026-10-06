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
  // contexto 2D falso: texturas desenhadas em canvas (rótulos 3D, passarela, cartazes) rodam sem desenhar nada.
  // WebGL continua indisponível (null), como num navegador sem GPU; as cenas 3D usam o renderizador de teste.
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    if (kind !== "2d") return null;
    const canvas = this;
    const state: Record<string, unknown> = { canvas, fillStyle: "#000", strokeStyle: "#000", font: "10px sans-serif", globalAlpha: 1, lineWidth: 1 };
    const noop = () => undefined;
    return new Proxy(state, {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === "measureText") return (t: string) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
        if (key === "getImageData" || key === "createImageData") return (_x: number, _y: number, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
        if (key === "createLinearGradient" || key === "createRadialGradient" || key === "createPattern" || key === "createConicGradient") return () => ({ addColorStop: noop });
        if (key === "isPointInPath") return () => false;
        return noop;
      },
      set(target, key: string, value) { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    void realGetContext; void rest;
  } as typeof HTMLCanvasElement.prototype.getContext;
  if (!HTMLCanvasElement.prototype.toDataURL || HTMLCanvasElement.prototype.toDataURL.length >= 0) {
    HTMLCanvasElement.prototype.toDataURL = function toDataURL() { return "data:image/png;base64,"; };
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
