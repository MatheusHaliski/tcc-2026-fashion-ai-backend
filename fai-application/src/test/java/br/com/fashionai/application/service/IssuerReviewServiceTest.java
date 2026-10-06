package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.IssuerReviewService.DecisionCommand;
import br.com.fashionai.application.service.IssuerReviewService.ResubmitCommand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Política de verificação de marcas e celebridades (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md): quem é avisado
 * de um pedido, o que bloqueia uma aprovação, o que uma decisão negativa exige e como funciona o reenvio.
 */
class IssuerReviewServiceTest {
    /** CNPJ com dígitos verificadores corretos (gerado para teste). */
    private static final String CNPJ = "11.222.333/0001-81";

    private final UserRepository users = mock(UserRepository.class);
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    private final EmailSenderPort email = mock(EmailSenderPort.class);
    private final SideEffectRunner sideEffects = mock(SideEffectRunner.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final SealService seals = mock(SealService.class);
    private final MediaStoragePort storage = mock(MediaStoragePort.class);
    private final Audit audit = mock(Audit.class);
    private final IssuerVerificationPolicy policy = new IssuerVerificationPolicy(brands, celebrities);

    private IssuerReviewService service(String extraEmails) {
        IssuerReviewService s = new IssuerReviewService(users, brands, celebrities, email, sideEffects, notifications, policy, seals,
                storage, mock(MediaService.class), mock(Guard.class), audit, extraEmails, "https://fashionai.app/");
        s.setMailExecutor(Runnable::run);
        return s;
    }

    private static User user(String username, ProfileType type, String mail, boolean verified) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(u, "createdAt", Instant.parse("2026-10-01T12:00:00Z"));
        u.setUsername(username);
        u.setDisplayName(username);
        u.setProfileType(type);
        u.setEmail(mail);
        u.setEmailVerified(verified);
        u.setStatus(verified ? AccountStatus.PENDING_VALIDATION : AccountStatus.PENDING_EMAIL_VERIFICATION);
        return u;
    }

    private BrandProfile brand(User owner, ApprovalStatus status) {
        BrandProfile b = new BrandProfile();
        b.setOwner(owner);
        b.setBrandName("Atelier Lume");
        b.setSlug("atelier-lume");
        b.setCnpj(CNPJ.replaceAll("\\D", ""));
        b.setRazaoSocial("Atelier Lume Confecções Ltda");
        b.setFashionCategory("vestuario");
        b.setStoreUrl("https://www.atelierlume.com.br");
        b.setActivityProofUrl("https://cdn/restricted/users/x/documents/activity-proof-1.jpg");
        b.setApprovalStatus(status);
        when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(brands.findByOwnerId(owner.getId())).thenReturn(Optional.of(b));
        return b;
    }

    private static CurrentUser admin() {
        return new CurrentUser(UUID.randomUUID(), "analista", "ADMIN", ProfileType.ADMIN, true, AccountStatus.ACTIVE, null, null);
    }

    private static CurrentUser me(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", u.getProfileType(), u.isEmailVerified(), u.getStatus(), null, null);
    }

    /** Checklist do analista com todos os critérios obrigatórios conferidos. */
    private static Map<String, Boolean> fullChecklist() {
        return Map.of("CNPJ_ATIVO", true, "ATIVIDADE_MODA", true, "COMPROVANTE_ATIVIDADE", true, "PRESENCA_OFICIAL", true,
                "REPRESENTACAO", true, "SEM_CONFLITO", true);
    }

    // ------------------------------------------------------------------ aviso à administração

    @Test
    void listaDeEmailsExtrasSemDuplicarNemAceitarLixo() {
        assertEquals(List.of("a@x.com", "b@y.org"), IssuerReviewService.parse(" a@x.com, B@Y.org ;a@x.com, nao-e-email "));
        assertTrue(IssuerReviewService.parse("").isEmpty());
    }

