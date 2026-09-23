package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DataExportRequest;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserConsent;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.ExportStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.DataExportRequestRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * RF3 + RNF6 (LGPD): dados pessoais com reautenticação, confirmação de e-mail, transparência de finalidade,
 * exportação em JSON, exclusão com carência de 30 dias, consentimento granular por finalidade (nada
 * pré-marcado, revogação com o mesmo esforço da concessão — art. 8º §5º), visibilidade do perfil.
 */
@Service
public class AccountService {
    public static final Duration DELETION_GRACE = Duration.ofDays(30);

    /** Finalidades, base legal e artigo exibidos em cada controle da seção Privacidade (artefato #6). */
    public static final Map<ConsentPurpose, String[]> PURPOSES = new LinkedHashMap<>();

    static {
        PURPOSES.put(ConsentPurpose.AI_RECOMMENDATION, new String[]{"Recomendações por IA",
                "Enviar metadados do seu acervo (peças e looks) a provedores de IA para compor looks, Copilot e DNA de Estilo.",
                "Consentimento", "Art. 7º, I"});
        PURPOSES.put(ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, new String[]{"Processamento de fotos por terceiros",
                "Enviar fotos das peças a serviços externos (remoção de fundo, detecção, provador FASHN.ai). Sem isso, tudo roda localmente.",
                "Consentimento", "Art. 7º, I"});
        PURPOSES.put(ConsentPurpose.HISTORY_FOR_RECOMMENDATION, new String[]{"Histórico para personalização",
                "Usar seu histórico de interações para ordenar feeds e curadoria de fotos.", "Consentimento", "Art. 7º, I"});
        PURPOSES.put(ConsentPurpose.PERSONALIZED_ADS, new String[]{"Anúncios personalizados",
                "Mostrar promoções de marcas conforme seu estilo.", "Consentimento", "Art. 7º, I"});
        PURPOSES.put(ConsentPurpose.PARTNER_SHARING, new String[]{"Compartilhamento com parceiros",
                "Compartilhar dados agregados com marcas parceiras em resgates de promoção.", "Consentimento", "Art. 7º, I"});
        PURPOSES.put(ConsentPurpose.BODY_MEASUREMENTS, new String[]{"Medidas corporais (dado sensível)",
                "Usar porte e tom de pele do manequim do provador para personalizar a renderização.", "Consentimento específico e destacado",
                "Art. 11, I"});
        PURPOSES.put(ConsentPurpose.FACIAL_RECOGNITION, new String[]{"Reconhecimento facial (dado sensível)",
                "Não utilizado pelo Fashion AI — o manequim nunca usa rosto real.", "Consentimento específico e destacado", "Art. 11, I"});
        PURPOSES.put(ConsentPurpose.LOCATION_HISTORY, new String[]{"Localização para clima",
                "Usar sua localização aproximada para o clima do Copilot (Open-Meteo).", "Consentimento", "Art. 7º, I"});
    }

    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final UserConsentRepository consents;
    private final VerificationCodeRepository codes;
    private final DataExportRequestRepository exports;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final CommentRepository comments;
    private final ReactionRepository reactions;
    private final SavedItemRepository saved;
    private final FollowRepository follows;
    private final PhotoRepository photos;
    private final NotificationRepository notificationRepository;
    private final DnaSchemeRepository dnaSchemes;
    private final StyleDnaRepository styleDna;
    private final AiInferenceLogRepository inferences;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final IdentityService identity;
    private final MediaStoragePort storage;
    private final EmailSenderPort email;
    private final NotificationService notifications;
    private final Audit audit;

    public AccountService(UserRepository users, UserPreferencesRepository preferences, UserConsentRepository consents,
                          VerificationCodeRepository codes, DataExportRequestRepository exports, WardrobeItemRepository pieces,
                          SchemeRepository schemes, SchemeItemRepository schemeItems, CommentRepository comments,
                          ReactionRepository reactions, SavedItemRepository saved, FollowRepository follows,
                          PhotoRepository photos, NotificationRepository notificationRepository, DnaSchemeRepository dnaSchemes,
                          StyleDnaRepository styleDna, AiInferenceLogRepository inferences, BrandProfileRepository brands,
                          CelebrityProfileRepository celebrities, IdentityService identity, MediaStoragePort storage,
                          EmailSenderPort email, NotificationService notifications, Audit audit) {
        this.users = users;
        this.preferences = preferences;
        this.consents = consents;
        this.codes = codes;
        this.exports = exports;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.comments = comments;
        this.reactions = reactions;
        this.saved = saved;
        this.follows = follows;
        this.photos = photos;
        this.notificationRepository = notificationRepository;
        this.dnaSchemes = dnaSchemes;
        this.styleDna = styleDna;
        this.inferences = inferences;
        this.brands = brands;
        this.celebrities = celebrities;
        this.identity = identity;
        this.storage = storage;
        this.email = email;
        this.notifications = notifications;
        this.audit = audit;
    }

