// @vitest-environment jsdom
/** Auditoria dos jogos (15/11), defeito 4: a escolha do deck avisa quando a rodada não pontua com as cartas da pessoa. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NucleoDeck } from "@/components/flair/nucleos/nucleo-deck";
import { CARTAS } from "@/test-utils/flair-nucleos";
import { ME, cleanup, loggedAs, renderApp, screen } from "@/test-utils/render";

afterEach(cleanup);

const REGRAS = { tamanhoMax: 8, obrigatorias: [], semDeck: false };
const semMarca = (id: string) => ({ cardId: id, itens: [{ codigo: "MARCA_NAO_BR", valor: 0, motivo: true }] });

describe("aviso de rodada sem pontos", () => {
  it("na escolha do deck, antes de entrar: nenhuma carta pontua no tema Brasil", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/PASSARELA/efeitos": { efeitos: CARTAS.map((c) => semMarca(c.id)) } });
    renderApp(<NucleoDeck codigo="PASSARELA" regras={REGRAS} cartas={CARTAS} entrando={false} erro={null} onEntrar={vi.fn()} regrasDaRodada={["MARCA_BR", "TODAS_BR"]} />);
    expect((await screen.findByTestId("nucleo-aviso-colecao")).textContent).toBe("Nenhuma das suas cartas pontua nesta rodada: a nota vai sair 0. Escolha outra rodada ou jogue sabendo disso.");
  });

  it("a regra de peça que nenhuma carta cumpre aparece pelo nome", async () => {
    loggedAs(ME, { "POST /api/flair/3d/nucleos/AROUND_THE_WORLD/efeitos": { efeitos: [{ cardId: "c1", itens: [{ codigo: "CIMA_LEVE", valor: 25 }] }, ...CARTAS.slice(1).map((c) => ({ cardId: c.id, itens: [{ codigo: "SEM_BONUS", valor: 0, motivo: true }] }))] } });
    renderApp(<NucleoDeck codigo="AROUND_THE_WORLD" regras={REGRAS} cartas={CARTAS} entrando={false} erro={null} onEntrar={vi.fn()} regrasDaRodada={["CIMA_LEVE", "MARCA_BR"]} />);
    expect((await screen.findByTestId("nucleo-aviso-colecao")).textContent).toMatch(/^Nenhuma carta sua cumpre: .+\. Esses pontos ficam de fora\.$/);
  });
});
