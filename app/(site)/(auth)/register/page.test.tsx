// @vitest-environment jsdom
/**
 * Cadastro (RF1): disponibilidade do username, validação local (username e termos), envio para o BFF com os dados de
 * pessoa, marca ou celebridade, avisos do servidor e ida para a confirmação de e-mail.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import RegisterPage from "./page";

vi.mock("@/components/photo-picker", () => ({
  PhotoPicker: ({ kind, label, onChange, error }: { kind: string; label: string; onChange: (u: string | null) => void; error?: string }) =>
    <button type="button" onClick={() => onChange(`/up/${kind}.png`)}>{label}{error ? ` (${error})` : ""}</button>,
  MannequinSexPicker: ({ onChange }: { onChange: (s: "FEMININO") => void }) => <button type="button" onClick={() => onChange("FEMININO")}>manequim feminino</button>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const SESSION = { accessToken: "tok", user: { id: "u9", username: "nova", displayName: "Nova", profileType: "PESSOAL", verified: false, privateAccount: false } };
const type = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
const dismiss = async () => fireEvent.click(await screen.findByRole("button", { name: "Entendi" }));
const body = (calls: { path: string; body?: unknown }[]) => calls.find((c) => c.path === "/bff/auth/register")!.body as Record<string, unknown>;

function fillBase() {
  type("fullName", "Nova Pessoa"); type("username", "nova"); type("email", "nova@x.com");
  type("password", "Senha123!"); type("confirmPassword", "Senha123!"); type("birthDate", "2000-01-01");
  fireEvent.click(document.getElementById("acceptTerms")!);
}

describe("cadastro — username e validação local", () => {
  it("username curto não consulta; disponível e indisponível com sugestões; erro da consulta volta à dica", async () => {
    let n = 0;
    const { calls } = mockApi({ "GET /api/usernames/ana/availability": { available: true }, "GET /api/usernames/anas/availability": () => (++n === 1 ? { available: false, suggestions: ["ana1", "ana_2"] } : undefined),
      "GET /api/usernames/zzz/availability": () => new Response("x", { status: 500 }) });
    renderApp(<RegisterPage />);
    expect(screen.getByText("3–30 caracteres: letras, números, ponto e sublinhado")).toBeTruthy();
    type("username", "an");
    type("username", "ana");
    expect(await screen.findByText("✓ Username disponível", undefined, { timeout: 2000 })).toBeTruthy();
    type("username", "anas");
    expect(await screen.findByText("✗ Username indisponível — Sugestões: ana1, ana_2", undefined, { timeout: 2000 })).toBeTruthy();
    type("username", "zzz");
    expect(await screen.findByText("3–30 caracteres: letras, números, ponto e sublinhado", undefined, { timeout: 2000 })).toBeTruthy();
    expect(calls.some((c) => c.path.startsWith("/api/usernames/an/"))).toBe(false);
  });

  it("indisponível sem sugestões; volta a ficar curto e limpa o estado", async () => {
    mockApi({ "GET /api/usernames/bia/availability": { available: false } });
    renderApp(<RegisterPage />);
    type("username", "bia");
    expect(await screen.findByText("✗ Username indisponível", undefined, { timeout: 2000 })).toBeTruthy();
    type("username", "bi");
    expect(screen.getByText("3–30 caracteres: letras, números, ponto e sublinhado")).toBeTruthy();
  });

  it("sem username e sem aceitar termos avisa e não envia; username inválido tem mensagem própria", async () => {
    const { calls } = mockApi({});
    renderApp(<RegisterPage />);
    submit();
    expect(await screen.findByText("Revise os campos destacados.")).toBeTruthy();
    expect(screen.getAllByText("Escolha um username.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Você precisa aceitar os Termos de Uso e a Política de Privacidade do FashionAI.").length).toBeGreaterThan(0);
    expect(document.getElementById("acceptTerms")!.getAttribute("aria-describedby")).toBe("terms-description terms-error");
    await dismiss();
    type("username", "a b!");
    fireEvent.click(document.getElementById("acceptTerms")!);
    submit();
    expect((await screen.findAllByText("Use de 3 a 30 caracteres: letras, números, ponto e sublinhado.")).length).toBeGreaterThan(0);
    expect(calls.some((c) => c.path === "/bff/auth/register")).toBe(false);
  });
});

describe("cadastro — envio", () => {
  it("pessoal: manda foto e sexo do manequim, entra, mostra avisos do servidor e vai confirmar o e-mail", async () => {
    const { calls } = mockApi({ "GET /api/usernames/nova/availability": { available: true }, "POST /bff/auth/register": { ...SESSION, warnings: ["Confirme em 7 dias"] } });
    renderApp(<RegisterPage />);
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: /Foto de perfil/ }));
    fireEvent.click(screen.getByRole("button", { name: "manequim feminino" }));
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/verify-email"));
    expect(body(calls)).toMatchObject({ profileType: "PESSOAL", fullName: "Nova Pessoa", username: "nova", country: "BR", acceptTerms: true, avatarUrl: "/up/avatar.png", sex: "FEMININO", brand: null, celebrity: null });
    expect(await screen.findByText("Confirme em 7 dias")).toBeTruthy();
    await dismiss();
    expect(await screen.findByText("Confirme seu e-mail")).toBeTruthy();
  });

  it("marca: campos da marca, logo e comprovante; sem seletor de manequim", async () => {
    const { calls } = mockApi({ "GET /api/usernames/nova/availability": { available: true }, "POST /bff/auth/register": SESSION });
    renderApp(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Marca" }));
    expect(screen.queryByRole("button", { name: "manequim feminino" })).toBeNull();
    fillBase();
    type("razaoSocial", "Marca LTDA"); type("cnpj", "123"); type("nomeFantasia", "Marca"); type("fashionCategory", "Casual");
    type("storeUrl", "https://marca.com"); type("commercialContact", "c@m.com"); type("officialHashtag", "#marca");
    fireEvent.click(screen.getByRole("button", { name: /Logo da marca/ }));
    fireEvent.click(screen.getByRole("button", { name: /Comprovante de atividade/ }));
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/verify-email"));
    expect(body(calls)).toMatchObject({ profileType: "MARCA", celebrity: null, sex: null,
      brand: { razaoSocial: "Marca LTDA", cnpj: "123", nomeFantasia: "Marca", fashionCategory: "Casual", storeUrl: "https://marca.com", commercialContact: "c@m.com", officialHashtag: "#marca", logoUrl: "/up/logo.png", activityProofUrl: "/up/activity-proof.png" } });
  });

  it("celebridade: áreas viram lista, documentos, histórico e consentimento do selo", async () => {
    const { calls } = mockApi({ "GET /api/usernames/nova/availability": { available: true }, "POST /bff/auth/register": SESSION });
    renderApp(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Celebridade" }));
    fillBase();
    type("stageName", "Nova Star"); type("realName", "Nova Pessoa"); type("areas", "música, , TV ");
    type("verificationUrl", "https://instagram.com/nova"); type("representationContact", "agente@x.com"); type("professionalHistory", "10 anos");
    fireEvent.click(screen.getByRole("button", { name: /Foto oficial/ }));
    fireEvent.click(screen.getByRole("button", { name: /Documento de identifica/ }));
    fireEvent.click(screen.getByText("Autorizo o uso do meu nome/imagem em selos vinculados.").closest("label")!.querySelector("input")!);
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/verify-email"));
    expect(body(calls)).toMatchObject({ profileType: "CELEBRIDADE", brand: null,
      celebrity: { stageName: "Nova Star", realName: "Nova Pessoa", areas: ["música", "TV"], verificationUrl: "https://instagram.com/nova", representationContact: "agente@x.com", professionalHistory: "10 anos", sealConsentGranted: true, officialPhotoUrl: "/up/official-photo.png", identityProofUrl: "/up/identity.png", fashionInterests: [] } });
  });

  it("erro do servidor com campos aparece no modal e nos campos; não navega", async () => {
    mockApi({ "GET /api/usernames/nova/availability": { available: true },
      "POST /bff/auth/register": () => new Response(JSON.stringify({ status: 422, code: "VALIDACAO", message: "Dados inválidos", details: { fields: { email: "E-mail já usado", "brand.logoUrl": "Logo grande demais" } } }), { status: 422, headers: { "content-type": "application/json" } }) });
    renderApp(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Marca" }));
    fillBase();
    submit();
    expect(await screen.findByText("Dados inválidos")).toBeTruthy();
    expect(screen.getAllByText("E-mail já usado").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Logo da marca \(Logo grande demais\)/ })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