    private User load(CurrentUser user) {
        return users.findById(user.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(CurrentUser user) {
        User u = load(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", Views.user(u));
        out.put("email", u.getEmail());
        out.put("emailVerified", u.isEmailVerified());
        out.put("phone", u.getPhone());
        out.put("birthDate", u.getBirthDate());
        out.put("bio", u.getBio());
        out.put("coverUrl", u.getCoverUrl());
        out.put("status", u.getStatus());
        out.put("role", u.getRole());
        out.put("twoFactorEnabled", u.isTwoFactorEnabled());
        out.put("termsVersion", u.getTermsVersion());
        out.put("deletionScheduledFor", u.getDeletionScheduledFor());
        out.put("lookDoDiaPanelVersion", u.getLookDoDiaPanelVersion());
        out.put("defaultSchemeVisibility", defaultVisibility(u));
        if (u.getProfileType() == ProfileType.MARCA) {
            brands.findByOwnerId(u.getId()).ifPresent(b -> out.put("brandProfile", Map.of("id", b.getId(), "slug", b.getSlug(),
                    "approvalStatus", b.getApprovalStatus(), "brandName", b.getBrandName())));
        }
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            celebrities.findByOwnerId(u.getId()).ifPresent(c -> out.put("celebrityProfile", Map.of("id", c.getId(),
                    "slug", c.getSlug(), "verificationStatus", c.getVerificationStatus(), "stageName", c.getStageName())));
        }
        out.put("consents", consents(user));
        return out;
    }

    /** RF5.CA03 — a visibilidade do esquema é herdada do perfil: conta privada → seguidores; pública → todos. */
    public static Visibility defaultVisibility(User u) {
        return u.isPrivateAccount() ? Visibility.FOLLOWERS : Visibility.PUBLIC;
    }

    public record SensitiveUpdate(String password, String email, String phone, String birthDate, Boolean twoFactorEnabled) {
    }

    @Transactional
    public Map<String, Object> updateSensitive(CurrentUser user, SensitiveUpdate cmd) {
        identity.reauthenticate(user.id(), cmd.password());
        User u = load(user);
        List<String> changed = new ArrayList<>();
        Map<String, Object> out = new LinkedHashMap<>();
        if (cmd.email() != null && !cmd.email().isBlank() && !cmd.email().trim().equalsIgnoreCase(u.getEmail())) {
            String mail = cmd.email().trim().toLowerCase(Locale.ROOT);
            if (!IdentityService.EMAIL.matcher(mail).matches()) {
                throw ApiException.badRequest("EMAIL_INVALIDO", "Formato de e-mail inválido.");
            }
            if (users.existsByEmailHash(Hashing.emailHash(mail))) {
                throw ApiException.conflict("EMAIL_EM_USO", "Este e-mail já está em uso.");
            }
            String code = Hashing.numericCode(6);
            VerificationCode vc = new VerificationCode();
            vc.setUser(u);
            vc.setPurpose(VerificationPurpose.EMAIL_CHANGE);
            vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
            vc.setTarget(mail);
            vc.setExpiresAt(Instant.now().plus(Duration.ofHours(2)));
            vc.setLastSentAt(Instant.now());
            codes.save(vc);
            email.send(mail, "Confirme o novo e-mail", "<p>Código para confirmar o novo e-mail: <b>" + code + "</b></p>", "SECURITY");
            email.send(u.getEmail(), "Pedido de troca de e-mail", "<p>Foi pedida a troca do e-mail da sua conta para "
                    + IdentityService.maskEmail(mail) + ". Se não foi você, troque sua senha.</p>", "SECURITY");
            out.put("emailChangePending", IdentityService.maskEmail(mail));
            changed.add("email(pendente)");
        }
        if (cmd.phone() != null) {
            u.setPhone(cmd.phone().isBlank() ? null : cmd.phone().replaceAll("[^0-9+]", ""));
            changed.add("phone");
        }
        if (cmd.birthDate() != null) {
            u.setBirthDate(cmd.birthDate().isBlank() ? null : cmd.birthDate());
            changed.add("birthDate");
        }
        if (cmd.twoFactorEnabled() != null) {
            u.setTwoFactorEnabled(cmd.twoFactorEnabled());
            changed.add("twoFactor");
        }
        audit.log(user, AuditActions.ALTERACAO_DADO_PESSOAL_SENSIVEL, "user:" + u.getId(), Map.of("fields", changed));
        out.put("changed", changed);
        return out;
    }

    @Transactional
    public Views.UserCard confirmEmailChange(CurrentUser user, String code) {
        User u = load(user);
        VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                VerificationPurpose.EMAIL_CHANGE).orElseThrow(() -> ApiException.badRequest("CODIGO_INVALIDO", "Nenhuma troca pendente."));
        if (vc.getExpiresAt().isBefore(Instant.now()) || !vc.getCodeHash().equals(Hashing.sha256(u.getId() + ":" + code))) {
            throw ApiException.badRequest("CODIGO_INVALIDO", "Código inválido ou expirado.");
        }
        vc.setConsumedAt(Instant.now());
        u.setEmail(vc.getTarget());
        u.setEmailHash(Hashing.emailHash(vc.getTarget()));
        u.setEmailVerified(true);
        audit.log(user, AuditActions.ALTERACAO_DADO_PESSOAL_SENSIVEL, "user:" + u.getId(), Map.of("fields", List.of("email")));
        return Views.user(u);
    }

    /** RF3.CA12 — visibilidade do perfil (privacy by default: nasce privada). */
    @Transactional
    public Map<String, Object> updatePrivacy(CurrentUser user, boolean privateAccount) {
        User u = load(user);
        u.setPrivateAccount(privateAccount);
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of("privateAccount", privateAccount));
        return Map.of("privateAccount", privateAccount, "defaultSchemeVisibility", defaultVisibility(u));
    }

