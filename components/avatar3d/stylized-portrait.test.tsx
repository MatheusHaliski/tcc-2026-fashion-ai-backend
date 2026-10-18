// @vitest-environment jsdom
/**
 * Retrato estilizado na GPU: só com foto e consentimento a cada envio; mostra o retrato com a semelhança medida e a
 * recusa da GPU diz o que corrigir na foto. Nada é guardado (o retrato só fica na tela).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { StylizedPortraitCard } from "@/components/avatar3d/stylized-portrait";
import { portraitRefusalKey, similarityBand } from "@/lib/avatar3d/portrait-gpu";

vi.mock("@/lib/avatar3d/pipeline", () => ({
  loadOriented: vi.fn(async () => ({ width: 600, height: 800, toBlob: (cb: (b: Blob) => void) => cb(new Blob(["jpeg"], { type: "image/jpeg" })) })),
}));

const portrait = { status: "READY", image: "data:image/jpeg;base64,/9j/AAAA", width: 896, height: 1152, identitySimilarity: 0.612,
  seed: 12345, style: "semi_realistic", photoStored: false, portraitStored: false };
const refusal = (reason: string, message = "do servidor") => new Response(JSON.stringify({ status: 422, code: "RETRATO_GPU_RECUSADO", message, details: { reason } }),
  { status: 422, headers: { "content-type": "application/json" } });

beforeEach(() => { Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const consent = () => screen.getByRole("switch", { name: /Autorizo enviar esta foto do rosto/ });
const generate = () => screen.getByRole("button", { name: /Gerar (retrato|outro)/ });

async function choosePhoto(container: HTMLElement) {
  fireEvent.change(container.querySelector("#avatar-portrait-photo")!, { target: { files: [new File(["x"], "eu.jpg", { type: "image/jpeg" })] } });
  await waitFor(() => expect((consent() as HTMLButtonElement).disabled).toBe(false));
}

describe("retrato estilizado na GPU", () => {
  it("só envia com foto e consentimento, mostra o retrato com a semelhança e pede o consentimento de novo", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/me/avatar3d/stylized-portrait": portrait });
    const { container } = renderApp(<StylizedPortraitCard />);
    expect((generate() as HTMLButtonElement).disabled).toBe(true);
    await choosePhoto(container);
    expect((generate() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(consent());
    fireEvent.click(generate());
    const img = await screen.findByAltText("Seu retrato estilizado");
    expect(img.getAttribute("src")).toBe(portrait.image);
    expect(screen.getByText(/Semelhança medida: 61% · alta/)).toBeTruthy();
    const sent = calls.find((c) => c.path === "/api/me/avatar3d/stylized-portrait")?.body as FormData;
    expect(sent.get("consent")).toBe("true");
    expect((sent.get("photo") as Blob).type).toBe("image/jpeg");
    expect(sent.get("seed")).toBeNull();   // sem seed: cada pedido sorteia outro retrato
    expect(consent().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Gerar outro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Baixar retrato" })).toBeTruthy();
  });

  it("a recusa da GPU diz o que corrigir na foto, nunca o texto cru", async () => {
    loggedAs(undefined, { "POST /api/me/avatar3d/stylized-portrait": () => refusal("MULTIPLE_FACES_REJECTED") });
    const { container } = renderApp(<StylizedPortraitCard />);
    await choosePhoto(container);
    fireEvent.click(consent());
    fireEvent.click(generate());
    expect(await screen.findByText("A foto tem mais de um rosto. Use uma foto só sua.")).toBeTruthy();
    expect(screen.queryByText("do servidor")).toBeNull();
    expect(screen.queryByAltText("Seu retrato estilizado")).toBeNull();
  });
});

describe("regras do retrato", () => {
  it("motivos conhecidos viram frase; desconhecidos não viram texto", () => {
    expect(portraitRefusalKey("FACE_TOO_SMALL")).toBe("avatar3d.portrait.motivo.rosto_pequeno");
    expect(portraitRefusalKey("VERTEX_PREDICTION_HTTP_503")).toBe("avatar3d.portrait.motivo.indisponivel");
    expect(portraitRefusalKey("<script>")).toBeNull();
    expect(portraitRefusalKey(undefined)).toBeNull();
  });

  it("faixas da semelhança orientam sem certificar", () => {
    expect(similarityBand(0.62)).toBe("alta");
    expect(similarityBand(0.4)).toBe("media");
    expect(similarityBand(0.1)).toBe("baixa");
  });
});
