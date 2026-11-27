import { describe, expect, it } from "vitest";
import { backupSizeKb, backupState, backupWhen } from "./backup-row";

describe("Administração › linha do backup", () => {
  const api = { id: "b1", kind: "MYSQL_FULL", status: "COMPLETED", startedAt: "2026-11-14T13:40:44Z", finishedAt: "2026-11-14T13:40:47Z", sizeBytes: "375290" };

  it("usa a data de início que a API manda (a linha saía sem data)", () => {
    expect(backupWhen(api)).toBe("2026-11-14T13:40:44Z");
    expect(backupWhen({ createdAt: "2026-10-01T00:00:00Z" })).toBe("2026-10-01T00:00:00Z");
    expect(backupWhen({})).toBeNull();
  });

  it("estado e tamanho vêm do status e do número em texto", () => {
    expect(backupState(api)).toBe("ok");
    expect(backupState({ status: "FAILED" })).toBe("failed");
    expect(backupState({ ok: false })).toBe("failed");
    expect(backupState({ status: "RUNNING" })).toBe("running");
    expect(backupSizeKb(api)).toBe(366);
    expect(backupSizeKb({ sizeBytes: "null" })).toBeNull();
  });
});
