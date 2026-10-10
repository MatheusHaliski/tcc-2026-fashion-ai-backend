// @vitest-environment jsdom
/** Modelo 3D da peça (RF16) que não carrega: o aviso aparece no lugar da cena (o Canvas aqui não desenha nada). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

vi.mock("@react-three/fiber", async (importOriginal) => ({ ...(await importOriginal<typeof import("@react-three/fiber")>()), Canvas: () => null }));

import { cleanup, renderApp, screen, waitFor } from "@/test-utils/render";
import PieceModelViewer from "./piece-model-viewer";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("modelo 3D da peça", () => {
  it("falha no carregamento mostra o aviso", async () => {
    vi.spyOn(GLTFLoader.prototype, "load").mockImplementation((_u, _ok, _p, onError) => { onError?.(new Error("404") as never); });
    renderApp(<PieceModelViewer url="/media/quebrado.glb" name="Camiseta" />);
    await waitFor(() => expect(screen.getByText(/carregar/i)).toBeTruthy());
  });
});
