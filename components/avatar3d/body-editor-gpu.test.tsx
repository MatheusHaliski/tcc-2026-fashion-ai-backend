// @vitest-environment jsdom
/**
 * Corpo do Avatar 3D medido na GPU: a mesma foto de corpo inteiro, só com consentimento a cada envio; as proporções
 * medidas viram "medido na foto" (inclusive as profundidades) e a recusa da GPU diz o que corrigir na foto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { BodyEditor } from "@/components/avatar3d/body-editor";
import { gpuRefusalKey, mergeGpuMeasurement } from "@/lib/avatar3d/body-gpu";
import { defaultBodyModel, type BodyModel } from "@/lib/avatar3d/body-spec";

vi.mock("@/lib/avatar3d/pipeline", () => ({
  loadOriented: vi.fn(async () => ({ width: 600, height: 1200, toBlob: (cb: (b: Blob) => void) => cb(new Blob(["jpeg"], { type: "image/jpeg" })) })),
}));
// sem a medida no aparelho (MediaPipe não roda no jsdom): a GPU não depende dela
vi.mock("@/lib/avatar3d/body-detect", () => ({ detectBody: vi.fn(async () => ({ pose: null, people: 0 })) }));

const scanned = { status: "READY", ratios: { waistW: 0.16, chestD: 0.12 }, refused: { hipW: "ARMS_CLOSE_TO_BODY" }, warnings: ["ARMS_CLOSE_TO_BODY"], source: "observed", photoStored: false };
const refusal = (reason: string, message = "do servidor") => new Response(JSON.stringify({ status: 422, code: "MEDIDA_GPU_RECUSADA", message, details: { reason } }),
  { status: 422, headers: { "content-type": "application/json" } });

beforeEach(() => { Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const consent = () => screen.getByRole("switch", { name: /Autorizo enviar esta foto de corpo inteiro/ });
const measure = () => screen.getByRole("button", { name: "Medir com IA" });

async function choosePhoto(container: HTMLElement) {
  fireEvent.change(container.querySelector("#avatar-body-photo")!, { target: { files: [new File(["x"], "eu.jpg", { type: "image/jpeg" })] } });
  await waitFor(() => expect((consent() as HTMLButtonElement).disabled).toBe(false));
}

describe("medida do corpo na GPU", () => {
  it("só envia com foto e consentimento, aplica as medidas como medidas na foto e pede o consentimento de novo", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/me/avatar3d/body-scan": scanned });
    const onSave = vi.fn();
    const { container } = renderApp(<BodyEditor sex="FEMININO" initial={null} avatar={null} onSave={onSave} saving={false} />);
    expect(screen.getByText("Escolha primeiro a foto de corpo inteiro acima.")).toBeTruthy();
    expect((measure() as HTMLButtonElement).disabled).toBe(true);
    await choosePhoto(container);
    expect((measure() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(consent());
    fireEvent.click(measure());
    expect(await screen.findByText(/2 medidas da GPU aplicadas ao corpo/)).toBeTruthy();
    const sent = calls.find((c) => c.path === "/api/me/avatar3d/body-scan")?.body as FormData;
    expect(sent.get("consent")).toBe("true");
    expect((sent.get("photo") as Blob).type).toBe("image/jpeg");
    expect((container.querySelector("#body-waistW") as HTMLInputElement).value).toBe("0.16");
    expect(screen.getByText("Medida na GPU a partir da foto de corpo inteiro.")).toBeTruthy();
    expect(screen.getByText(/Quadril: braço encostado no corpo/)).toBeTruthy();
    expect(consent().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Salvar corpo" }));
    const saved = onSave.mock.calls[0][0] as BodyModel;
    expect(saved.sources.waistW).toBe("observed");
    expect(saved.params.chestD).toBe(0.12);
    expect(saved.sources.chestD).toBe("observed");
    expect(saved.photo).toBe(true);
  });

  it("a recusa da GPU diz o que corrigir na foto, nunca o texto cru", async () => {
    loggedAs(undefined, { "POST /api/me/avatar3d/body-scan": () => refusal("FULL_BODY_NOT_VISIBLE") });
    const { container } = renderApp(<BodyEditor sex="MASCULINO" initial={null} avatar={null} onSave={vi.fn()} saving={false} />);
    await choosePhoto(container);
    fireEvent.click(consent());
    fireEvent.click(measure());
    expect(await screen.findByText("A foto precisa mostrar o corpo inteiro, da cabeça aos pés (tornozelos visíveis).")).toBeTruthy();
    expect(screen.queryByText("do servidor")).toBeNull();
    expect((container.querySelector("#body-waistW") as HTMLInputElement).value).not.toBe("0.16");
  });
});

describe("regras da medida da GPU", () => {
  it("aplica só proporções conhecidas dentro das faixas e não toca na estatura", () => {
    const base = { ...defaultBodyModel("FEMININO"), heightCm: 170 };
    const out = mergeGpuMeasurement(base, { ratios: { waistW: 0.16, hipW: 0.9, legLen: Number.NaN, stature: 2 } as never, refused: {}, warnings: [] });
    expect(out.params.waistW).toBe(0.16);
    expect(out.sources.waistW).toBe("observed");
    expect(out.params.hipW).toBe(base.params.hipW);
    expect(out.sources.hipW).toBe("default");
    expect(out.params.stature).toBe(base.params.stature);
    expect(mergeGpuMeasurement(base, { ratios: {}, refused: {}, warnings: [] })).toBe(base);
  });

  it("motivos conhecidos viram frase; desconhecidos não viram texto", () => {
    expect(gpuRefusalKey("FULL_BODY_NOT_VISIBLE")).toBe("avatar3d.body.gpu.motivo.corpo_inteiro");
    expect(gpuRefusalKey("VERTEX_PREDICTION_HTTP_404")).toBe("avatar3d.body.gpu.motivo.indisponivel");
    expect(gpuRefusalKey("GPU_BUSY_RETRY_LATER")).toBe("avatar3d.body.gpu.motivo.ocupada");
    expect(gpuRefusalKey("<script>")).toBeNull();
    expect(gpuRefusalKey(undefined)).toBeNull();
  });
});