    // ------------------------------------------------------------------ consentimentos
    @Transactional(readOnly = true)
    public List<Map<String, Object>> consents(CurrentUser user) {
        Map<ConsentPurpose, UserConsent> current = new LinkedHashMap<>();
        consents.findByUserId(user.id()).forEach(c -> current.put(c.getPurpose(), c));
        List<Map<String, Object>> out = new ArrayList<>();
        PURPOSES.forEach((purpose, info) -> {
            UserConsent c = current.get(purpose);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("purpose", purpose.name());
            m.put("title", info[0]);
            m.put("description", info[1]);
            m.put("legalBasis", info[2]);
            m.put("lgpdArticle", info[3]);
            m.put("sensitive", info[3].startsWith("Art. 11"));
            m.put("granted", c != null && c.isGranted());
            m.put("grantedAt", c == null ? null : c.getGrantedAt());
            m.put("revokedAt", c == null ? null : c.getRevokedAt());
            m.put("policyVersion", IdentityService.TERMS_VERSION);
            out.add(m);
        });
        return out;
    }

    @Transactional
    public List<Map<String, Object>> setConsent(CurrentUser user, ConsentPurpose purpose, boolean granted) {
        if (purpose == ConsentPurpose.FACIAL_RECOGNITION && granted) {
            throw ApiException.badRequest("FINALIDADE_NAO_UTILIZADA", "O Fashion AI não usa reconhecimento facial.");
        }
        User u = load(user);
        UserConsent c = consents.findByUserIdAndPurpose(u.getId(), purpose).orElseGet(() -> {
            UserConsent n = new UserConsent();
            n.setUser(u);
            n.setPurpose(purpose);
            return n;
        });
        c.setGranted(granted);
        c.setLegalBasis(PURPOSES.get(purpose)[2]);
        c.setPolicyVersion(IdentityService.TERMS_VERSION);
        if (granted) {
            c.setGrantedAt(Instant.now());
            c.setRevokedAt(null);
        } else {
            c.setRevokedAt(Instant.now());
        }
        consents.save(c);
        audit.log(user, granted ? AuditActions.CONSENTIMENTO_CONCEDIDO : AuditActions.CONSENTIMENTO_REVOGADO,
                "consent:" + purpose, Map.of("purpose", purpose.name()));
        return consents(user);
    }

