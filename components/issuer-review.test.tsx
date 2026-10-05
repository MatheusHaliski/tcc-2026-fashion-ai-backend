// @vitest-environment jsdom
/**
 * Verificação de marcas e celebridades (RF1.CA07–CA09): a Central do emissor mostra o que o analista pediu e reenvia o
 * pedido; a fila do analista só libera "Aprovar" com a checklist completa e exige motivo para pedir ajustes ou recusar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { IssuerCenter, useIssuerReview, type IssuerReview } from "./issuer-review";
import { AdminApprovals, businessDaysSince, type Dossier, type ReviewQueue } from "./admin-approvals";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const REVIEW: IssuerReview = {
  profileType: "MARCA", name: "Atelier Lume", slug: "atelier-lume", status: "AJUSTES", submittedAt: "2026-10-01T12:00:00Z", firstSubmittedAt: "2026-10-01T12:00:00Z",
  attempts: 1, maxAttempts: 5, canResubmit: true, emailVerified: true, adminsNotified: true, slaBusinessDays: 3, decidedAt: "2026-10-02T12:00:00Z",
  reasons: ["DOCUMENTO_ILEGIVEL"], notes: "Foto cortada", verificationCode: "FAI-1A2B3C", policyVersion: "1.0",
  checks: [{ code: "EMAIL_CONFIRMADO", mandatory: true, auto: "OK" }, { code: "COMPROVANTE_ATIVIDADE", mandatory: true, auto: "ANALISTA" }],
  editable: { storeUrl: "https://atelierlume.com.br", commercialContact: "contato@atelierlume.com.br", hasDocument: true, documentKind: "activity-proof" },
};

function Central() {
  const review = useIssuerReview();
  return <IssuerCenter review={review} />;
}

describe("Central do emissor", () => {
  it("mostra o motivo, o código de verificação e reenvia o pedido", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/issuer-review": REVIEW, "POST /api/me/issuer-review/resubmit": { ...REVIEW, status: "PENDENTE", attempts: 2 } });
    renderApp(<Central />);
    expect(await screen.findByText(/O documento enviado está ilegível/)).toBeTruthy();
    expect(screen.getAllByText("FAI-1A2B3C").length).toBeGreaterThan(0);   // celular e lateral do desktop (um dos dois escondido por CSS)
    expect(screen.getByText(/Foto cortada/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Site, loja on-line/), { target: { value: "https://lume.com" } });
    fireEvent.change(screen.getByLabelText(/Mensagem ao analista/), { target: { value: "Novo comprovante" } });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar para análise/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/issuer-review/resubmit")).toBe(true));
    const body = calls.find((c) => c.path === "/api/me/issuer-review/resubmit")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ storeUrl: "https://lume.com", message: "Novo comprovante" });
  });

  it("celebridade sem nome civil não reenvia com o campo vazio", async () => {
    const celeb: IssuerReview = { ...REVIEW, profileType: "CELEBRIDADE", reasons: ["DADOS_INCOMPLETOS"],
      editable: { verificationUrl: "https://instagram.com/lume", representationContact: null, realName: null, hasDocument: true, documentKind: "identity" } };
    const { calls } = loggedAs(undefined, { "GET /api/me/issuer-review": celeb });
    renderApp(<Central />);
    fireEvent.click(await screen.findByRole("button", { name: /Reenviar para análise/ }));
    expect(await screen.findByText("Informe o nome civil, como está no documento.")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/me/issuer-review/resubmit")).toBe(false);
  });

  it("celebridade corrige o nome civil no reenvio", async () => {
    const celeb: IssuerReview = { ...REVIEW, profileType: "CELEBRIDADE", reasons: ["DADOS_INCOMPLETOS"],
      editable: { verificationUrl: "https://instagram.com/lume", representationContact: null, realName: "", hasDocument: true, documentKind: "identity" } };
    const { calls } = loggedAs(undefined, { "GET /api/me/issuer-review": celeb, "POST /api/me/issuer-review/resubmit": { ...celeb, status: "PENDENTE", attempts: 2 } });
    renderApp(<Central />);
    fireEvent.change(await screen.findByLabelText(/Nome civil/), { target: { value: "Maria Lume" } });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar para análise/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/issuer-review/resubmit")).toBe(true));
    expect(calls.find((c) => c.path === "/api/me/issuer-review/resubmit")!.body).toMatchObject({ realName: "Maria Lume", verificationUrl: "https://instagram.com/lume" });
  });

  it("API de versão anterior (sem critérios, motivos nem campos editáveis) não derruba a página", async () => {
    // resposta do GET /api/me/issuer-review antes da política de verificação (b7e0695)
    const old = { profileType: "CELEBRIDADE", name: "Lume", status: "AJUSTES", submittedAt: "2026-10-01T12:00:00Z", emailVerified: true, adminsNotified: true, decidedAt: null, reason: null };
    loggedAs(undefined, { "GET /api/me/issuer-review": old });
    renderApp(<Central />);
    expect(await screen.findByText("Critérios da verificação")).toBeTruthy();
    expect(screen.getByText("O que corrigir")).toBeTruthy();
  });
});

const DOSSIER: Dossier = {
  user: { id: "b1", username: "atelier_lume", displayName: "Atelier Lume", profileType: "MARCA", verified: false, privateAccount: true, country: "BR" } as Dossier["user"],
  kind: "MARCA", name: "Atelier Lume", slug: "atelier-lume", status: "PENDENTE", email: "contato@atelierlume.com.br", emailVerified: true,
  createdAt: "2026-10-01T12:00:00Z", submittedAt: "2026-10-01T12:00:00Z", reviewableSince: "2026-10-01T12:00:00Z", attempts: 1, lastReasons: [], verificationCode: "FAI-1A2B3C",
  checks: [{ code: "EMAIL_CONFIRMADO", mandatory: true, auto: "OK" }, { code: "CNPJ_ATIVO", mandatory: true, auto: "ANALISTA" }, { code: "PERFIL_COMPLETO", mandatory: false, auto: "FALHA" }],
  data: { razaoSocial: "Atelier Lume Ltda", cnpj: "11.222.333/0001-81", storeUrl: "https://atelierlume.com.br" }, documents: [{ kind: "activity-proof", available: true }],
};
const QUEUE: ReviewQueue = { pending: [DOSSIER], waitingOwner: [], reasons: ["DOCUMENTO_ILEGIVEL", "OUTRO"], policyVersion: "1.0", slaBusinessDays: 3, maxSubmissions: 5 };

describe("fila de verificação (admin)", () => {
  it("só aprova com os obrigatórios conferidos e só recusa com motivo", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/admin/approvals/b1": { status: "RECUSADO" } });
    renderApp(<AdminApprovals queue={QUEUE} onChanged={() => undefined} />);
    const approve = await screen.findByRole("button", { name: "Aprovar" }) as HTMLButtonElement;
    const reject = screen.getByRole("button", { name: "Rejeitar" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("CNPJ ativo e razão social conferida"));
    expect(approve.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Documento ilegível" }));
    expect(reject.disabled).toBe(false);
    fireEvent.click(reject);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/admin/approvals/b1")).toBe(true));
    expect(calls.find((c) => c.path === "/api/admin/approvals/b1")!.body).toMatchObject({ decision: "RECUSAR", reasons: ["DOCUMENTO_ILEGIVEL"] });
  });

  it("o prazo só corre depois do e-mail confirmado", async () => {
    loggedAs(undefined, {});
    const unconfirmed: Dossier = { ...DOSSIER, emailVerified: false, reviewableSince: null };
    renderApp(<AdminApprovals queue={{ ...QUEUE, pending: [unconfirmed] }} onChanged={() => undefined} />);
    expect(await screen.findByText("aguardando o e-mail ser confirmado")).toBeTruthy();
    expect(screen.queryByText(/na fila há|entrou na fila hoje|atrasado/i)).toBeNull();
  });

  it("conta só dias úteis no prazo", () => {
    // sexta → segunda seguinte: um dia útil
    expect(businessDaysSince("2026-10-02T12:00:00", new Date("2026-10-05T12:00:00"))).toBe(1);
  });
});
