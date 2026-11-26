// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { CbcCenarioPreferido, CbcPreferidos, cenarioVisivel, useCenarioPreferido } from "./cbc-cenario-preferido";

const GALA = { id: "s-gala", codigo: "gala", nome: "Gala" };
const LIVRE = { id: "s-livre", codigo: "livre", nome: "Livre" };
const NOVO = { id: "s-novo", codigo: "lua", nome: "Lua" };            // cadastrado no banco, sem arte na tela
const BASE = "/api/flair/challenges/noite-de-gala";

function Tela() {
  const [codigo, setCodigo] = useState<string | null>(null);
  return <><CbcCenarioPreferido slug="noite-de-gala" onCodigo={setCodigo} /><p data-testid="cena">{codigo ?? "oficial"}</p></>;
}
function Card({ id }: { id: string }) {
  const preferido = useCenarioPreferido(id);
  return <p data-testid={`card-${id}`}>{cenarioVisivel(preferido, "gala")}</p>;
}
const pronto = () => waitFor(() => expect(screen.getByLabelText("Cenário que você prefere ver").hasAttribute("disabled")).toBe(false));
const escolher = (nome: string) => { fireEvent.click(screen.getByLabelText("Cenário que você prefere ver")); fireEvent.click(screen.getByRole("option", { name: nome })); };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

describe("exercício 16 — cenário preferido no Desafio de Montagem", () => {
  it("escolhe só entre os cenários do desafio, grava o UUID e a cena passa a ser a preferida", async () => {
    let salvo: typeof GALA | null = null;
    const { calls } = loggedAs(ME, {
      [`GET ${BASE}/scenarios`]: [GALA, LIVRE],
      [`GET ${BASE}/preference`]: () => ({ challengeId: "c1", officialScenario: "gala", scenario: salvo }),
      [`PUT ${BASE}/preference`]: (_: URL, init: RequestInit) => { salvo = JSON.parse(String(init.body)).scenarioId === LIVRE.id ? LIVRE : GALA; return { challengeId: "c1", officialScenario: "gala", scenario: salvo }; },
      [`DELETE ${BASE}/preference`]: () => { salvo = null; return { challengeId: "c1", officialScenario: "gala", scenario: null }; },
    });
    renderApp(<Tela />);
    await pronto();
    expect(screen.getByTestId("cena").textContent).toBe("oficial");     // sem preferência vale o cenário oficial
    expect(screen.queryByRole("option", { name: "Paris" })).toBeNull();
    escolher("Livre");
    await waitFor(() => expect(screen.getByTestId("cena").textContent).toBe("livre"));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ scenarioId: LIVRE.id });   // o corpo não leva usuário
    await pronto();
    escolher("Cenário oficial do desafio");
    await waitFor(() => expect(screen.getByTestId("cena").textContent).toBe("oficial"));
    expect(calls.some((c) => c.method === "DELETE" && c.path === `${BASE}/preference`)).toBe(true);
  });

  it("cenário cadastrado sem arte na tela fica indisponível e não vira preferência", async () => {
    const { calls } = loggedAs(ME, { [`GET ${BASE}/scenarios`]: [GALA, NOVO], [`GET ${BASE}/preference`]: { challengeId: "c1", officialScenario: "gala", scenario: null } });
    renderApp(<Tela />);
    await pronto();
    escolher("Lua");
    expect(await screen.findByText("O cenário Lua ainda não tem arte nesta versão do app. Escolha outro.")).toBeTruthy();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    expect(cenarioVisivel(NOVO, "gala")).toBe("gala");                  // preferência antiga sem arte: desenha o oficial
    expect(cenarioVisivel(LIVRE, "gala")).toBe("livre");
    expect(cenarioVisivel(null, "gala")).toBe("gala");
  });

  it("erro ao salvar mantém a preferência anterior", async () => {
    loggedAs(ME, { [`GET ${BASE}/scenarios`]: [GALA, LIVRE], [`GET ${BASE}/preference`]: { challengeId: "c1", officialScenario: "gala", scenario: null },
      [`PUT ${BASE}/preference`]: () => new Response(JSON.stringify({ status: 400, code: "CBC_CENARIO_NAO_PERMITIDO", message: "Este cenário não é permitido neste desafio." }), { status: 400, headers: { "content-type": "application/json" } }) });
    renderApp(<Tela />);
    await pronto();
    escolher("Livre");
    expect(await screen.findByText("Este cenário não é permitido neste desafio.")).toBeTruthy();
    expect(screen.getByTestId("cena").textContent).toBe("oficial");
  });

  it("sem sessão não mostra a escolha nem chama a API", () => {
    const { calls } = mockApi({});
    renderApp(<Tela />);
    expect(screen.queryByLabelText("Cenário que você prefere ver")).toBeNull();
    expect(calls.filter((c) => c.path.startsWith(BASE))).toEqual([]);
  });

  it("a lista usa a preferência de cada desafio e deixa os outros no cenário oficial", async () => {
    loggedAs(ME, { "GET /api/flair/challenge-preferences": [{ challengeId: "c1", scenario: LIVRE }] });
    renderApp(<CbcPreferidos><Card id="c1" /><Card id="c2" /></CbcPreferidos>);
    await waitFor(() => expect(screen.getByTestId("card-c1").textContent).toBe("livre"));
    expect(screen.getByTestId("card-c2").textContent).toBe("gala");
  });
});
