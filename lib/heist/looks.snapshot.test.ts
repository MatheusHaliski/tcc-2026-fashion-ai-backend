/*
 * Retrato do catálogo de aparências (looks.ts): tabela LOOKS, jogadora padrão, escolha por semente e o corte de gala,
 * comparados por SHA-256 com o valor capturado antes de mover o rosto sintético para looks-face.ts (paintFace precisa
 * de canvas e fica fora do retrato).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as looks from "./looks";
import { LOOKS, PLAYER_DEFAULT, scaleFor, tailored, templateFor, templatesFor, tintFor } from "./looks";
import type { LookId } from "./types";

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const IDS = Object.keys(LOOKS) as LookId[];

const TABLES: Record<string, () => unknown> = {
  exports: () => Object.keys(looks).sort(),
  LOOKS: () => LOOKS, PLAYER_DEFAULT: () => PLAYER_DEFAULT,
  bySeed: () => IDS.flatMap((id) => Array.from({ length: 40 }, (_, k) => { const t = templateFor(id, k * 37 + 1); return [t.key, tintFor(t, k * 37 + 1), Math.round(scaleFor(k * 37 + 1) * 1e6) / 1e6]; })),
  tailored: () => IDS.flatMap((id) => LOOKS[id].map((t) => tailored(t.pieces))),
  templatesFor: () => templatesFor(IDS.flatMap((look) => [3, 11, 19].map((seed) => ({ look, seed })))).map((t) => t.key),
};

/** Capturado no código original (lib/heist/looks.ts com 287 linhas). */
const EXPECTED: Record<string, string> = {
  exports: "bef3e524c85cf90e2e267059810cbb5f5f407dcf1a5d6ffc6c9071a7cc350f79",
  LOOKS: "87bb01e265a2dab7c59cea630f6e9a03cb8ff32310a6cdd17b2dd6738b93b762",
  PLAYER_DEFAULT: "d7260d8ea6ce31e22b0cb75eb963b5e5fcb17b8b47f9fafac28a2801c253ee31",
  bySeed: "7607efe0e166984ffa925151ad8bc0619d1cafeb99a25e5827f3dbcf6b7c521a",
  tailored: "2c52482ac212cf9c8551a288b8de70434651ae495a36ba356a455076c0f713c1",
  templatesFor: "0f7314119232e7eec3e2e2c67483f9a8e0e8ddb82b6b62504e02b030b36728fa",
};

describe("retrato do catálogo de aparências (looks.ts)", () => {
  it("as tabelas continuam idênticas (SHA-256 do JSON)", () => {
    const got = Object.fromEntries(Object.entries(TABLES).map(([k, f]) => [k, sha(f())]));
    const diff = Object.keys(got).filter((k) => got[k] !== EXPECTED[k]);
    if (diff.length) console.log(JSON.stringify(got, null, 2));
    expect(diff).toEqual([]);
  });
  it("contagens", () => {
    expect(IDS.length).toBe(19);
    expect(IDS.reduce((n, id) => n + LOOKS[id].length, 0)).toBe(34);
    expect(templateFor("guestF", 0).look).toBe("guestF");
  });
});
