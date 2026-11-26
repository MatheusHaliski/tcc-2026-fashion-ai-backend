// @vitest-environment jsdom
/**
 * Histórico → Timeline: o mesmo look usado em dois dias aparece nos dois, e o segundo diz que é a 2ª vez (auditoria 10.2:
 * "o mesmo look em 14 e 15 de nov." parecia repetição por engano).
 */
import { afterEach, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";
import { HistoryTimeline } from "./history-timeline";

afterEach(cleanup);

it("o mesmo look em dois dias: o mais recente diz “2ª vez com este look”", async () => {
  loggedAs(undefined, {
    "GET /api/me/daily-looks": [
      { id: "d2", date: "2026-11-15", source: "VISTA_ME", schemeId: "s1", title: "Vista-me · 14/11" },
      { id: "d1", date: "2026-11-14", source: "VISTA_ME", schemeId: "s1", title: "Vista-me · 14/11" },
      { id: "d0", date: "2026-11-13", source: "MANUAL", schemeId: "s2", title: "Look de trabalho" },
    ],
  });
  renderApp(<HistoryTimeline />);
  const linhas = await screen.findAllByRole("listitem");
  expect(linhas).toHaveLength(3);
  expect(linhas[0].textContent).toContain("2ª vez com este look");
  expect(linhas[1].textContent).not.toContain("vez com este look");
  expect(linhas[2].textContent).not.toContain("vez com este look");
});
