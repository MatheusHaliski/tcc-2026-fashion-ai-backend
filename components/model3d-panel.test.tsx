// @vitest-environment jsdom
/**
 * RF16 — useModel3d com outra peça no mesmo componente (a linha do provador, o detalhe trocando de peça): o estado é da
 * peça que o pediu. Volta a "sem resposta" até a da peça nova chegar, descarta a resposta atrasada da anterior e não
 * avisa "Modelo 3D pronto" pela anterior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { useModel3d } from "@/components/model3d-panel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Probe({ id }: { id: string }) {
  const model = useModel3d(id, { enabled: true });
  return <p data-testid="st">{model.st ? `${id}:${model.st.status}` : "sem resposta"}</p>;
}
const shown = () => screen.getByTestId("st").textContent;

describe("useModel3d — troca de peça", () => {
  it("volta a sem resposta até a peça nova responder e descarta a resposta atrasada da anterior", async () => {
    const { fetchMock } = loggedAs(undefined, { "GET /api/pieces/a/model3d": { status: "QUEUED" }, "GET /api/pieces/b/model3d": { status: "COMPLETED", modelUrl: "/media/b.glb" } });
    // a resposta da peça "a" só chega quando liberada (depois da troca)
    let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/pieces/a/model3d")) await gate;
      return fetchMock(input, init);
    }));
    const { rerender } = renderApp(<Probe id="a" />);
    expect(shown()).toBe("sem resposta");
    rerender(<Probe id="b" />);
    await waitFor(() => expect(shown()).toBe("b:COMPLETED"));
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 30)); });
    expect(shown()).toBe("b:COMPLETED");
  });

  it("trocar de uma peça na fila para uma pronta não avisa Modelo 3D pronto", async () => {
    loggedAs(undefined, { "GET /api/pieces/a/model3d": { status: "QUEUED" }, "GET /api/pieces/b/model3d": { status: "COMPLETED", modelUrl: "/media/b.glb" } });
    const { rerender } = renderApp(<Probe id="a" />);
    await waitFor(() => expect(shown()).toBe("a:QUEUED"));
    rerender(<Probe id="b" />);
    expect(shown()).toBe("sem resposta");                                                   // nada da peça "a" na "b"
    await waitFor(() => expect(shown()).toBe("b:COMPLETED"));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(document.querySelector(".toast-success")).toBeNull();
  });
});
