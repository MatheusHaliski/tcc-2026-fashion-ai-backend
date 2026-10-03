package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * RF1.CA07/CA09 — análise do perfil de marca/celebridade.
 *
 * <ul>
 *   <li>Depois do cadastro (e só depois do commit), os administradores do FashionAI recebem um e-mail pedindo a decisão
 *       de aceite. Administradores = os e-mails de {@code DEV_GATE_ALLOWED_EMAILS} (a mesma lista do gate).</li>
 *   <li>O "Painel do examinador" do dono do perfil lê {@link #status}: enviado → e-mail confirmado → em análise →
 *       decisão (aprovado/recusado, com o motivo), atualizado a cada decisão do admin.</li>
 * </ul>
 * O e-mail aos admins leva só o necessário para decidir (nome público, @usuário, tipo e o link da fila); documentos e
 * dados fiscais ficam na tela de administração.
 */
@Service
public class IssuerReviewService {
    private static final Logger log = LoggerFactory.getLogger(IssuerReviewService.class);

    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final EmailSenderPort email;
    private final SideEffectRunner sideEffects;
    private final List<String> adminEmails;
    private final String frontendUrl;
    private Executor mailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public IssuerReviewService(UserRepository users, BrandProfileRepository brands, CelebrityProfileRepository celebrities,
                               EmailSenderPort email, SideEffectRunner sideEffects,
                               @Value("${fashionai.dev-gate.allowed-emails:}") String adminEmails,
                               @Value("${fashionai.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.email = email;
        this.sideEffects = sideEffects;
        this.adminEmails = parse(adminEmails);
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /** Testes: envio na mesma thread. */
    void setMailExecutor(Executor executor) {
        this.mailExecutor = executor;
    }

    static List<String> parse(String csv) {
        List<String> out = new ArrayList<>();
        if (csv == null) {
            return out;
        }
        Arrays.stream(csv.split("[,;\\s]+")).map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> s.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+") && !out.contains(s)).forEach(out::add);
        return out;
    }

    public boolean adminsConfigured() {
        return !adminEmails.isEmpty();
    }

    // ------------------------------------------------------------------ aviso aos administradores

    /** Chamado no cadastro: agenda o e-mail aos admins para depois do commit (cadastro desfeito = nenhum e-mail). */
    public void submitted(UUID userId) {
        if (adminEmails.isEmpty()) {
            log.warn("perfil emissor {} aguardando análise, mas DEV_GATE_ALLOWED_EMAILS está vazio: nenhum administrador avisado por e-mail", userId);
            return;
        }
        Runnable send = () -> mailExecutor.execute(() -> sideEffects.run("analise-perfil:aviso-admins", () -> notifyAdmins(userId)));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    void notifyAdmins(UUID userId) {
        User u = users.findById(userId).orElse(null);
        if (u == null || u.getProfileType() == ProfileType.PESSOAL) {
            return;
        }
        boolean celebrity = u.getProfileType() == ProfileType.CELEBRIDADE;
        String name = celebrity ? celebrities.findByOwnerId(userId).map(CelebrityProfile::getStageName).orElse(u.getDisplayName())
                : brands.findByOwnerId(userId).map(BrandProfile::getBrandName).orElse(u.getDisplayName());
        String kind = Msg.t(celebrity ? "issuerReview.tipo_celebridade" : "issuerReview.tipo_marca");
        String link = frontendUrl + "/admin/users?tab=approvals";
        String subject = Msg.t("issuerReview.assunto_admin", kind, name);
        String html = Msg.t("issuerReview.corpo_admin", IdentityService.escape(name), IdentityService.escape(u.getUsername()), kind, link);
        for (String to : adminEmails) {
            email.send(to, subject, html, "SYSTEM");
        }
        log.info("análise de perfil {}: {} administrador(es) avisado(s) por e-mail", userId, adminEmails.size());
    }

    // ------------------------------------------------------------------ painel do examinador (dono do perfil)

    @Transactional(readOnly = true)
    public Map<String, Object> status(CurrentUser current) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound("Conta"));
        if (u.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.forbidden(Msg.t("admin.perfis_pessoais_nao_passam_por"));
        }
        ApprovalStatus status;
        Instant decidedAt;
        String notes;
        String name;
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            CelebrityProfile c = celebrities.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Celebridade"));
            status = c.getVerificationStatus();
            decidedAt = c.getApprovedAt();
            notes = c.getVerificationNotes();
            name = c.getStageName();
        } else {
            BrandProfile b = brands.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Marca"));
            status = b.getApprovalStatus();
            decidedAt = b.getApprovedAt();
            notes = b.getVerificationNotes();
            name = b.getBrandName();
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("profileType", u.getProfileType());
        m.put("name", name);
        m.put("status", status);
        m.put("submittedAt", u.getCreatedAt());
        m.put("emailVerified", u.isEmailVerified());
        m.put("adminsNotified", adminsConfigured());
        m.put("decidedAt", status == ApprovalStatus.PENDENTE ? null : decidedAt);
        // o motivo só aparece para recusa/suspensão (a nota interna de uma aprovação não é do dono)
        m.put("reason", status == ApprovalStatus.RECUSADO || status == ApprovalStatus.SUSPENSO ? notes : null);
        return m;
    }
}
