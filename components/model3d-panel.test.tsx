// @vitest-environment jsdom
/**
 * RF16 — useModel3d com outra peça no mesmo componente (a linha do provador, o detalhe trocando de peça): o estado é da
 * peça que o pediu. Volta a "sem resposta" até a da peça nova chegar, descarta a resposta atrasada da anterior e não
 * avisa "Modelo 3D pronto" pela anterior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { Model3dTechnical, fmtDuration, useModel3d } from "@/components/model3d-panel";

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

describe("tempo da geração 3D", () => {
  it("formata segundos, minutos e horas", () => {
    expect(fmtDuration(900)).toBe("1 s"); expect(fmtDuration(12_400)).toBe("12 s"); expect(fmtDuration(185_000)).toBe("3 min 05 s");
    expect(fmtDuration(3_720_000)).toBe("1 h 02 min"); expect(fmtDuration(null)).toBeNull(); expect(fmtDuration(-1)).toBeNull();
  });

  it("a área técnica mostra o tempo de cada etapa e o total do job", () => {
    const model = { busy: false, request: async () => {}, queue: async () => null, st: { status: "COMPLETED", label: "concluído", provider: "meshy", totalTimeMs: 185_000,
      stages: [{ name: "FOTO", provider: "local", elapsedMs: 1_200 }, { name: "ENVIO", provider: "meshy", elapsedMs: 800 }, { name: "RECONSTRUCAO", provider: "meshy", elapsedMs: 183_000 }] } } as unknown as ReturnType<typeof useModel3d>;
    renderApp(<Model3dTechnical model={model} />);
    expect(screen.getByTestId("m3d-total").textContent).toContain("3 min 05 s");
    const items = Array.from(document.querySelectorAll("ol li")).map((li) => li.textContent ?? "");
    expect(items.some((x) => x.includes("3 min 03 s"))).toBe(true);
    expect(items.some((x) => x.includes("1 s"))).toBe(true);
  });
});
