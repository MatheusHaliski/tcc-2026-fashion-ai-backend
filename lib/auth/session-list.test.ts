import { describe, expect, it } from "vitest";
import { sessionLabel, sortSessions } from "./session-list";

const CUT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, l";
const FULL = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("Configurações › sessões", () => {
  it("usa o User-Agent inteiro quando o device vem cortado (antes: só 'Linux')", () => {
    expect(sessionLabel({ sessionId: "a", device: CUT, userAgent: FULL })).toEqual({ kind: "both", browser: "Chrome", system: "Linux" });
    expect(sessionLabel({ sessionId: "b", device: CUT })).toEqual({ kind: "system", system: "Linux" });
    expect(sessionLabel({ sessionId: "c", device: "auditoria" })).toEqual({ kind: "named", name: "auditoria" });
    expect(sessionLabel({ sessionId: "d" })).toEqual({ kind: "unknown" });
  });

  it("a sessão atual vem primeiro; as outras da mais recente para a mais antiga", () => {
    const rows = [
      { sessionId: "old", lastUsedAt: "2026-10-01T00:00:00Z" },
      { sessionId: "cur", current: true, createdAt: "2026-09-01T00:00:00Z" },
      { sessionId: "new", lastUsedAt: "2026-11-01T00:00:00Z" },
    ];
    expect(sortSessions(rows).map((r) => r.sessionId)).toEqual(["cur", "new", "old"]);
  });
});
