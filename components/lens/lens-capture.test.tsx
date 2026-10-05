// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { page } from "@/test-utils/fixtures";

// tests rodam no jsdom, sem MediaPipe nem canvas: a proteção dos rostos é simulada
const redact = vi.hoisted(() => ({ redactFaces: vi.fn() }));
vi.mock("@/lib/lens/redact", () => redact);

import { LensCapture } from "@/components/lens/lens-capture";
import LensPage from "@/app/(site)/(app)/lens/page";

const photo = () => new File([new Uint8Array([1, 2, 3])], "rua.jpg", { type: "image/jpeg" });
const SCAN_CARD = { id: "s1", createdAt: new Date().toISOString(), savedAt: null, status: "READY", detections: 3, topStyle: "casual", owned: 2, gaps: 1 };

beforeEach(() => { router.push.mockClear(); router.replace.mockClear(); redact.redactFaces.mockReset(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Lens › captura", () => {
  it("a página exige login e mostra Câmera · Galeria · Recentes com a explicação closet-first", async () => {
    loggedAs();
    renderApp(<LensPage />);
    expect(await screen.findByRole("heading", { name: "FashionAI Lens" })).toBeTruthy();
    expect(screen.getByText(/primeiro mostramos o que você já tem/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Câmera" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Galeria" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Recentes" })).toBeTruthy();
    // câmera = input com capture="environment" (sem getUserMedia no MVP)
    const input = screen.getByLabelText("Tirar foto") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.getAttribute("capture")).toBe("environment");
    expect(input.getAttribute("accept")).toBe("image/*");
  });

  it("foto → rostos borrados → Analisar envia multipart e abre o resultado", async () => {
    const blob = new Blob(["redigida"], { type: "image/jpeg" });
    redact.redactFaces.mockResolvedValue({ blob, faces: 2, width: 800, height: 1000 });
    const api = loggedAs(undefined, { "POST /api/lens/scans": { id: "s9", status: "READY" } });
    renderApp(<LensCapture />);
    await settle();
    fireEvent.change(screen.getByLabelText("Tirar foto"), { target: { files: [photo()] } });
    expect(await screen.findByText("2 rostos borrados no seu aparelho antes do envio.")).toBeTruthy();
    expect(redact.redactFaces).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/lens/s9"));
    const post = api.calls.find((c) => c.method === "POST" && c.path === "/api/lens/scans")!;
    const form = post.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("source")).toBe("CAMERA");
    expect(form.get("intent")).toBe("IDENTIFY");
    expect(form.get("facesRedacted")).toBe("2");
    expect(form.get("redactionConfirmed")).toBe("true");                     // borrão feito no aparelho
    expect(form.get("image")).toBeInstanceOf(Blob);
  });

  it("sem detector (faces = -1) o envio exige a confirmação explícita", async () => {
    redact.redactFaces.mockResolvedValue({ blob: new Blob(["x"]), faces: -1, width: 0, height: 0 });
    const api = loggedAs(undefined, { "POST /api/lens/scans": { id: "s10", status: "READY" } });
    renderApp(<LensCapture />);
    await settle();
    fireEvent.click(screen.getByRole("radio", { name: "Galeria" }));
    expect(router.replace).toHaveBeenCalledWith("/lens?view=gallery", { scroll: false });
    fireEvent.change(screen.getByLabelText("Escolher da galeria"), { target: { files: [photo()] } });
    expect(await screen.findByText(/Não foi possível verificar rostos neste aparelho/)).toBeTruthy();
    const analyze = screen.getByRole("button", { name: "Analisar" }) as HTMLButtonElement;
    expect(analyze.disabled).toBe(true);
    fireEvent.click(analyze);
    expect(api.calls.some((c) => c.path === "/api/lens/scans")).toBe(false);
    fireEvent.click(screen.getByLabelText("Confirmo que a foto não mostra o rosto de ninguém (ou que já recortei)"));
    expect(analyze.disabled).toBe(false);
    fireEvent.click(analyze);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/lens/s10"));
    const form = api.calls.find((c) => c.method === "POST" && c.path === "/api/lens/scans")!.body as FormData;
    expect(form.get("source")).toBe("GALLERY");
    expect(form.get("redactionConfirmed")).toBe("true");
    expect(form.get("facesRedacted")).toBe("0");
  });

  it("cota do dia: o erro é explicado em texto e nada é aberto", async () => {
    redact.redactFaces.mockResolvedValue({ blob: new Blob(["x"]), faces: 0, width: 10, height: 10 });
    loggedAs(undefined, { "POST /api/lens/scans": () => new Response(JSON.stringify({ status: 429, code: "LENS_QUOTA", message: "cota" }), { status: 429, headers: { "content-type": "application/json" } }) });
    renderApp(<LensCapture />);
    await settle();
    fireEvent.change(screen.getByLabelText("Tirar foto"), { target: { files: [photo()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Analisar" }));
    expect(await screen.findByText(/A cota diária de scans acabou/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Recentes lista os scans e o filtro Salvos restringe a lista", async () => {
    nav.search = new URLSearchParams("view=recent");
    const api = loggedAs(undefined, { "GET /api/me/lens/scans": (url: URL) => (url.searchParams.get("saved") === "true" ? page([]) : page([SCAN_CARD])) });
    renderApp(<LensCapture />);
    expect(await screen.findByText("3 peças · Casual · 2 no seu guarda-roupa")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir scan de/ }).getAttribute("href")).toBe("/lens/s1");
    fireEvent.click(screen.getByRole("button", { name: "Só salvos" }));
    expect(await screen.findByText("Nenhuma inspiração salva")).toBeTruthy();
    expect(api.calls.some((c) => c.path.startsWith("/api/me/lens/scans?saved=true"))).toBe(true);
  });
});
