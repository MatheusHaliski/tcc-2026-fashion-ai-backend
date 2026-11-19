// @vitest-environment jsdom
/**
 * Histórico → Timeline: o mesmo look usado em dois dias aparece nos dois, e o segundo diz que é a 2ª vez (auditoria 10.2:
 * "o mesmo look em 14 e 15 de nov." parecia repetição por engano).
 */
import { afterEach, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp, screen, within } from "@/test-utils/render";
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

it("mostra o Contexto do Dia congelado de cada registro (propósito, para quem e marcas do dia)", async () => {
  loggedAs(undefined, {
    "GET /api/me/daily-looks": [
      { id: "d1", date: "2026-11-23", source: "MANUAL", schemeId: "s1", title: "Look de entrevista", context: { purpose: "ENTREVISTA", purposeLabel: "Entrevista", purposeNote: "agência", audience: "TRABALHO", audienceLabel: "Trabalho", sensitive: false, privateOnly: false, marks: [{ kind: "WEEKDAY", code: "MONDAY", label: "Segunda-feira", weekend: false }, { kind: "SEASON", code: "SPRING", label: "Primavera" }, { kind: "MOMENT", code: "denim-week", label: "Denim Week", icon: "👖", type: "COMMUNITY" }] } },
      { id: "d0", date: "2026-11-22", source: "MANUAL", schemeId: "s2", title: "Look de domingo", context: null },
    ],
  });
  renderApp(<HistoryTimeline />);
  const linhas = await screen.findAllByRole("listitem");
  expect(linhas[0].textContent).toContain("Entrevista");
  expect(linhas[0].textContent).toContain("para Trabalho");
  expect(within(linhas[0]).getByRole("list", { name: "Marcas do dia" }).textContent).toContain("Denim Week");
  expect(linhas[0].textContent).toContain("Primavera");
  expect(linhas[1].textContent).not.toContain("Marcas do dia");
  expect(within(linhas[1]).queryByRole("list")).toBeNull();
});
