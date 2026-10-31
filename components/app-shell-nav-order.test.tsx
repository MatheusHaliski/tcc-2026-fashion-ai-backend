// @vitest-environment jsdom
/** RF23 — o menu lateral segue a ordem salva no perfil: ao entrar, a ordem do servidor vale (inclusive em outro aparelho). */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, loggedAs, ME, renderApp, screen, waitFor } from "@/test-utils/render";
import { AppShell } from "./app-shell";
import { getNavOrder, setNavOrder } from "@/lib/nav/nav-order";

afterEach(async () => { cleanup(); await setNavOrder(null, { persist: false }); localStorage.clear(); });

const groupTitles = () => Array.from(document.querySelectorAll(".nav-groups .nav-group-title")).map((h) => h.textContent);
const wardrobeLinks = () => Array.from(document.querySelectorAll("section[aria-labelledby='nav-nav.group.wardrobe'] a")).map((a) => a.getAttribute("href"));

async function shell(prefs: unknown) {
  loggedAs(ME, { "GET /api/notifications/unread-count": { unread: 0 }, "GET /api/me/preferences": prefs });
  renderApp(<AppShell><p>conteúdo</p></AppShell>);
  await waitFor(() => expect(screen.getByText("conteúdo")).toBeTruthy());
}

describe("menu lateral na ordem da pessoa", () => {
  it("aplica a ordem vinda do perfil: Guarda-roupa primeiro e Meu Quarto no topo do grupo", async () => {
    await shell({ navOrder: { groups: ["nav.group.wardrobe"], items: { "nav.group.wardrobe": ["/room"] } } });
    await waitFor(() => expect(groupTitles()[0]).toBe("Guarda-roupa"));
    expect(groupTitles()[1]).toBe("Descobrir");
    expect(wardrobeLinks()[0]).toBe("/room");
    expect(wardrobeLinks()).toContain("/closet");                // o que a ordem salva não cita continua no menu
  });

  it("sem ordem no perfil, o menu volta à padrão mesmo com uma ordem antiga no navegador", async () => {
    act(() => { void setNavOrder({ groups: ["nav.group.play"], items: {} }, { persist: false }); });
    await shell({});
    await waitFor(() => expect(groupTitles()[0]).toBe("Descobrir"));
    expect(getNavOrder()).toBeNull();
  });
});
