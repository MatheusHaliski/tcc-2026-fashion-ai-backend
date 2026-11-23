// @vitest-environment jsdom
/**
 * Esquema AMPLIADO (RF7) — Look do Dia (RF6.CA05) com o Contexto do Dia (Look do Dia Vivido F1): o botão abre
 * "Hoje eu vesti isso para…", o registro leva o contexto (ou vazio) e a recusa do servidor vira aviso. Extraído de
 * expanded-card.test.tsx (arquivo congelado em docs/refactoring/LINE_RULES.md); mesmos dublês e helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { tokenStore } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { ExpandedScheme } from "./expanded-card";

vi.mock("@/components/model3d-panel", () => ({ useModel3d: () => ({ st: null }), Model3dAction: () => null, Model3dTechnical: () => null }));
vi.mock("@/components/mannequin-photo", async (orig) => ({ ...(await orig<typeof import("./mannequin-photo")>()), MannequinPhotoButton: () => <span>botão do manequim</span> }));

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); router.push.mockClear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("ExpandedScheme — Look do Dia com Contexto do Dia", () => {
  const draft: SchemeView = { ...SCHEME, status: "DRAFT", lookDoDia: false } as SchemeView;

  it("publica e marca como look do dia (POST e recarrega); erros aparecem no aviso", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: draft }, "POST /api/schemes/s1/publication": undefined, "POST /api/me/daily-look": err(409, "Já existe look do dia") });
    renderApp(<ExpandedScheme id="s1" headerExtra={<span>controles</span>} />);
    fireEvent.click(await screen.findByRole("button", { name: "Publicar" }));
    expect(await screen.findByText("Look publicado!")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/schemes/s1/publication")?.body).toEqual({ visibility: "PUBLIC" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como look do dia" }));
    // Look do Dia Vivido: o botão abre "Hoje eu vesti isso para…"; sem sugestões carregadas ainda dá para registrar
    fireEvent.click(await screen.findByRole("button", { name: "Registrar Look do Dia" }));
    expect(await screen.findByText("Já existe look do dia")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/me/daily-look")?.body).toEqual({ schemeId: "s1", context: { purpose: null, purposeNote: null, audience: null } });
    expect(screen.getByRole("link", { name: /Provar/ }).getAttribute("href")).toBe("/try-on?scheme=s1");
    expect(screen.getByRole("link", { name: /Editar imagem/ }).getAttribute("href")).toBe("/schemes/s1/photo");
    expect(screen.getByText("controles")).toBeTruthy();
    expect(screen.getByText("botão do manequim")).toBeTruthy();
  });

  it("look do dia com sucesso e publicar com erro", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: draft }, "POST /api/schemes/s1/publication": err(400, "Falta foto"), "POST /api/me/daily-look": undefined });
    renderApp(<ExpandedScheme id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como look do dia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Registrar sem contexto" }));
    expect(await screen.findByText("Look do Dia ✓")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    expect(await screen.findByText("Falta foto")).toBeTruthy();
  });

  it("selo de experiência do look (dono, look já usado): usos e acertos por propósito", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: { ...SCHEME, lookDoDia: true } }, "GET /api/me/daily-looks/experience": [{ purpose: "ENTREVISTA", label: "Entrevista", times: 3, worked: 2 }, { purpose: "FESTA", label: "Festa", times: 1, worked: 0 }] });
    renderApp(<ExpandedScheme id="s1" />);
    const list = await screen.findByRole("list", { name: "Experiência com este look" });
    expect(list.textContent).toContain("Usado 3 vezes para entrevista · 2 deram certo");
    expect(list.textContent).toContain("Usado 1 vez para festa");
    expect(list.textContent).not.toContain("0 deram certo");
  });
});
