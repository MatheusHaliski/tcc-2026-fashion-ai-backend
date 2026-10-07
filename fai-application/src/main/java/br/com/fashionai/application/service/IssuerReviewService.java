package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.IssuerVerificationPolicy.Auto;
import br.com.fashionai.application.service.IssuerVerificationPolicy.Check;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.ReviewableProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * RF1.CA07–CA09 — verificação de perfis de marca e de celebridade, conforme a política
 * (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md e {@link IssuerVerificationPolicy}).
 *
 * <ul>
 *   <li><b>Aviso à administração</b> — a cada envio (o cadastro) e reenvio, só depois do commit: notificação no app para
 *       cada conta ADMIN ativa e e-mail para elas e para {@code ISSUER_REVIEW_NOTIFY_EMAILS} (padrão: {@code FAI_ADMIN_EMAIL}).
 *       A notificação no app não depende do provedor de e-mail.</li>
 *   <li><b>Fila do analista</b> — dossiê de cada pedido (dados, verificações automáticas, documentos) e a decisão: aprovar
 *       (com a checklist completa), pedir ajustes ou recusar (com motivos padronizados).</li>
 *   <li><b>Central do emissor</b> — o dono acompanha a análise, vê o que corrigir, o código de verificação e reenvia.</li>
 * </ul>
 */
