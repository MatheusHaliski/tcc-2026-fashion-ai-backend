// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { PieceColecaoField } from "./piece-colecao-field";
import { PieceConservationField } from "./piece-conservation-field";
import { PieceIntensidadeTermicaField } from "./piece-intensidade-termica-field";
import { TipoLavagemField } from "./tipo-lavagem-field";
import { ReferenceSelectField, type ReferenceFieldProps } from "./reference-select-field";

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); tokenStore.clear();
  document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

const option = { id: "0f0e0d0c-0000-4000-8000-000000000002", codigo: "HERDADA", nome: "Herdada" };
const hasSession = (init: RequestInit) => !!(init.headers as Record<string, string> | undefined)?.Authorization;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** GET de opções fora de PUBLIC_GET: sem sessão o backend responde 401 — a trava do campo Origem. */
const sessionOnly = (rows: unknown) => (_: URL, init: RequestInit) =>
  hasSession(init) ? rows : json(401, { status: 401, code: "NAO_AUTENTICADO", message: "Faça login para continuar." });

type Render = (props: ReferenceFieldProps) => ReactElement;
const FIELDS: [string, string, Render][] = [
  ["Estado de conservação", "/api/opcoes/estados-conservacao", props => <PieceConservationField {...props} />],
  ["Tipo de lavagem", "/api/tipos-lavagem", props => <TipoLavagemField {...props} />],
  ["Coleção", "/api/colecoes", props => <PieceColecaoField {...props} />],
  ["Intensidade térmica", "/api/intensidades-termicas", props => <PieceIntensidadeTermicaField {...props} />],
  // campo novo: GET que ninguém cadastrou em SecurityConfig
  ["Tipo de lavagem", "/api/exemplo/novo-campo", props => <ReferenceSelectField {...props} id="novoCampoId" path="/api/exemplo/novo-campo" messages="pieceReferences.tipoLavagem" />],
];

it.each(FIELDS)("%s (%s) loads for a logged-in creator even when the endpoint requires the session", async (label, route, render) => {
  const { calls } = loggedAs(undefined, { [`GET ${route}`]: sessionOnly([option]) });
  const change = vi.fn();
  renderApp(render({ value: "", onChange: change }));
  const field = screen.getByLabelText(label);
  await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(field);
  fireEvent.click(screen.getByRole("option", { name: option.nome }));
  expect(change).toHaveBeenCalledExactlyOnceWith(option.id);
  expect(calls.some(c => c.path === route)).toBe(true);
});

it("retries with the session after a failed load", async () => {
  const route = "/api/exemplo/novo-campo";
  let first = true;
  const sent: boolean[] = [];
  loggedAs(undefined, { [`GET ${route}`]: (_: URL, init: RequestInit) => {
    sent.push(hasSession(init));
    if (first) { first = false; return json(503, { message: "offline" }); }
    return sessionOnly([option])(_, init);
  } });
  renderApp(<ReferenceSelectField id="novoCampoId" path={route} messages="pieceReferences.colecao" value="" onChange={vi.fn()} />);
  expect(await screen.findByText("Não foi possível carregar as coleções.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
  await waitFor(() => expect(screen.getByLabelText("Coleção").hasAttribute("disabled")).toBe(false));
  expect(sent.at(-1)).toBe(true);
});

it("still reads a public catalog without a session (no token is invented)", async () => {
  const sent: boolean[] = [];
  mockApi({ "GET /api/opcoes/estados-conservacao": (_: URL, init: RequestInit) => { sent.push(hasSession(init)); return [option]; } });
  renderApp(<PieceConservationField value="" onChange={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText("Estado de conservação").hasAttribute("disabled")).toBe(false));
  expect(sent).toEqual([false]);
});
