// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ upload: vi.fn(), blob: true as boolean }));
vi.mock("@/lib/api/client", () => ({ api: { upload: h.upload } }));
vi.mock("@/lib/avatar3d/pipeline", () => ({
  loadOriented: vi.fn(async () => ({ toBlob: (cb: (b: Blob | null) => void, type: string) => cb(h.blob ? new Blob(["j"], { type }) : null) })),
}));

import { GPU_KEYS, gpuRefusalKey, gpuRefusedKey, measureBodyOnGpu, mergeGpuMeasurement } from "./body-gpu";
import { portraitRefusalKey, similarityBand, stylizedPortraitOnGpu } from "./portrait-gpu";
import { BODY_RANGE, defaultBodyModel } from "./body-spec";

beforeEach(() => { h.upload.mockReset(); h.upload.mockResolvedValue({ ok: 1 }); h.blob = true; });

describe("medida do corpo na GPU", () => {
  it("envia a foto em JPEG com consentimento para o body-scan", async () => {
    expect(await measureBodyOnGpu(new Blob(["x"]))).toEqual({ ok: 1 });
    const [path, form] = h.upload.mock.calls[0] as [string, FormData];
    expect(path).toBe("/api/me/avatar3d/body-scan");
    expect(form.get("consent")).toBe("true");
    expect((form.get("photo") as File).name).toBe("corpo.jpg");
    expect((form.get("photo") as File).type).toBe("image/jpeg");
  });

  it("canvas que não gera JPEG rejeita e não envia", async () => {
    h.blob = false;
    await expect(measureBodyOnGpu(new Blob(["x"]))).rejects.toThrow("JPEG");
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("aplica só as proporções válidas e dentro da faixa como medidas na foto", () => {
    const m = defaultBodyModel("FEMININO");
    const mid = (k: (typeof GPU_KEYS)[number]) => (BODY_RANGE[k][0] + BODY_RANGE[k][1]) / 2;
    const out = mergeGpuMeasurement(m, {
      ratios: { shoulderW: mid("shoulderW"), chestD: mid("chestD"), hipW: BODY_RANGE.hipW[1] + 1, waistW: Number.NaN, legLen: "x" as unknown as number },
      refused: {}, warnings: [],
    });
    expect(out.params.shoulderW).toBe(mid("shoulderW"));
    expect(out.sources.shoulderW).toBe("observed");
    expect(out.sources.chestD).toBe("observed");
    expect(out.params.hipW).toBe(m.params.hipW);
    expect(out.sources.waistW).toBe(m.sources.waistW);
    expect(out.photo).toBe(true);
  });

  it("nada aplicável devolve o mesmo modelo", () => {
    const m = defaultBodyModel("MASCULINO");
    expect(mergeGpuMeasurement(m, { ratios: {}, refused: {}, warnings: [] })).toBe(m);
    expect(mergeGpuMeasurement(m, { refused: {}, warnings: [] } as never)).toBe(m);
    expect(mergeGpuMeasurement(m, { ratios: { armLen: BODY_RANGE.armLen[0] - 1 }, refused: {}, warnings: [] })).toBe(m);
  });

  it.each([
    ["FULL_BODY_NOT_VISIBLE", "corpo_inteiro"], ["EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED", "pessoa"], ["INVALID_PERSON_DETECTION", "pessoa"],
    ["VISIBLE_LANDMARK_OUTSIDE_IMAGE", "fora"], ["ONE_BODY_RECONSTRUCTION_REQUIRED", "reconstrucao"], ["INVALID_BODY_MESH", "reconstrucao"],
    ["INVALID_BODY_KEYPOINTS", "reconstrucao"], ["IMPLAUSIBLE_BODY_SCALE", "reconstrucao"], ["IMPLAUSIBLE_BODY_PROPORTIONS", "reconstrucao"],
    ["DEGENERATE_BODY_FRAME", "reconstrucao"], ["NONFINITE_DWPOSE", "reconstrucao"], ["GPU_BUSY_RETRY_LATER", "ocupada"], ["WORKER_BUSY", "ocupada"],
    ["GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD", "ocupada"], ["TASK_NOT_SUPPORTED_BY_MODEL", "indisponivel"], ["MODEL_NOT_READY", "indisponivel"],
    ["GPU_PREDICTION_FAILED", "indisponivel"], ["VERTEX_TIMEOUT", "indisponivel"],
  ])("recusa %s vira o motivo %s", (code, key) => {
    expect(gpuRefusalKey(code)).toBe(`avatar3d.body.gpu.motivo.${key}`);
  });

  it("recusa desconhecida ou que não é texto não vira motivo", () => {
    expect(gpuRefusalKey("OUTRO")).toBeNull();
    expect(gpuRefusalKey(42)).toBeNull();
    expect(gpuRefusalKey()).toBeNull();
  });

  it("proporção recusada: códigos conhecidos têm frase própria, os outros o genérico", () => {
    for (const c of ["SLICE_WITHOUT_TORSO", "ARMS_CLOSE_TO_BODY", "OUT_OF_ADULT_RANGE"]) expect(gpuRefusedKey(c)).toBe(`avatar3d.body.gpu.recusa.${c}`);
    expect(gpuRefusedKey("QUALQUER")).toBe("avatar3d.body.gpu.recusa.outro");
  });
});

describe("retrato semirrealista na GPU", () => {
  it("envia a foto do rosto com consentimento; seed só quando informado", async () => {
    await stylizedPortraitOnGpu(new Blob(["x"]));
    let [path, form] = h.upload.mock.calls[0] as [string, FormData];
    expect(path).toBe("/api/me/avatar3d/stylized-portrait");
    expect((form.get("photo") as File).name).toBe("rosto.jpg");
    expect(form.get("seed")).toBeNull();
    await stylizedPortraitOnGpu(new Blob(["x"]), 0);
    [, form] = h.upload.mock.calls[1] as [string, FormData];
    expect(form.get("seed")).toBe("0");
  });

  it("falha no JPEG rejeita", async () => {
    h.blob = false;
    await expect(stylizedPortraitOnGpu(new Blob(["x"]))).rejects.toThrow("JPEG");
  });

  it("faixas de semelhança nos limites", () => {
    expect(similarityBand(0.5)).toBe("alta");
    expect(similarityBand(0.49)).toBe("media");
    expect(similarityBand(0.35)).toBe("media");
    expect(similarityBand(0.34)).toBe("baixa");
  });

  it.each([
    ["FACE_NOT_FOUND", "sem_rosto"], ["DEGENERATE_FACE_LANDMARKS", "sem_rosto"], ["MULTIPLE_FACES_REJECTED", "varios_rostos"],
    ["FACE_TOO_SMALL", "rosto_pequeno"], ["GENERATED_FACE_REJECTED", "resultado"], ["DEGENERATE_GENERATED_IMAGE", "resultado"],
    ["GPU_BUSY_RETRY_LATER", "ocupada"], ["WORKER_BUSY", "ocupada"], ["GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD", "ocupada"],
    ["TASK_NOT_SUPPORTED_BY_MODEL", "indisponivel"], ["MODEL_NOT_READY", "indisponivel"], ["GPU_PREDICTION_FAILED", "indisponivel"], ["VERTEX_X", "indisponivel"],
  ])("recusa do retrato %s vira %s", (code, key) => {
    expect(portraitRefusalKey(code)).toBe(`avatar3d.portrait.motivo.${key}`);
  });

  it("recusa do retrato desconhecida ou não textual não vira motivo", () => {
    expect(portraitRefusalKey("NADA")).toBeNull();
    expect(portraitRefusalKey(null)).toBeNull();
  });
});