@Service
public class IssuerReviewService {
    private static final Logger log = LoggerFactory.getLogger(IssuerReviewService.class);
    public static final String DOC_IDENTITY = "identity";
    public static final String DOC_ACTIVITY = "activity-proof";

    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final EmailSenderPort email;
    private final SideEffectRunner sideEffects;
    private final NotificationService notifications;
    private final IssuerVerificationPolicy policy;
    private final SealService seals;
    private final MediaStoragePort storage;
    private final MediaService media;
    private final Guard guard;
    private final Audit audit;
    private final List<String> notifyEmails;
    private final String frontendUrl;
    private Executor mailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public IssuerReviewService(UserRepository users, BrandProfileRepository brands, CelebrityProfileRepository celebrities,
                               EmailSenderPort email, SideEffectRunner sideEffects, NotificationService notifications,
                               IssuerVerificationPolicy policy, SealService seals, MediaStoragePort storage, MediaService media,
                               Guard guard, Audit audit,
                               @Value("${fashionai.issuer-review.notify-emails:}") String notifyEmails,
                               @Value("${fashionai.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.email = email;
        this.sideEffects = sideEffects;
        this.notifications = notifications;
        this.policy = policy;
        this.seals = seals;
        this.storage = storage;
        this.media = media;
        this.guard = guard;
        this.audit = audit;
        this.notifyEmails = parse(notifyEmails);
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

    private List<User> admins() {
        return users.findByRole("ADMIN").stream().filter(a -> a.getStatus() == AccountStatus.ACTIVE).toList();
    }

    /** Há alguém para avisar: uma conta ADMIN ativa ou um e-mail configurado. */
    public boolean adminsConfigured() {
        return !notifyEmails.isEmpty() || !admins().isEmpty();
    }

    Optional<ReviewableProfile> profileOf(User u) {
        if (u.getProfileType() == ProfileType.MARCA) {
            return brands.findByOwnerId(u.getId()).map(b -> b);
        }
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrities.findByOwnerId(u.getId()).map(c -> c);
        }
        return Optional.empty();
    }

    private static String kindOf(ReviewableProfile p) {
        return p instanceof CelebrityProfile ? "CELEBRIDADE" : "MARCA";
    }

    private static String kindKey(ReviewableProfile p) {
        return p instanceof CelebrityProfile ? "issuerReview.tipo_celebridade" : "issuerReview.tipo_marca";
    }

    /** A aba Central do emissor no perfil do próprio emissor (destino das notificações e dos e-mails da decisão). */
    private static String centralPath(ReviewableProfile p) {
        return "/brands/" + p.getSlug() + "?tab=CENTRAL";
    }

    private void afterCommit(String name, Runnable task) {
        Runnable send = () -> mailExecutor.execute(() -> sideEffects.run(name, task));
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

    // ================================================================== aviso à administração

    /** Cadastro (1º envio) ou reenvio: avisa os administradores depois do commit (cadastro desfeito = nenhum aviso). */
    public void submitted(UUID userId) {
        afterCommit("analise-perfil:aviso-admins", () -> notifyAdmins(userId));
    }

    void notifyAdmins(UUID userId) {
        User u = users.findById(userId).orElse(null);
        ReviewableProfile p = u == null ? null : profileOf(u).orElse(null);
        if (p == null) {
            return;
        }
        boolean resubmission = p.getReviewAttempts() > 1;
        String name = p.publicName() == null ? u.getDisplayName() : p.publicName();
        List<User> admins = admins();
        for (User a : admins) {
            notifications.notify(a.getId(), u.getId(), NotificationType.ISSUER_REVIEW_REQUEST, "ISSUER_REVIEW", u.getId(),
                    Msg.k(resubmission ? "issuerReview.notif_admin_reenvio" : "issuerReview.notif_admin_titulo", Msg.k(kindKey(p)), name),
                    Msg.k("issuerReview.notif_admin_corpo", "@" + u.getUsername(), IssuerVerificationPolicy.SLA_BUSINESS_DAYS),
                    Map.of("href", "/admin/users?tab=approvals"));
        }
        Set<String> to = new LinkedHashSet<>(notifyEmails);
        admins.stream().filter(User::isEmailVerified).map(User::getEmail).filter(Objects::nonNull)
                .map(e -> e.trim().toLowerCase(Locale.ROOT)).forEach(to::add);
        String kind = Msg.t(kindKey(p));
        String subject = Msg.t(resubmission ? "issuerReview.assunto_admin_reenvio" : "issuerReview.assunto_admin", kind, name);
        String html = Msg.t("issuerReview.corpo_admin", IdentityService.escape(name), IdentityService.escape(u.getUsername()), kind,
                frontendUrl + "/admin/users?tab=approvals");
        for (String addr : to) {
            email.send(addr, subject, html, "SYSTEM");
        }
        if (admins.isEmpty() && to.isEmpty()) {
            log.warn("perfil emissor {} na fila de verificação, mas não há conta ADMIN ativa nem ISSUER_REVIEW_NOTIFY_EMAILS: ninguém foi avisado", userId);
        } else {
            log.info("verificação de perfil {}: {} administrador(es) avisado(s) no app, {} e-mail(s) enviado(s) ao provedor", userId, admins.size(), to.size());
        }
    }

    /** Decisão tomada: e-mail ao dono do perfil depois do commit (a notificação no app sai na própria transação). */
    private void notifyOwner(UUID userId) {
        afterCommit("analise-perfil:aviso-decisao", () -> users.findById(userId).ifPresent(u -> profileOf(u).ifPresent(p -> {
            String name = p.publicName() == null ? u.getDisplayName() : p.publicName();
            String status = p.reviewStatus().name();
            email.send(u.getEmail(), Msg.t("issuerReview.email_decisao_assunto", name, Msg.t("issuerReview.decisao." + status)),
                    Msg.t("issuerReview.email_decisao_corpo_" + status, IdentityService.escape(name), frontendUrl + centralPath(p)), "SYSTEM");
        })));
    }

    /**
     * Política §5: o prazo da primeira análise conta da confirmação do e-mail — antes dela não há análise possível. O
     * cadastro deixa o 1º envio sem data; a confirmação a grava (os reenvios gravam a própria data).
     */
    public void emailConfirmed(User u) {
        profileOf(u).filter(p -> p.reviewStatus() == ApprovalStatus.PENDENTE && p.getReviewAttempts() == 1 && p.getReviewSubmittedAt() == null)
                .ifPresent(p -> p.setReviewSubmittedAt(Instant.now()));
    }

    // ================================================================== Central do emissor (dono do perfil)

    private User owner(CurrentUser current) {
        if (current == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound("Conta"));
        if (u.getProfileType() != ProfileType.MARCA && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw ApiException.forbidden(Msg.t("admin.perfis_pessoais_nao_passam_por"));
        }
        return u;
    }

    private static List<String> reasons(ReviewableProfile p) {
        return Json.csv(p.getReviewReasons());
    }

    private static boolean negative(ApprovalStatus s) {
        return s == ApprovalStatus.AJUSTES || s == ApprovalStatus.RECUSADO || s == ApprovalStatus.SUSPENSO;
    }

    private static boolean canResubmit(ReviewableProfile p) {
        return (p.reviewStatus() == ApprovalStatus.AJUSTES || p.reviewStatus() == ApprovalStatus.RECUSADO)
                && p.getReviewAttempts() < IssuerVerificationPolicy.MAX_SUBMISSIONS;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> status(CurrentUser current) {
        User u = owner(current);
        ReviewableProfile p = profileOf(u).orElseThrow(() -> ApiException.notFound(u.getProfileType() == ProfileType.MARCA ? "Marca" : "Celebridade"));
        ApprovalStatus status = p.reviewStatus();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("profileType", u.getProfileType());
        m.put("name", p.publicName());
        m.put("slug", p.getSlug());
        m.put("status", status);
        m.put("submittedAt", p.getReviewSubmittedAt() != null ? p.getReviewSubmittedAt() : u.getCreatedAt());
        m.put("firstSubmittedAt", u.getCreatedAt());
        m.put("attempts", p.getReviewAttempts());
        m.put("maxAttempts", IssuerVerificationPolicy.MAX_SUBMISSIONS);
        m.put("canResubmit", canResubmit(p));
        m.put("emailVerified", u.isEmailVerified());
        m.put("adminsNotified", adminsConfigured());
        m.put("slaBusinessDays", p.getReviewAttempts() > 1 ? IssuerVerificationPolicy.RESUBMIT_SLA_BUSINESS_DAYS : IssuerVerificationPolicy.SLA_BUSINESS_DAYS);
        m.put("decidedAt", status == ApprovalStatus.PENDENTE ? null : p.getApprovedAt());
        // motivos e observação só numa decisão negativa (a nota interna de uma aprovação não é do dono)
        m.put("reasons", negative(status) ? reasons(p) : List.of());
        m.put("notes", negative(status) ? p.getVerificationNotes() : null);
        m.put("verificationCode", IssuerVerificationPolicy.verificationCode(u.getId()));
        m.put("checks", policy.checks(u, p).stream().map(Check::toMap).toList());
        m.put("policyVersion", IssuerVerificationPolicy.VERSION);
        Map<String, Object> editable = new LinkedHashMap<>();
        if (p instanceof BrandProfile b) {
            editable.put("storeUrl", b.getStoreUrl());
            editable.put("commercialContact", b.getCommercialContact());
            editable.put("hasDocument", b.getActivityProofUrl() != null);
            editable.put("documentKind", DOC_ACTIVITY);
        } else if (p instanceof CelebrityProfile c) {
            editable.put("verificationUrl", c.getVerificationUrl());
            editable.put("representationContact", c.getRepresentationContact());
            editable.put("realName", c.getRealName());
            editable.put("hasDocument", c.getIdentityProofUrl() != null);
            editable.put("documentKind", DOC_IDENTITY);
        }
        m.put("editable", editable);
        return m;
    }

    /**
     * O que a pessoa pode corrigir sozinha ao reenviar; {@code documentUrl} é um envio de POST /api/auth/uploads.
     * {@code realName} (celebridade): o nome civil é critério obrigatório (NOME_CONFERE) e precisa poder ser corrigido.
     */
    public record ResubmitCommand(String message, String storeUrl, String commercialContact, String verificationUrl,
                                  String representationContact, String documentUrl, String realName) {
    }

    @Transactional
    public Map<String, Object> resubmit(CurrentUser current, ResubmitCommand cmd) {
        User u = owner(current);
        ReviewableProfile p = profileOf(u).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (p.reviewStatus() != ApprovalStatus.AJUSTES && p.reviewStatus() != ApprovalStatus.RECUSADO) {
            throw ApiException.conflict("REENVIO_INDISPONIVEL", Msg.t("issuerReview.reenvio_so_apos_decisao"));
        }
        if (p.getReviewAttempts() >= IssuerVerificationPolicy.MAX_SUBMISSIONS) {
            throw ApiException.conflict("LIMITE_DE_ENVIOS", Msg.t("issuerReview.limite_de_envios", IssuerVerificationPolicy.MAX_SUBMISSIONS));
        }
        ResubmitCommand c = cmd == null ? new ResubmitCommand(null, null, null, null, null, null, null) : cmd;
        boolean celebrity = p instanceof CelebrityProfile;
        String docKind = celebrity ? DOC_IDENTITY : DOC_ACTIVITY;
        // 1) valida tudo antes de qualquer efeito: um documento só é copiado para restricted/ se o pedido inteiro passar
        //    (senão a cópia ficava órfã — fora de pending/, a limpeza dos envios abandonados não a encontra)
        Map<String, Object> errors = new LinkedHashMap<>();
        // link oficial (obrigatório): o efetivo é o enviado ou o já gravado; perfil antigo sem link (o caso do modal "sem link")
        // não pode reenviar sem informar um, senão consumiria uma tentativa e voltaria à fila com o critério em FALHA
        String link = IssuerVerificationPolicy.normalizeUrl(celebrity ? c.verificationUrl() : c.storeUrl());
        String effectiveLink = link != null ? link
                : celebrity ? ((CelebrityProfile) p).getVerificationUrl() : ((BrandProfile) p).getStoreUrl();
        if (!IssuerVerificationPolicy.webUrl(effectiveLink)) {
            errors.put(celebrity ? "verificationUrl" : "storeUrl", Msg.t("issuerReview.link_invalido"));
        }
        // nome civil (NOME_CONFERE, obrigatório): o efetivo é o enviado ou o já gravado; sem ele o reenvio só consumiria uma
        // tentativa e voltaria à fila sem poder ser aprovado
        String realName = celebrity && c.realName() != null && !c.realName().isEmpty() ? InputSanitizer.clean(c.realName(), 160) : null;
        if (celebrity && !present(realName != null ? realName : ((CelebrityProfile) p).getRealName())) {
            errors.put("realName", Msg.t("identity.nome_civil_e_obrigatorio"));
        }
        byte[] documentBytes = null;
        if (present(c.documentUrl())) {
            documentBytes = MediaService.ownedMedia(storage, null, c.documentUrl(), Set.of(MediaService.MediaScope.PENDING_RESTRICTED))
                    .filter(m -> docKind.equals(MediaService.pendingKind(m.key()))).map(m -> readQuietly(m.key())).orElse(null);
            if (documentBytes == null) {
                errors.put("documentUrl", Msg.t("identity.envie_o_arquivo_pelo_formulario"));
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        // 2) aplica
        String document = documentBytes == null ? null : storage.put("restricted/users/" + u.getId() + "/documents/" + docKind + "-"
                + System.currentTimeMillis() + ".jpg", documentBytes, "image/jpeg").url();
        if (p instanceof BrandProfile b) {
            if (present(c.storeUrl())) {
                b.setStoreUrl(IssuerVerificationPolicy.normalizeUrl(c.storeUrl()));
            }
            if (present(c.commercialContact())) {
                b.setCommercialContact(InputSanitizer.clean(c.commercialContact(), 160));
            }
            if (document != null) {
                b.setActivityProofUrl(document);
            }
        } else if (p instanceof CelebrityProfile cp) {
            if (present(c.verificationUrl())) {
                cp.setVerificationUrl(IssuerVerificationPolicy.normalizeUrl(c.verificationUrl()));
            }
            if (present(c.representationContact())) {
                cp.setRepresentationContact(InputSanitizer.clean(c.representationContact(), 160));
            }
            if (realName != null) {
                cp.setRealName(realName);
            }
            if (document != null) {
                cp.setIdentityProofUrl(document);
            }
        }
        String message = present(c.message()) ? InputSanitizer.clean(c.message(), 600) : null;
        ApprovalStatus previous = p.reviewStatus();
        p.reviewStatus(ApprovalStatus.PENDENTE);
        p.setReviewAttempts(p.getReviewAttempts() + 1);
        p.setReviewSubmittedAt(Instant.now());
        p.setReviewOwnerMessage(message);
        audit.log(current, "PERFIL_REENVIADO", "user:" + u.getId(), Map.of("attempt", p.getReviewAttempts(),
                "previous", previous.name(), "newDocument", document != null));
        submitted(u.getId());
        return status(current);
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private byte[] readQuietly(String key) {
        try {
            return storage.get(key);
        } catch (RuntimeException ex) {
            return null;                                   // envio apagado (mais de 24 h) ou inexistente
        }
    }

    // ================================================================== fila do analista (ADMIN)

    @Transactional(readOnly = true)
    public Map<String, Object> queue(CurrentUser admin) {
        guard.requireAdmin(admin);
        Comparator<ReviewableProfile> oldestFirst = Comparator.comparing(p -> p.getReviewSubmittedAt() != null ? p.getReviewSubmittedAt() : p.getCreatedAt(),
                Comparator.nullsLast(Comparator.naturalOrder()));
        List<Map<String, Object>> pending = Stream.<ReviewableProfile>concat(
                        brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.PENDENTE).stream(),
                        celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.PENDENTE).stream())
                .sorted(oldestFirst).map(this::dossier).toList();
        List<Map<String, Object>> waiting = Stream.<ReviewableProfile>concat(
                        brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.AJUSTES).stream(),
                        celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.AJUSTES).stream())
                .sorted(oldestFirst).map(this::dossier).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pending", pending);
        out.put("waitingOwner", waiting);
        out.put("criteria", Map.of("MARCA", IssuerVerificationPolicy.BRAND.stream().map(c -> Map.of("code", c.code(), "mandatory", c.mandatory())).toList(),
                "CELEBRIDADE", IssuerVerificationPolicy.CELEBRITY.stream().map(c -> Map.of("code", c.code(), "mandatory", c.mandatory())).toList()));
        out.put("reasons", IssuerVerificationPolicy.REASONS);
        out.put("policyVersion", IssuerVerificationPolicy.VERSION);
        out.put("slaBusinessDays", IssuerVerificationPolicy.SLA_BUSINESS_DAYS);
        out.put("maxSubmissions", IssuerVerificationPolicy.MAX_SUBMISSIONS);
        return out;
    }

    /** Tudo o que o analista precisa para decidir, sem os documentos (abertos um a um em {@link #document}). */
    Map<String, Object> dossier(ReviewableProfile p) {
        User u = p.getOwner();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user", Views.user(u));
        m.put("kind", kindOf(p));
        m.put("name", p.publicName());
        m.put("slug", p.getSlug());
        m.put("status", p.reviewStatus());
        m.put("email", u.getEmail());
        m.put("emailVerified", u.isEmailVerified());
        m.put("createdAt", u.getCreatedAt());
        m.put("submittedAt", p.getReviewSubmittedAt() != null ? p.getReviewSubmittedAt() : u.getCreatedAt());
        // prazo da análise: do e-mail confirmado (1º envio) ou do reenvio; sem e-mail confirmado, ainda não corre. Pedidos
        // confirmados antes desta regra não têm a data gravada e contam do cadastro.
        m.put("reviewableSince", !u.isEmailVerified() ? null : p.getReviewSubmittedAt() != null ? p.getReviewSubmittedAt() : u.getCreatedAt());
        m.put("attempts", p.getReviewAttempts());
        m.put("decidedAt", p.reviewStatus() == ApprovalStatus.PENDENTE ? null : p.getApprovedAt());
        m.put("ownerMessage", p.getReviewOwnerMessage());
        m.put("lastReasons", reasons(p));
        m.put("lastNotes", p.getVerificationNotes());
        m.put("verificationCode", IssuerVerificationPolicy.verificationCode(u.getId()));
        m.put("checks", policy.checks(u, p).stream().map(Check::toMap).toList());
        Map<String, Object> data = new LinkedHashMap<>();
        List<Map<String, Object>> docs = new ArrayList<>();
        if (p instanceof BrandProfile b) {
            data.put("razaoSocial", b.getRazaoSocial());
            data.put("nomeFantasia", b.getNomeFantasia());
            data.put("cnpj", formatCnpj(b.getCnpj()));
            data.put("fashionCategory", b.getFashionCategory());
            data.put("storeUrl", b.getStoreUrl());
            data.put("commercialContact", b.getCommercialContact());
            data.put("officialHashtag", b.getOfficialHashtag());
            data.put("logoUrl", b.getLogoUrl());
            data.put("country", b.getCountry());
            docs.add(Map.of("kind", DOC_ACTIVITY, "available", b.getActivityProofUrl() != null));
        } else if (p instanceof CelebrityProfile c) {
            data.put("stageName", c.getStageName());
            data.put("realName", c.getRealName());
            data.put("birthDate", u.getBirthDate());
            data.put("areas", Json.strings(c.getAreasJson()));
            data.put("verificationUrl", c.getVerificationUrl());
            data.put("followers", Json.map(c.getVerifiableFollowersJson()));
            data.put("professionalHistory", c.getProfessionalHistory());
            data.put("representationContact", c.getRepresentationContact());
            data.put("fashionInterests", Json.strings(c.getFashionInterestsJson()));
            data.put("sealConsentGranted", c.isSealConsentGranted());
            data.put("officialPhotoUrl", c.getAvatarUrl());
            docs.add(Map.of("kind", DOC_IDENTITY, "available", c.getIdentityProofUrl() != null));
        }
        m.put("data", data);
        m.put("documents", docs);
        return m;
    }

    static String formatCnpj(String raw) {
        String d = raw == null ? "" : raw.replaceAll("\\D", "");
        return d.length() == 14 ? d.substring(0, 2) + "." + d.substring(2, 5) + "." + d.substring(5, 8) + "/" + d.substring(8, 12) + "-" + d.substring(12) : raw;
    }

    /** Documento do pedido (identidade ou comprovante de atividade), só para ADMIN e sempre auditado. */
    @Transactional(readOnly = true)
    public byte[] document(CurrentUser admin, UUID userId, String kind) {
        guard.requireAdmin(admin);
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Conta"));
        ReviewableProfile p = profileOf(u).orElseThrow(() -> ApiException.notFound("Perfil"));
        String url = DOC_IDENTITY.equals(kind) && p instanceof CelebrityProfile c ? c.getIdentityProofUrl()
                : DOC_ACTIVITY.equals(kind) && p instanceof BrandProfile b ? b.getActivityProofUrl() : null;
        byte[] bytes = url == null ? null : media.readRestricted(url).orElse(null);
        if (bytes == null) {
            throw ApiException.notFound(Msg.t("issuerReview.documento"));
        }
        audit.log(admin, "DOCUMENTO_VERIFICACAO_ABERTO", "user:" + userId, Map.of("kind", kind));
        return bytes;
    }

    /**
     * Decisão do analista. {@code decision}: APROVAR, AJUSTES ou RECUSAR; {@code approve} é a forma antiga (true = APROVAR,
     * false = RECUSAR). A checklist marca os critérios que o analista conferiu (código → atendido).
     */
    public record DecisionCommand(String decision, List<String> reasons, String notes, Map<String, Boolean> checklist, Boolean approve) {
        String effective() {
            if (decision != null && !decision.isBlank()) {
                return decision.trim().toUpperCase(Locale.ROOT);
            }
            return approve == null ? null : approve ? "APROVAR" : "RECUSAR";
        }

        /** Recusa na forma antiga, sem {@code decision} nem motivos padronizados. */
        boolean legacyRejection() {
            return (decision == null || decision.isBlank()) && Boolean.FALSE.equals(approve);
        }
    }

    @Transactional
    public Map<String, Object> decide(CurrentUser admin, UUID userId, DecisionCommand cmd) {
        guard.requireAdmin(admin);
        if (admin.id().equals(userId)) {
            throw ApiException.forbidden(Msg.t("issuerReview.nao_analisa_o_proprio"));
        }
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Conta"));
        if (u.getProfileType() != ProfileType.MARCA && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw ApiException.badRequest("PERFIL_PESSOAL", Msg.t("admin.perfis_pessoais_nao_passam_por"));
        }
        ReviewableProfile p = profileOf(u).orElseThrow(() -> ApiException.notFound("Perfil"));
        String decision = cmd == null ? null : cmd.effective();
        if (!"APROVAR".equals(decision) && !"AJUSTES".equals(decision) && !"RECUSAR".equals(decision)) {
            throw ApiException.badRequest("DECISAO_INVALIDA", Msg.t("issuerReview.decisao_invalida"));
        }
        ApprovalStatus current = p.reviewStatus();
        // na fila: qualquer decisão; aguardando ajustes: o analista pode recusar por falta de resposta (política §5)
        if (current != ApprovalStatus.PENDENTE && !(current == ApprovalStatus.AJUSTES && "RECUSAR".equals(decision))) {
            throw ApiException.conflict("FORA_DA_FILA", Msg.t("issuerReview.pedido_fora_da_fila"));
        }
        List<String> reasons = cmd.reasons() == null ? List.of() : cmd.reasons().stream().filter(Objects::nonNull)
                .map(r -> r.trim().toUpperCase(Locale.ROOT)).distinct().toList();
        if (cmd.legacyRejection() && reasons.isEmpty()) {
            // forma antiga {approve: false, notes}: a observação vira o motivo "Outro"; sem observação, "Dados incompletos"
            // (a recusa antiga dizia "documentação insuficiente")
            reasons = List.of(cmd.notes() == null || cmd.notes().isBlank() ? "DADOS_INCOMPLETOS" : "OUTRO");
        }
        List<String> unknown = reasons.stream().filter(r -> !IssuerVerificationPolicy.REASONS.contains(r)).toList();
        if (!unknown.isEmpty()) {
            throw ApiException.badRequest("MOTIVO_INVALIDO", Msg.t("issuerReview.motivo_invalido"), Map.of("reasons", unknown));
        }
        String notes = cmd.notes() == null || cmd.notes().isBlank() ? null : InputSanitizer.clean(cmd.notes(), 500);
        List<Check> checks = policy.checks(u, p);
        Map<String, Boolean> given = cmd.checklist() == null ? Map.of() : cmd.checklist();
        Map<String, Boolean> checklist = new LinkedHashMap<>();
        for (Check c : checks) {
            checklist.put(c.code(), c.auto() == Auto.OK || (c.auto() != Auto.FALHA && Boolean.TRUE.equals(given.get(c.code()))));
        }
        boolean approved = "APROVAR".equals(decision);
        if (approved) {
            if (!u.isEmailVerified()) {
                throw new ApiException(409, "EMAIL_NAO_CONFIRMADO", Msg.t("issuerReview.email_nao_confirmado"));
            }
            List<String> open = checks.stream().filter(Check::mandatory).filter(c -> !checklist.get(c.code())).map(Check::code).toList();
            if (!open.isEmpty()) {
                throw new ApiException(409, "CRITERIOS_PENDENTES", Msg.t("issuerReview.criterios_pendentes"), Map.of("criteria", open));
            }
        } else {
            if (reasons.isEmpty()) {
                throw ApiException.badRequest("MOTIVO_OBRIGATORIO", Msg.t("issuerReview.motivo_obrigatorio"));
            }
            if (reasons.contains("OUTRO") && notes == null) {
                throw ApiException.badRequest("OBSERVACAO_OBRIGATORIA", Msg.t("issuerReview.observacao_obrigatoria"));
            }
        }
        ApprovalStatus next = approved ? ApprovalStatus.APROVADO : "AJUSTES".equals(decision) ? ApprovalStatus.AJUSTES : ApprovalStatus.RECUSADO;
        p.reviewStatus(next);
        p.setApprovedBy(admin.id());
        p.setApprovedAt(Instant.now());
        p.setVerificationNotes(notes);
        p.setReviewReasons(approved ? null : Json.csv(reasons));
        p.setReviewChecklist(Json.write(checklist));
        if (approved) {
            p.setIdentityVerified(true);
            if (p instanceof BrandProfile b) {
                b.setDocumentVerified(true);
            }
            if (p instanceof CelebrityProfile c) {
                c.setRequiresSealReview(true);             // RF21.CA19 — celebridade sempre revisa
            }
            u.setStatus(AccountStatus.ACTIVE);
            u.setVerified(true);
            seals.ensureDefaultSeals(u);
        }
        users.save(u);
        String titleKey = approved ? "admin.perfil_validado" : next == ApprovalStatus.AJUSTES ? "issuerReview.notif_ajustes_titulo" : "admin.cadastro_nao_aprovado";
        String bodyKey = approved ? "admin.seu_perfil_ja_aparece_no" : next == ApprovalStatus.AJUSTES ? "issuerReview.notif_ajustes_corpo" : "issuerReview.notif_recusa_corpo";
        notifications.notify(userId, admin.id(), NotificationType.ACCOUNT_APPROVAL, "ISSUER_REVIEW", userId, Msg.k(titleKey), Msg.k(bodyKey),
                Map.of("href", centralPath(p)));
        notifyOwner(userId);
        audit.log(admin, approved ? "PERFIL_APROVADO" : next == ApprovalStatus.AJUSTES ? "PERFIL_AJUSTES_SOLICITADOS" : "PERFIL_RECUSADO",
                "user:" + userId, Map.of("profileType", u.getProfileType().name(), "reasons", reasons, "checklist", checklist,
                        "attempt", p.getReviewAttempts(), "policy", IssuerVerificationPolicy.VERSION));
        return Map.of("userId", userId, "status", next.name(), "approved", approved);
    }
}