    @Test
    void pedidoAvisaCadaAdminNoAppEPorEmailEOsEmailsExtras() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE);
        User adm = user("matheus_admin", ProfileType.ADMIN, "admin@fai.com", true);
        adm.setRole("ADMIN");
        adm.setStatus(AccountStatus.ACTIVE);
        when(users.findByRole("ADMIN")).thenReturn(List.of(adm));

        service("extra@fai.com").notifyAdmins(owner.getId());

        verify(notifications).notify(eq(adm.getId()), eq(owner.getId()), eq(NotificationType.ISSUER_REVIEW_REQUEST), eq("ISSUER_REVIEW"),
                eq(owner.getId()), anyString(), anyString(), eq(Map.of("href", "/admin/users?tab=approvals")));
        verify(email).send(eq("admin@fai.com"), contains("Atelier Lume"), contains("https://fashionai.app/admin/users?tab=approvals"), eq("SYSTEM"));
        verify(email).send(eq("extra@fai.com"), anyString(), contains("@atelier_lume"), eq("SYSTEM"));
    }

    @Test
    void semAdminNemEmailConfiguradoNinguemEhAvisadoEOStatusMostraIsso() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE);
        when(users.findByRole("ADMIN")).thenReturn(List.of());
        IssuerReviewService s = service("");

        s.notifyAdmins(owner.getId());

        verify(email, never()).send(anyString(), anyString(), anyString(), anyString());
        assertFalse((Boolean) s.status(me(owner)).get("adminsNotified"));
    }

    // ------------------------------------------------------------------ decisão do analista

    @Test
    void aprovacaoExigeEmailConfirmado() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", false);
        brand(owner, ApprovalStatus.PENDENTE);
        ApiException e = assertThrows(ApiException.class, () -> service("").decide(admin(), owner.getId(),
                new DecisionCommand("APROVAR", null, null, fullChecklist(), null)));
        assertEquals("EMAIL_NAO_CONFIRMADO", e.code());
    }

    @Test
    void aprovacaoExigeTodosOsObrigatoriosConferidos() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE);
        ApiException e = assertThrows(ApiException.class, () -> service("").decide(admin(), owner.getId(),
                new DecisionCommand("APROVAR", null, null, Map.of("CNPJ_ATIVO", true), null)));
        assertEquals("CRITERIOS_PENDENTES", e.code());
        @SuppressWarnings("unchecked") List<String> open = (List<String>) e.details().get("criteria");
        assertTrue(open.contains("ATIVIDADE_MODA") && !open.contains("CNPJ_ATIVO") && !open.contains("EMAIL_CONFIRMADO"));
    }

    @Test
    void formaAntigaApproveTrueNaoPulaAPolitica() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE);
        assertThrows(ApiException.class, () -> service("").decide(admin(), owner.getId(), new DecisionCommand(null, null, "ok", null, true)));
    }

    @Test
    void aprovacaoComChecklistCompletaLiberaOPerfilOficial() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        CurrentUser analyst = admin();

        Map<String, Object> r = service("").decide(analyst, owner.getId(), new DecisionCommand("APROVAR", null, null, fullChecklist(), null));

        assertEquals("APROVADO", r.get("status"));
        assertEquals(ApprovalStatus.APROVADO, b.getApprovalStatus());
        assertEquals(AccountStatus.ACTIVE, owner.getStatus());
        assertTrue(owner.isVerified() && b.isIdentityVerified() && b.isDocumentVerified());
        assertEquals(analyst.id(), b.getApprovedBy());
        assertNull(b.getReviewReasons());
        verify(seals).ensureDefaultSeals(owner);
        verify(notifications).notify(eq(owner.getId()), eq(analyst.id()), eq(NotificationType.ACCOUNT_APPROVAL), eq("ISSUER_REVIEW"), eq(owner.getId()),
                anyString(), anyString(), eq(Map.of("href", "/brands/atelier-lume?tab=CENTRAL")));
    }

    @Test
    void cnpjComDigitoErradoBloqueiaAprovacaoMesmoComChecklist() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE).setCnpj("11222333000180");
        Map<String, Boolean> all = new java.util.HashMap<>(fullChecklist());
        all.put("CNPJ_VALIDO", true);
        ApiException e = assertThrows(ApiException.class, () -> service("").decide(admin(), owner.getId(), new DecisionCommand("APROVAR", null, null, all, null)));
        assertEquals("CRITERIOS_PENDENTES", e.code());
    }

    @Test
    void recusaEPedidoDeAjustesExigemMotivoPadronizado() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        IssuerReviewService s = service("");

        assertEquals("MOTIVO_OBRIGATORIO", assertThrows(ApiException.class,
                () -> s.decide(admin(), owner.getId(), new DecisionCommand("RECUSAR", List.of(), "não", null, null))).code());
        assertEquals("MOTIVO_INVALIDO", assertThrows(ApiException.class,
                () -> s.decide(admin(), owner.getId(), new DecisionCommand("RECUSAR", List.of("NAO_GOSTEI"), null, null, null))).code());
        assertEquals("OBSERVACAO_OBRIGATORIA", assertThrows(ApiException.class,
                () -> s.decide(admin(), owner.getId(), new DecisionCommand("AJUSTES", List.of("OUTRO"), " ", null, null))).code());

        s.decide(admin(), owner.getId(), new DecisionCommand("AJUSTES", List.of("documento_ilegivel"), "Foto cortada", null, null));

        assertEquals(ApprovalStatus.AJUSTES, b.getApprovalStatus());
        assertEquals("DOCUMENTO_ILEGIVEL", b.getReviewReasons());
        Map<String, Object> st = s.status(me(owner));
        assertEquals(List.of("DOCUMENTO_ILEGIVEL"), st.get("reasons"));
        assertEquals("Foto cortada", st.get("notes"));
        assertTrue((Boolean) st.get("canResubmit"));
    }

    @Test
    void adminNaoDecideOProprioPerfil() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        brand(owner, ApprovalStatus.PENDENTE);
        CurrentUser self = new CurrentUser(owner.getId(), "atelier_lume", "ADMIN", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
        assertThrows(ApiException.class, () -> service("").decide(self, owner.getId(), new DecisionCommand("APROVAR", null, null, fullChecklist(), null)));
    }

    // ------------------------------------------------------------------ reenvio pela Central do emissor

    @Test
    void reenvioVoltaParaAFilaSomaUmEnvioEAvisaOsAdmins() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.RECUSADO);

        service("").resubmit(me(owner), new ResubmitCommand("Novo site no ar", "https://atelierlume.com", null, null, null, null, null));

        assertEquals(ApprovalStatus.PENDENTE, b.getApprovalStatus());
        assertEquals(2, b.getReviewAttempts());
        assertEquals("https://atelierlume.com", b.getStoreUrl());
        assertEquals("Novo site no ar", b.getReviewOwnerMessage());
        verify(sideEffects).run(eq("analise-perfil:aviso-admins"), any());
    }

    @Test
    void reenvioSoDepoisDeDecisaoNegativaEAteOLimite() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        IssuerReviewService s = service("");
        assertEquals("REENVIO_INDISPONIVEL", assertThrows(ApiException.class, () -> s.resubmit(me(owner), null)).code());

        b.setApprovalStatus(ApprovalStatus.AJUSTES);
        b.setReviewAttempts(IssuerVerificationPolicy.MAX_SUBMISSIONS);
        assertEquals("LIMITE_DE_ENVIOS", assertThrows(ApiException.class, () -> s.resubmit(me(owner), null)).code());
        assertFalse((Boolean) s.status(me(owner)).get("canResubmit"));
    }

    @Test
    void linkInvalidoNoReenvioEhRecusado() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.AJUSTES);
        ApiException e = assertThrows(ApiException.class, () -> service("").resubmit(me(owner),
                new ResubmitCommand(null, "javascript:alert(1)", null, null, null, null, null)));
        assertEquals("FORMULARIO_INVALIDO", e.code());
        assertEquals(ApprovalStatus.AJUSTES, b.getApprovalStatus());
    }

    @Test
    void perfilAntigoSemLinkNaoReenviaSemInformarUm() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.AJUSTES);
        b.setStoreUrl(null);
        b.setReviewAttempts(1);

        ApiException e = assertThrows(ApiException.class, () -> service("").resubmit(me(owner),
                new ResubmitCommand("Corrigi o contato", null, "comercial@atelierlume.com.br", null, null, null, null)));
        assertEquals("FORMULARIO_INVALIDO", e.code());
        assertTrue(e.details().containsKey("storeUrl"));
        // nada aplicado: nem status, nem tentativa
        assertEquals(ApprovalStatus.AJUSTES, b.getApprovalStatus());
        assertEquals(1, b.getReviewAttempts());

        service("").resubmit(me(owner), new ResubmitCommand(null, "atelierlume.com.br", null, null, null, null, null));
        assertEquals(ApprovalStatus.PENDENTE, b.getApprovalStatus());
        assertEquals("https://atelierlume.com.br", b.getStoreUrl());
    }

    @Test
    void documentoValidoComLinkInvalidoNaoCopiaODocumento() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.AJUSTES);
        String key = "restricted/pending/" + UUID.randomUUID() + "/activity-proof.jpg";
        when(storage.keyOf("https://cdn/" + key)).thenReturn(Optional.of(key));
        when(storage.publicUrl(key)).thenReturn(java.net.URI.create("https://cdn/" + key));
        when(storage.get(key)).thenReturn(new byte[]{1, 2, 3});

        assertThrows(ApiException.class, () -> service("").resubmit(me(owner),
                new ResubmitCommand(null, "javascript:alert(1)", null, null, null, "https://cdn/" + key, null)));

        // nada copiado para restricted/users/… (ficaria órfão: a limpeza só olha os prefixos pending/)
        verify(storage, never()).put(anyString(), any(), anyString());
        assertEquals("https://cdn/restricted/users/x/documents/activity-proof-1.jpg", b.getActivityProofUrl());
    }

    private CelebrityProfile celebrity(User owner, ApprovalStatus status) {
        CelebrityProfile c = new CelebrityProfile();
        c.setOwner(owner);
        c.setStageName("MC Lume");
        c.setSlug("mc-lume");
        c.setVerificationStatus(status);
        when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(celebrities.findByOwnerId(owner.getId())).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void celebridadeCorrigeONomeCivilNoReenvio() {
        User owner = user("mc_lume", ProfileType.CELEBRIDADE, "mc@lume.com", true);
        CelebrityProfile c = celebrity(owner, ApprovalStatus.AJUSTES);
        Map<String, IssuerVerificationPolicy.Auto> auto = new java.util.HashMap<>();
        policy.checks(owner, c).forEach(ch -> auto.put(ch.code(), ch.auto()));
        assertEquals(IssuerVerificationPolicy.Auto.FALHA, auto.get("NOME_CONFERE"));   // sem nome civil, nunca aprovável
        c.setVerificationUrl("https://instagram.com/mclume");

        service("").resubmit(me(owner), new ResubmitCommand(null, null, null, null, null, null, "Maria Clara Lume"));

        assertEquals("Maria Clara Lume", c.getRealName());
        policy.checks(owner, c).forEach(ch -> auto.put(ch.code(), ch.auto()));
        assertEquals(IssuerVerificationPolicy.Auto.ANALISTA, auto.get("NOME_CONFERE"));
    }

    @Test
    void celebridadeSemNomeCivilNaoReenviaComOCampoVazio() {
        User owner = user("mc_lume", ProfileType.CELEBRIDADE, "mc@lume.com", true);
        CelebrityProfile c = celebrity(owner, ApprovalStatus.AJUSTES);
        c.setReviewAttempts(1);

        for (String blank : new String[]{null, "   ", "<b></b>"}) {
            ApiException e = assertThrows(ApiException.class, () -> service("").resubmit(me(owner),
                    new ResubmitCommand(null, "https://instagram.com/mclume", null, null, null, null, blank)));
            assertEquals("FORMULARIO_INVALIDO", e.code());
            assertTrue(e.details().containsKey("realName"), String.valueOf(blank));
        }
        // nada aplicado: nem status, nem tentativa, nem o link enviado junto
        assertEquals(ApprovalStatus.AJUSTES, c.getVerificationStatus());
        assertEquals(1, c.getReviewAttempts());
        assertNull(c.getVerificationUrl());
    }

    @Test
    void celebridadeComNomeCivilGravadoReenviaSemRepetirONome() {
        User owner = user("mc_lume", ProfileType.CELEBRIDADE, "mc@lume.com", true);
        CelebrityProfile c = celebrity(owner, ApprovalStatus.AJUSTES);
        c.setRealName("Maria Clara Lume");
        c.setVerificationUrl("https://instagram.com/mclume");

        service("").resubmit(me(owner), new ResubmitCommand(null, null, null, null, null, null, null));

        assertEquals(ApprovalStatus.PENDENTE, c.getVerificationStatus());
        assertEquals("Maria Clara Lume", c.getRealName());
    }

    @Test
    void recusaNoFormatoAntigoViraMotivoPadronizado() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        service("").decide(admin(), owner.getId(), new DecisionCommand(null, null, "CNPJ baixado", null, false));
        assertEquals(ApprovalStatus.RECUSADO, b.getApprovalStatus());
        assertEquals("OUTRO", b.getReviewReasons());
        assertEquals("CNPJ baixado", b.getVerificationNotes());

        User other = user("lume_b", ProfileType.MARCA, "b@lume.com", true);
        BrandProfile b2 = brand(other, ApprovalStatus.PENDENTE);
        service("").decide(admin(), other.getId(), new DecisionCommand(null, null, null, null, false));
        assertEquals("DADOS_INCOMPLETOS", b2.getReviewReasons());
    }

    @Test
    void prazoDaPrimeiraAnaliseContaDaConfirmacaoDoEmail() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", false);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        IssuerReviewService s = service("");
        assertNull(s.dossier(b).get("reviewableSince"));           // sem e-mail confirmado o prazo não corre

        owner.setEmailVerified(true);
        s.emailConfirmed(owner);
        Instant confirmedAt = b.getReviewSubmittedAt();
        assertTrue(confirmedAt != null && confirmedAt.isAfter(owner.getCreatedAt()));
        assertEquals(confirmedAt, s.dossier(b).get("reviewableSince"));
        s.emailConfirmed(owner);                                     // idempotente
        assertEquals(confirmedAt, b.getReviewSubmittedAt());
    }

    // ------------------------------------------------------------------ verificações automáticas da política

    @Test
    void verificacoesAutomaticasDaMarca() {
        User owner = user("atelier_lume", ProfileType.MARCA, "contato@atelierlume.com.br", true);
        BrandProfile b = brand(owner, ApprovalStatus.PENDENTE);
        Map<String, IssuerVerificationPolicy.Auto> auto = new java.util.HashMap<>();
        policy.checks(owner, b).forEach(c -> auto.put(c.code(), c.auto()));
        assertEquals(IssuerVerificationPolicy.Auto.OK, auto.get("EMAIL_CONFIRMADO"));
        assertEquals(IssuerVerificationPolicy.Auto.OK, auto.get("CNPJ_VALIDO"));
        assertEquals(IssuerVerificationPolicy.Auto.ANALISTA, auto.get("CNPJ_ATIVO"));
        // e-mail no domínio do site: representação confirmada pelo sistema
        assertEquals(IssuerVerificationPolicy.Auto.OK, auto.get("REPRESENTACAO"));

        owner.setEmail("atelierlume@gmail.com");
        policy.checks(owner, b).forEach(c -> auto.put(c.code(), c.auto()));
        assertEquals(IssuerVerificationPolicy.Auto.ANALISTA, auto.get("REPRESENTACAO"));
    }

    @Test
    void celebridadeMenorDeIdadeEhBarradaPelaPolitica() {
        User owner = user("mc_lume", ProfileType.CELEBRIDADE, "mc@lume.com", true);
        owner.setBirthDate(java.time.LocalDate.now().minusYears(16).toString());
        CelebrityProfile c = new CelebrityProfile();
        c.setOwner(owner);
        c.setStageName("MC Lume");
        c.setIdentityProofUrl("https://cdn/restricted/x.jpg");
        Map<String, IssuerVerificationPolicy.Auto> auto = new java.util.HashMap<>();
        policy.checks(owner, c).forEach(ch -> auto.put(ch.code(), ch.auto()));
        assertEquals(IssuerVerificationPolicy.Auto.FALHA, auto.get("MAIOR_DE_IDADE"));
        assertEquals(IssuerVerificationPolicy.Auto.FALHA, auto.get("CONTROLE_PERFIL_OFICIAL"));   // sem link do perfil oficial
        assertEquals(IssuerVerificationPolicy.Auto.ANALISTA, auto.get("DOCUMENTO_IDENTIDADE"));
    }

    @Test
    void cnpjECodigoDeVerificacao() {
        assertTrue(IssuerVerificationPolicy.validCnpj(CNPJ));
        assertFalse(IssuerVerificationPolicy.validCnpj("11.222.333/0001-80"));
        assertFalse(IssuerVerificationPolicy.validCnpj("11111111111111"));
        assertFalse(IssuerVerificationPolicy.validCnpj(null));
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String code = IssuerVerificationPolicy.verificationCode(id);
        assertTrue(code.matches("FAI-[0-9A-F]{6}"));
        assertEquals(code, IssuerVerificationPolicy.verificationCode(id));
        assertFalse(code.equals(IssuerVerificationPolicy.verificationCode(UUID.randomUUID())));
        assertEquals("atelierlume.com.br", IssuerVerificationPolicy.domainOf("https://www.atelierlume.com.br/loja"));
        assertEquals("atelierlume.com.br", IssuerVerificationPolicy.domainOf("contato@AtelierLume.com.br"));
        assertFalse(IssuerVerificationPolicy.webUrl("javascript:alert(1)"));
    }
}