    // ------------------------------------------------------------------ exportação (RF3.CA04 / CA24)
    @Transactional
    public Map<String, Object> requestExport(CurrentUser user) {
        User u = load(user);
        DataExportRequest req = new DataExportRequest();
        req.setUser(u);
        req.setStatus(ExportStatus.PROCESSING);
        exports.save(req);
        Map<String, Object> data = exportData(u);
        byte[] json = Json.write(data).getBytes(StandardCharsets.UTF_8);
        MediaStoragePort.StoredObject stored = storage.put("users/" + u.getId() + "/exports/" + req.getId() + ".json", json,
                "application/json");
        req.setFileKey(stored.key());
        req.setStatus(ExportStatus.READY);
        req.setReadyAt(Instant.now());
        req.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));
        notifications.notify(u.getId(), null, NotificationType.DATA_EXPORT_READY, "EXPORT", req.getId(),
                "Seus dados estão prontos", "A exportação em JSON fica disponível por 7 dias em Configurações › Seus dados.", null);
        audit.log(user, AuditActions.EXPORTACAO_CONTA, "export:" + req.getId(), Map.of("bytes", json.length));
        return Map.of("id", req.getId(), "status", req.getStatus(), "readyAt", req.getReadyAt(), "expiresAt", req.getExpiresAt(),
                "bytes", json.length);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportsOf(CurrentUser user) {
        return exports.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("status", e.getExpiresAt() != null && e.getExpiresAt().isBefore(Instant.now()) ? ExportStatus.EXPIRED : e.getStatus());
            m.put("readyAt", e.getReadyAt());
            m.put("expiresAt", e.getExpiresAt());
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public byte[] downloadExport(CurrentUser user, UUID exportId) {
        DataExportRequest req = exports.findById(exportId).orElseThrow(() -> ApiException.notFound("Exportação"));
        if (!req.getUser().getId().equals(user.id())) {
            throw ApiException.forbidden("Exportação de outro usuário.");
        }
        if (req.getExpiresAt() != null && req.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(410, "EXPORTACAO_EXPIRADA", "Esta exportação expirou. Gere uma nova.");
        }
        return storage.get(req.getFileKey());
    }

    Map<String, Object> exportData(User u) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", Instant.now());
        data.put("format", "Fashion AI — exportação LGPD (art. 18, V)");
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", u.getId());
        profile.put("username", u.getUsername());
        profile.put("displayName", u.getDisplayName());
        profile.put("email", u.getEmail());
        profile.put("phone", u.getPhone());
        profile.put("birthDate", u.getBirthDate());
        profile.put("bio", u.getBio());
        profile.put("country", u.getCountry());
        profile.put("profileType", u.getProfileType());
        profile.put("privateAccount", u.isPrivateAccount());
        profile.put("createdAt", u.getCreatedAt());
        profile.put("termsAcceptedAt", u.getTermsAcceptedAt());
        data.put("profile", profile);
        preferences.findByUserId(u.getId()).ifPresent(p -> data.put("preferences", Map.of("theme", p.getTheme(),
                "language", p.getLanguage(), "density", p.getDensity(), "fontScale", p.getFontScale(),
                "chromeBackgroundId", String.valueOf(p.getChromeBackgroundId()))));
        data.put("consents", consents.findByUserId(u.getId()).stream().map(c -> Map.of("purpose", c.getPurpose(),
                "granted", c.isGranted(), "grantedAt", String.valueOf(c.getGrantedAt()), "revokedAt", String.valueOf(c.getRevokedAt()))).toList());
        List<WardrobeItem> myPieces = pieces.findByUserIdOrderByCreatedAtDesc(u.getId());
        data.put("pieces", myPieces.stream().map(p -> Views.piece(p, null, null)).toList());
        List<Scheme> mySchemes = schemes.findByUserIdOrderByCreatedAtDesc(u.getId());
        data.put("schemes", mySchemes.stream().map(s -> Views.scheme(s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()),
                null, null)).toList());
        data.put("comments", comments.findByAuthorId(u.getId()).stream().map(c -> Map.of("id", c.getId(), "targetType",
                c.getTargetType(), "targetId", c.getTargetId(), "content", c.getContent(), "createdAt", c.getCreatedAt())).toList());
        data.put("saved", saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(u.getId(), br.com.fashionai.domain.model.enums.TargetType.SCHEME)
                .stream().map(s -> Map.of("targetId", s.getTargetId(), "savedAt", s.getSavedAt())).toList());
        data.put("following", follows.findByFollowerIdAndStatus(u.getId(), FollowStatus.ACEITO).stream()
                .map(f -> f.getFollowing().getUsername()).toList());
        data.put("photos", photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u.getId()).stream().map(Views::photo).toList());
        data.put("notifications", notificationRepository.findTop100ByRecipientIdAndDeliveredTrueOrderByCreatedAtDesc(u.getId())
                .stream().map(Views::notification).toList());
        data.put("styleDna", styleDna.findByUserId(u.getId()).map(d -> Map.of("archetype", String.valueOf(d.getArchetype()),
                "boldnessIndex", d.getBoldnessIndex(), "identityPhrase", String.valueOf(d.getIdentityPhrase()))).orElse(null));
        data.put("dnaSchemes", dnaSchemes.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().map(d -> Map.of("id", d.getId(),
                "title", d.getTitle(), "createdAt", d.getCreatedAt())).toList());
        data.put("aiInferences", inferences.findTop100ByUserIdOrderByCreatedAtDesc(u.getId()).stream().map(i -> Map.of(
                "capability", i.getCapability(), "provider", i.getProvider(), "model", i.getModel(), "result", i.getResult(),
                "createdAt", i.getCreatedAt())).toList());
        return data;
    }

    // ------------------------------------------------------------------ exclusão (RF3.CA05)
    @Transactional
    public Map<String, Object> requestDeletion(CurrentUser user, String password) {
        identity.reauthenticate(user.id(), password);
        User u = load(user);
        u.setDeletionRequestedAt(Instant.now());
        u.setDeletionScheduledFor(Instant.now().plus(DELETION_GRACE));
        u.setStatus(AccountStatus.DELETION_SCHEDULED);
        email.send(u.getEmail(), "Exclusão de conta agendada", "<p>Sua conta será excluída em "
                + u.getDeletionScheduledFor() + ". Você pode cancelar até lá em Configurações › Seus dados.</p>", "SECURITY");
        audit.log(user, AuditActions.EXCLUSAO_CONTA, "user:" + u.getId(), Map.of("scheduledFor", u.getDeletionScheduledFor().toString()));
        return Map.of("status", u.getStatus(), "deletionScheduledFor", u.getDeletionScheduledFor());
    }

    @Transactional
    public Map<String, Object> cancelDeletion(CurrentUser user) {
        User u = load(user);
        if (u.getStatus() != AccountStatus.DELETION_SCHEDULED) {
            return Map.of("status", u.getStatus());
        }
        u.setDeletionRequestedAt(null);
        u.setDeletionScheduledFor(null);
        u.setStatus(!u.isEmailVerified() ? AccountStatus.PENDING_EMAIL_VERIFICATION : pendingApproval(u)
                ? AccountStatus.PENDING_VALIDATION : AccountStatus.ACTIVE);
        audit.log(user, AuditActions.EXCLUSAO_CANCELADA, "user:" + u.getId(), Map.of());
        return Map.of("status", u.getStatus());
    }

    private boolean pendingApproval(User u) {
        return switch (u.getProfileType()) {
            case MARCA -> brands.findByOwnerId(u.getId()).map(b -> b.getApprovalStatus() != ApprovalStatus.APROVADO).orElse(true);
            case CELEBRIDADE -> celebrities.findByOwnerId(u.getId()).map(c -> c.getVerificationStatus() != ApprovalStatus.APROVADO).orElse(true);
            default -> false;
        };
    }

    /** Job diário: conclui exclusões vencidas por anonimização irreversível (LGPD art. 16/18). */
    @Transactional
    public int purgeScheduledDeletions() {
        int count = 0;
        for (User u : users.findByStatus(AccountStatus.DELETION_SCHEDULED)) {
            if (u.getDeletionScheduledFor() == null || u.getDeletionScheduledFor().isAfter(Instant.now())) {
                continue;
            }
            String tag = u.getId().toString().substring(0, 8);
            for (WardrobeItem p : pieces.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                p.setVisibility(Visibility.PRIVATE);
                p.setDisponivel(false);
                p.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
            }
            for (Scheme s : schemes.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                s.setVisibility(Visibility.PRIVATE);
                s.setStatus(SchemeStatus.ARCHIVED);
            }
            comments.findByAuthorId(u.getId()).forEach(c -> {
                c.setContent("[comentário removido]");
                c.setActive(false);
            });
            photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u.getId()).forEach(p -> {
                try {
                    storage.delete(p.getStorageKey());
                } catch (RuntimeException ignored) {
                    // objeto já ausente
                }
                p.setDeletedAt(Instant.now());
            });
            u.setUsername("deleted_" + tag);
            u.setDisplayName("Conta excluída");
            u.setEmail("deleted+" + tag + "@fashionai.invalid");
            u.setEmailHash(Hashing.sha256("deleted:" + u.getId() + ":" + Hashing.randomToken(8)));
            u.setPhone(null);
            u.setBirthDate(null);
            u.setBio(null);
            u.setAvatarUrl(null);
            u.setCoverUrl(null);
            u.setPasswordHash(Hashing.randomToken(32));
            u.setStatus(AccountStatus.DELETED);
            identity.revokeOtherSessions(u.getId(), null);
            audit.log("system", AuditActions.EXCLUSAO_CONTA, "user:" + u.getId(), "CONCLUIDA", null, null, Map.of());
            count++;
        }
        return count;
    }
}
