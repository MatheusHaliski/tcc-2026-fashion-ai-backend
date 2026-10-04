package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.model.enums.UiLanguage;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * RF1 (cadastro Pessoal, Marca, Celebridade), RF2 (login) e RNF2 (JWT + refresh rotativo e recuperação
 * de sessão), com RF3.CA07–CA10 / CA29–CA33 (recuperação de senha, logout invalidando no servidor, sessões
 * ativas, troca de senha encerrando as demais sessões). Senhas só como hash Argon2 (RNF3/RF1.CA04).
 */
@Service
public class IdentityService {
    public static final Pattern EMAIL = Pattern.compile("^[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$");
    public static final String TERMS_VERSION = "2026-09";
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(IdentityService.class);
    private static final int MAX_LOGIN_FAILURES = 5;
    private static final Duration LOCK_WINDOW = Duration.ofMinutes(15);
    static final String LOGIN_FAIL = "login-fail";
    /** Tentativas erradas por código de 6 dígitos (e-mail, troca de e-mail, 2FA): depois disso ele é invalidado. */
    public static final int MAX_CODE_ATTEMPTS = 5;
    /** Tentativas por hora e finalidade, contadas no RateLimitPort (atômico): segura palpites em paralelo. */
    static final int CODE_ATTEMPTS_PER_HOUR = 10;
    /** @ que ninguém escolhe no cadastro nem na troca (a conta de administração vem do AdminBootstrap). */
    public static final Set<String> RESERVED_USERNAMES = Set.of("admin", "administrador", "administrator", "adm", "root",
            "support", "suporte", "fashionai", "fashion_ai", "fashion.ai", "fai", "api", "gate", "system", "sistema",
            "moderador", "moderadora", "moderator", "moderacao", "staff", "equipe", "oficial", "official", "seguranca",
            "security", "ajuda", "help", "contato", "null", "undefined", "anonymous", "anonimo");

    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final RefreshTokenRepository refreshTokens;
    private final VerificationCodeRepository codes;
    private final PasswordHasherPort hasher;
    private final TokenIssuerPort tokens;
    private final RateLimitPort rateLimit;
    private final EmailSenderPort email;
    private final NotificationService notifications;
    private final Audit audit;
    private final String frontendUrl;
    private final String dummyHash;
    private final MediaStoragePort storage;
    /** Envio fora da requisição (redefinição de senha): o tempo de resposta não depende de o e-mail existir. */
    private Executor mailExecutor = Executors.newVirtualThreadPerTaskExecutor();
    /** Aviso aos administradores e Central do emissor (opcional: testes montam o serviço sem ele). */
    private IssuerReviewService issuerReview;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setIssuerReview(IssuerReviewService issuerReview) {
        this.issuerReview = issuerReview;
    }

    public IdentityService(UserRepository users, UserPreferencesRepository preferences, BrandProfileRepository brands,
                           CelebrityProfileRepository celebrities, RefreshTokenRepository refreshTokens,
                           VerificationCodeRepository codes, PasswordHasherPort hasher, TokenIssuerPort tokens,
                           RateLimitPort rateLimit, EmailSenderPort email, NotificationService notifications, Audit audit,
                           MediaStoragePort storage,
                           @Value("${fashionai.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.storage = storage;
        this.users = users;
        this.preferences = preferences;
        this.brands = brands;
        this.celebrities = celebrities;
        this.refreshTokens = refreshTokens;
        this.codes = codes;
        this.hasher = hasher;
        this.tokens = tokens;
        this.rateLimit = rateLimit;
        this.email = email;
        this.notifications = notifications;
        this.audit = audit;
        this.frontendUrl = frontendUrl;
        this.dummyHash = hasher.hash("fashion-ai-timing-" + UUID.randomUUID());
    }

    // ------------------------------------------------------------------ RF1
    /** Tipos de arquivo que o formulário de cadastro envia antes de a conta existir. */
    private static final Map<String, Integer> PRE_UPLOAD_SIZE = Map.of("avatar", 640, "logo", 640, "official-photo", 1024,
            "identity", 1600, "activity-proof", 1600);

    /**
     * RF1 — foto de perfil (e logo/foto oficial/documentos de marca e celebridade) enviada pelo formulário de cadastro,
     * antes de existir conta. Limite por IP; imagem validada pelo conteúdo e recodificada em JPEG (tira EXIF/GPS).
     * Documentos ficam em {@code restricted/}, que só administradores leem.
     */
    public Map<String, Object> preRegistrationUpload(byte[] bytes, String kind, String ip) {
        Integer size = PRE_UPLOAD_SIZE.get(kind == null ? "" : kind);
        if (size == null) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("identity.tipo_de_arquivo_invalido"), Map.of("allowed", PRE_UPLOAD_SIZE.keySet()));
        }
        if (bytes.length > 8L * 1024 * 1024) {
            throw ApiException.badRequest("ARQUIVO_GRANDE", Msg.t("identity.a_imagem_deve_ter_ate"));
        }
        UUID bucketOwner = UUID.nameUUIDFromBytes(("pre-upload:" + (ip == null ? "?" : ip)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!rateLimit.tryAcquire(bucketOwner, "pre-registration-upload", 30, Duration.ofHours(1))) {
            throw new ApiException(429, "LIMITE_ENVIOS", Msg.t("identity.muitos_envios_em_pouco_tempo"));
        }
        ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = ImageOps.decode(bytes);
        if ("avatar".equals(kind)) {
            img = ImageOps.centerSquare(img);                  // avatar: recorte quadrado (círculo no header do perfil)
        }
        img = ImageOps.scaleToFit(img, size, size);
        byte[] jpeg = ImageOps.jpeg(img, 0.9f);
        boolean sensitive = "identity".equals(kind) || "activity-proof".equals(kind);
        String key = (sensitive ? "restricted/" : "") + "pending/" + UUID.randomUUID() + "/" + kind + ".jpg";
        MediaStoragePort.StoredObject stored = storage.put(key, jpeg, "image/jpeg");
        return Map.of("url", stored.url(), "kind", kind, "width", img.getWidth(), "height", img.getHeight());
    }

    /** Envios do cadastro abandonados (a conta nunca foi criada) somem depois disso. */
    static final Duration PENDING_TTL = Duration.ofHours(24);
    private static final Set<MediaService.MediaScope> PENDING_SCOPES =
            Set.of(MediaService.MediaScope.PENDING, MediaService.MediaScope.PENDING_RESTRICTED);

    /**
     * URL aceita no cadastro: só um envio deste formulário ({@code POST /api/auth/uploads}) do tipo certo para o campo —
     * nunca uma URL externa nem uma chave qualquer do storage (o cadastro copia o arquivo para a conta nova).
     */
    private Optional<MediaService.OwnedMedia> pendingUpload(String url, String kind) {
        return MediaService.ownedMedia(storage, null, url, PENDING_SCOPES)
                .filter(m -> kind.equals(MediaService.pendingKind(m.key())));
    }

    /**
     * Job de hora em hora: apaga envios do cadastro com mais de 24 h. Os usados num cadastro já foram copiados para a
     * conta; os que ainda aparecem em alguma conta são de cadastros anteriores a essa cópia e ficam.
     */
    @Scheduled(cron = "0 35 * * * *", zone = "America/Sao_Paulo")
    public int purgeStalePendingUploads() {
        Instant cutoff = Instant.now().minus(PENDING_TTL);
        int removed = 0;
        for (String prefix : List.of("pending/", "restricted/pending/")) {
            for (String key : storage.listOlderThan(prefix, cutoff, 2_000)) {
                if (pendingReferenced(key)) {
                    continue;
                }
                try {
                    storage.delete(key);
                    removed++;
                } catch (RuntimeException ex) {
                    log.warn("Envio de cadastro {} não apagado: {}", key, ex.getMessage());
                }
            }
        }
        if (removed > 0) {
            log.info("Envios de cadastro abandonados apagados: {}", removed);
        }
        return removed;
    }

    private boolean pendingReferenced(String key) {
        String suffix = key.startsWith("restricted/") ? key.substring("restricted/".length()) : key;
        return users.existsByAvatarUrlEndingWithOrCoverUrlEndingWith(suffix, suffix)
                || brands.existsByLogoUrlEndingWithOrActivityProofUrlEndingWith(suffix, suffix)
                || celebrities.existsByAvatarUrlEndingWithOrIdentityProofUrlEndingWith(suffix, suffix);
    }

    public record BrandData(String razaoSocial, String cnpj, String nomeFantasia, String logoUrl, String fashionCategory,
                            String storeUrl, String commercialContact, String officialHashtag, String activityProofUrl) {
    }

    public record CelebrityData(String stageName, String realName, String identityProofUrl, String officialPhotoUrl,
                                List<String> areas, Map<String, Object> verifiableFollowers, String verificationUrl,
                                String professionalHistory, String representationContact, List<String> fashionInterests,
                                boolean sealConsentGranted) {
    }

    /**
     * @param avatarUrl foto de perfil enviada antes do cadastro ({@code POST /api/auth/uploads}); constrói o manequim
     *                  da Passarela 3D. Sem foto, o manequim é o padrão masculino/feminino.
     * @param sex       sexo do manequim (Passarela 3D e provador)
     */
    public record RegisterCommand(ProfileType profileType, String fullName, String username, String email, String password,
                                  String confirmPassword, boolean acceptTerms, String birthDate, String country,
                                  BrandData brand, CelebrityData celebrity, String avatarUrl, MannequinSex sex) {
    }

    public record Session(String accessToken, long expiresInSeconds, String refreshToken, Instant refreshExpiresAt,
                          UUID sessionId, Views.UserCard user, String status, boolean emailVerified,
                          List<String> warnings) {
    }

    @Transactional
    public Session register(RegisterCommand cmd, String ip, String userAgent) {
        Map<String, Object> errors = new LinkedHashMap<>();
        ProfileType type = cmd.profileType() == null ? ProfileType.PESSOAL : cmd.profileType();
        if (type == ProfileType.ADMIN) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("identity.tipo_de_perfil_nao_permitido"));
        }
        if (cmd.fullName() == null || cmd.fullName().trim().length() < 3) {
            errors.put("fullName", Msg.t("identity.informe_seu_nome_completo"));
        }
        String mail = cmd.email() == null ? "" : cmd.email().trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(mail).matches()) {
            errors.put("email", Msg.t("common.formato_de_e_mail_invalido"));
        }
        validatePassword(cmd.password(), errors);
        if (cmd.password() != null && !cmd.password().equals(cmd.confirmPassword())) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
        if (!cmd.acceptTerms()) {
            errors.put("acceptTerms", Msg.t("identity.e_preciso_aceitar_os_termos"));
        }
        if (cmd.birthDate() != null && !cmd.birthDate().isBlank()) {
            try {
                LocalDate birth = LocalDate.parse(cmd.birthDate());
                if (Period.between(birth, LocalDate.now()).getYears() < 13) {
                    errors.put("birthDate", Msg.t("identity.o_fashion_ai_e_destinado"));
                }
            } catch (DateTimeParseException ex) {
                errors.put("birthDate", Msg.t("identity.data_invalida_use_aaaa_mm"));
            }
        }
        if (type == ProfileType.MARCA) {
            BrandData b = cmd.brand();
            if (b == null || blank(b.razaoSocial())) {
                errors.put("brand.razaoSocial", Msg.t("identity.razao_social_e_obrigatoria"));
            }
            if (b == null || !validCnpj(b.cnpj())) {
                errors.put("brand.cnpj", Msg.t("identity.cnpj_invalido"));
            }
            if (b == null || blank(b.logoUrl())) {
                errors.put("brand.logoUrl", Msg.t("identity.envie_o_logo_da_marca"));
            }
        }
        if (type == ProfileType.CELEBRIDADE) {
            CelebrityData c = cmd.celebrity();
            if (c == null || blank(c.stageName())) {
                errors.put("celebrity.stageName", Msg.t("identity.nome_artistico_e_obrigatorio"));
            }
            if (c == null || blank(c.realName())) {
                // critério obrigatório da verificação (NOME_CONFERE): sem ele o perfil nunca poderia ser aprovado
                errors.put("celebrity.realName", Msg.t("identity.nome_civil_e_obrigatorio"));
            }
            if (c == null || blank(c.identityProofUrl())) {
                errors.put("celebrity.identityProofUrl", Msg.t("identity.envie_o_documento_de_identificacao"));
            }
            if (c == null || blank(c.officialPhotoUrl())) {
                errors.put("celebrity.officialPhotoUrl", Msg.t("identity.envie_a_foto_oficial"));
            }
        }
        if (type != ProfileType.MARCA && cmd.sex() == null) {
            errors.put("sex", Msg.t("identity.escolha_o_manequim_feminino_ou"));
        }
        if (cmd.username() != null && !cmd.username().isBlank()) {
            String problem = usernameProblem(normalizeUsername(cmd.username()));
            if (problem != null) {
                errors.put("username", problem);
            }
        }
        // arquivos do cadastro: lidos já aqui (confere que o envio existe) e copiados para a conta depois de criada
        Map<String, byte[]> uploads = new LinkedHashMap<>();
        for (String[] f : new String[][]{{"avatarUrl", cmd.avatarUrl(), "avatar"},
                {"brand.logoUrl", cmd.brand() == null ? null : cmd.brand().logoUrl(), "logo"},
                {"brand.activityProofUrl", cmd.brand() == null ? null : cmd.brand().activityProofUrl(), "activity-proof"},
                {"celebrity.officialPhotoUrl", cmd.celebrity() == null ? null : cmd.celebrity().officialPhotoUrl(), "official-photo"},
                {"celebrity.identityProofUrl", cmd.celebrity() == null ? null : cmd.celebrity().identityProofUrl(), "identity"}}) {
            if (blank(f[1])) {
                continue;
            }
            Optional<MediaService.OwnedMedia> upload = pendingUpload(f[1], f[2]);
            byte[] bytes = upload.map(m -> readQuietly(m.key())).orElse(null);
            if (bytes == null) {
                errors.put(f[0], Msg.t("identity.envie_o_arquivo_pelo_formulario"));
            } else {
                uploads.put(upload.get().key(), bytes);
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        String emailHash = Hashing.emailHash(mail);
        if (users.existsByEmailHash(emailHash)) {
            // RF1.CA02 — recusa específica, sem vazar nenhum dado da conta existente.
            throw ApiException.conflict("EMAIL_EM_USO", Msg.t("identity.este_e_mail_ja_esta"));
        }
        String username = cmd.username() == null || cmd.username().isBlank() ? suggestUsername(cmd.fullName())
                : normalizeUsername(cmd.username());
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.badRequest("USERNAME_EM_USO", Msg.t("common.este_ja_esta_em_uso"),
                    Map.of("suggestions", usernameSuggestions(username)));
        }
        User u = new User();
        u.setUsername(username);
        u.setDisplayName(type == ProfileType.CELEBRIDADE && cmd.celebrity() != null ? cmd.celebrity().stageName().trim()
                : type == ProfileType.MARCA && cmd.brand() != null && !blank(cmd.brand().nomeFantasia())
                ? cmd.brand().nomeFantasia().trim() : cmd.fullName().trim());
        u.setEmail(mail);
        u.setEmailHash(emailHash);
        u.setPasswordHash(hasher.hash(cmd.password()));
        u.setProfileType(type);
        u.setBirthDate(blank(cmd.birthDate()) ? null : cmd.birthDate());
        u.setCountry(blank(cmd.country()) ? "BR" : cmd.country().trim().toUpperCase(Locale.ROOT));
        u.setPrivateAccount(true);
        u.setTermsAcceptedAt(Instant.now());
        u.setTermsVersion(TERMS_VERSION);
        u.setStatus(AccountStatus.PENDING_EMAIL_VERIFICATION);
        u.setSex(cmd.sex());
        users.save(u);
        Map<String, String> claimed = new LinkedHashMap<>();
        uploads.forEach((key, bytes) -> claimed.put(key, claimPendingUpload(u.getId(), key, bytes)));
        java.util.function.UnaryOperator<String> own = url -> blank(url) ? null
                : MediaService.ownedMedia(storage, null, url, PENDING_SCOPES).map(m -> claimed.get(m.key())).orElse(null);
        String avatar = own.apply(cmd.avatarUrl());
        if (type == ProfileType.MARCA && cmd.brand() != null) {
            u.setAvatarUrl(own.apply(cmd.brand().logoUrl()));
        }
        if (type == ProfileType.CELEBRIDADE && cmd.celebrity() != null) {
            u.setAvatarUrl(own.apply(cmd.celebrity().officialPhotoUrl()));
        }
        if (avatar != null) {
            u.setAvatarUrl(avatar);                // a foto de perfil escolhida vence o logo/foto oficial no avatar
        }
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(u);
        prefs.setLanguage(UiLanguage.valueOf(Msg.preferenceCode(Msg.locale())));   // o idioma da interface no cadastro vira a preferência (RF23)
        if (cmd.sex() != null) {
            prefs.setMannequinSex(cmd.sex());
        }
        preferences.save(prefs);
        if (type == ProfileType.MARCA) {
            BrandData b = cmd.brand();
            BrandProfile bp = new BrandProfile();
            bp.setOwner(u);
            bp.setBrandName(blank(b.nomeFantasia()) ? b.razaoSocial().trim() : b.nomeFantasia().trim());
            bp.setSlug(uniqueBrandSlug(bp.getBrandName()));
            bp.setLogoUrl(own.apply(b.logoUrl()));
            bp.setCnpj(b.cnpj().replaceAll("\\D", ""));
            bp.setRazaoSocial(b.razaoSocial().trim());
            bp.setNomeFantasia(b.nomeFantasia());
            bp.setFashionCategory(b.fashionCategory());
            bp.setStoreUrl(b.storeUrl());
            bp.setCommercialContact(b.commercialContact());
            bp.setOfficialHashtag(b.officialHashtag());
            bp.setActivityProofUrl(own.apply(b.activityProofUrl()));
            bp.setCountry(u.getCountry());
            bp.setApprovalStatus(ApprovalStatus.PENDENTE);
            brands.save(bp);
        }
        if (type == ProfileType.CELEBRIDADE) {
            CelebrityData c = cmd.celebrity();
            CelebrityProfile cp = new CelebrityProfile();
            cp.setOwner(u);
            cp.setStageName(c.stageName().trim());
            cp.setSlug(uniqueCelebritySlug(c.stageName()));
            cp.setAvatarUrl(own.apply(c.officialPhotoUrl()));
            cp.setRealName(c.realName());
            cp.setIdentityProofUrl(own.apply(c.identityProofUrl()));
            cp.setAreasJson(Json.write(c.areas()));
            cp.setVerifiableFollowersJson(Json.write(c.verifiableFollowers()));
            cp.setVerificationUrl(c.verificationUrl());
            cp.setProfessionalHistory(c.professionalHistory());
            cp.setRepresentationContact(c.representationContact());
            cp.setFashionInterestsJson(Json.write(c.fashionInterests()));
            cp.setSealConsentGranted(c.sealConsentGranted());
            cp.setVerificationStatus(ApprovalStatus.PENDENTE);
            celebrities.save(cp);
        }
        sendEmailVerification(u);
        if (type != ProfileType.PESSOAL) {
            email.send(mail, Msg.t("identity.cadastro_recebido_pendente_de_validacao"),
                    Msg.t("identity.p_recebemos_o_cadastro_de", escape(u.getDisplayName()), (type == ProfileType.MARCA ? "marca" : "celebridade")),
                    "SECURITY");
            if (issuerReview != null) {
                issuerReview.submitted(u.getId());          // aviso aos administradores (app + e-mail), após o commit
            }
        }
        notifications.notify(u.getId(), null, NotificationType.WELCOME, "USER", u.getId(), Msg.k("identity.boas_vindas_ao_fashion_ai"),
                Msg.k("identity.monte_seu_guarda_roupa_crie"), null);
        notifications.notify(u.getId(), null, NotificationType.EMAIL_CONFIRMATION, "USER", u.getId(),
                Msg.k("identity.confirme_seu_e_mail"), Msg.k("identity.enviamos_um_codigo_para_ate", maskEmail(mail)), null);
        audit.log(u.getId().toString(), AuditActions.CADASTRO_CONTA, "user:" + u.getId(), "SUCESSO", ip, userAgent,
                Map.of("profileType", type.name()));
        return openSession(u, true, ip, userAgent, null);
    }

    private byte[] readQuietly(String key) {
        try {
            return storage.get(key);
        } catch (RuntimeException ex) {
            return null;                                   // envio apagado (mais de 24 h) ou inexistente
        }
    }

    /**
     * Copia o envio do cadastro para a conta: foto, logo e foto oficial em {@code users/{id}/profile/}; documentos em
     * {@code restricted/users/{id}/documents/} (só ADMIN lê). O original em pending/ sai no job de limpeza.
     */
    private String claimPendingUpload(UUID userId, String pendingKey, byte[] bytes) {
        String kind = MediaService.pendingKind(pendingKey);
        String folder = pendingKey.startsWith("restricted/") ? "restricted/users/" + userId + "/documents/" : "users/" + userId + "/profile/";
        return storage.put(folder + kind + "-" + System.currentTimeMillis() + ".jpg", bytes, "image/jpeg").url();
    }

    public static void validatePassword(String password, Map<String, Object> errors) {
        if (password == null || password.length() < 8 || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")
                || !password.matches(".*[^A-Za-z0-9].*")) {
            errors.put("password", Msg.t("identity.a_senha_precisa_de_no"));
        }
    }

    public static boolean validCnpj(String raw) {
        if (raw == null) {
            return false;
        }
        String cnpj = raw.replaceAll("\\D", "");
        if (cnpj.length() != 14 || cnpj.chars().distinct().count() == 1) {
            return false;
        }
        int[] w1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int[] w2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            sum += (cnpj.charAt(i) - '0') * w1[i];
        }
        int d1 = sum % 11 < 2 ? 0 : 11 - sum % 11;
        sum = 0;
        for (int i = 0; i < 13; i++) {
            sum += (cnpj.charAt(i) - '0') * w2[i];
        }
        int d2 = sum % 11 < 2 ? 0 : 11 - sum % 11;
        return d1 == cnpj.charAt(12) - '0' && d2 == cnpj.charAt(13) - '0';
    }

    public String suggestUsername(String name) {
        String base = normalizeUsername(Hashing.slug(name).replace("-", "_"));
        if (base.length() < 3) {
            base = "fashion_" + base;
        }
        String candidate = base;
        int i = 1;
        while (reservedUsername(candidate) || users.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + (i++);
        }
        return candidate;
    }

    public List<String> usernameSuggestions(String taken) {
        List<String> out = new ArrayList<>();
        String base = normalizeUsername(taken);
        for (String suffix : new String[]{"_style", ".fai", "_" + LocalDate.now().getYear() % 100, "_oficial", "_looks"}) {
            String c = (base + suffix).substring(0, Math.min(30, (base + suffix).length()));
            if (!users.existsByUsernameIgnoreCase(c)) {
                out.add(c);
            }
            if (out.size() == 3) {
                break;
            }
        }
        return out;
    }

    public static String normalizeUsername(String raw) {
        String u = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
        u = u.replaceAll("[^a-z0-9._]", "");
        return u.length() > 30 ? u.substring(0, 30) : u;
    }

    /** @ reservado (administração, suporte, a própria marca): comparação exata depois da normalização. */
    public static boolean reservedUsername(String normalized) {
        return normalized != null && RESERVED_USERNAMES.contains(normalized.toLowerCase(Locale.ROOT));
    }

    /**
     * Motivo de recusa de um @ já normalizado, ou null se ele pode ser usado. A normalização descarta tudo que não é
     * letra, número, ponto ou "_": "!!!" viraria um @ vazio.
     */
    public static String usernameProblem(String normalized) {
        if (normalized == null || normalized.length() < 3) {
            return Msg.t("preferences.o_precisa_de_ao_menos");
        }
        if (reservedUsername(normalized)) {
            return Msg.t("identity.username_reservado");
        }
        return null;
    }

    private String uniqueBrandSlug(String name) {
        String base = Hashing.slug(name);
        String s = base;
        int i = 2;
        while (brands.findBySlug(s).isPresent()) {
            s = base + "-" + i++;
        }
        return s;
    }

    private String uniqueCelebritySlug(String name) {
        String base = Hashing.slug(name);
        String s = base;
        int i = 2;
        while (celebrities.findBySlug(s).isPresent()) {
            s = base + "-" + i++;
        }
        return s;
    }

    // ------------------------------------------------------------------ confirmação de e-mail
    private void sendEmailVerification(User u) {
        invalidateCodes(u.getId(), VerificationPurpose.EMAIL_VERIFICATION);   // só o código mais novo vale
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.EMAIL_VERIFICATION);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        Locale loc = mailLocale(u);
        email.send(u.getEmail(), Msg.t(loc, "identity.confirme_seu_e_mail_no"),
                Msg.t(loc, "identity.p_seu_codigo_de_confirmacao", code, frontendUrl, code),
                "SECURITY");
    }

    /**
     * Sem {@code noRollbackFor}, o {@code attempts++} de um código errado era desfeito junto com o erro e os palpites
     * ficavam ilimitados. Agora a tentativa é gravada e, na quinta errada, o código é invalidado (pede-se um novo).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Views.UserCard verifyEmail(CurrentUser current, String code) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (u.isEmailVerified()) {
            return Views.user(u);
        }
        VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                VerificationPurpose.EMAIL_VERIFICATION).orElseThrow(() -> ApiException.badRequest("CODIGO_INVALIDO",
                Msg.t("identity.codigo_invalido_peca_um_novo")));
        requireCodeAttemptQuota(u.getId(), VerificationPurpose.EMAIL_VERIFICATION);
        if (!vc.isUsable(Instant.now())) {
            throw ApiException.badRequest("CODIGO_EXPIRADO", Msg.t("identity.o_codigo_expirou_peca_um"));
        }
        if (!codeMatches(vc, u.getId(), code)) {
            throw wrongCode(vc);
        }
        vc.setConsumedAt(Instant.now());
        u.setEmailVerified(true);
        boolean needsApproval = u.getProfileType() != ProfileType.PESSOAL && !approved(u);
        u.setStatus(needsApproval ? AccountStatus.PENDING_VALIDATION : AccountStatus.ACTIVE);
        if (needsApproval && issuerReview != null) {
            issuerReview.emailConfirmed(u);          // o prazo da primeira análise começa aqui (política de verificação §5)
        }
        audit.log(current, AuditActions.EMAIL_CONFIRMADO, "user:" + u.getId(), Map.of());
        return Views.user(u);
    }

    // ------------------------------------------------------------------ códigos de 6 dígitos (tentativas)
    /** Invalida os códigos ainda abertos da finalidade (novo envio, senha trocada): só o mais novo pode valer. */
    public void invalidateCodes(UUID userId, VerificationPurpose purpose) {
        Instant now = Instant.now();
        codes.findByUserIdAndPurposeAndConsumedAtIsNull(userId, purpose).forEach(c -> c.setConsumedAt(now));
    }

    /** Comparação em tempo constante do código digitado com o hash guardado ({@code userId:código}). */
    public static boolean codeMatches(VerificationCode vc, UUID userId, String code) {
        String given = Hashing.sha256(userId + ":" + (code == null ? "" : code.trim()));
        return Hashing.constantTimeEquals(vc.getCodeHash(), given);
    }

    /**
     * Conta uma tentativa errada (persistida: os métodos que chamam não desfazem a transação no ApiException) e, na
     * {@value #MAX_CODE_ATTEMPTS}ª, invalida o código. Devolve o erro para a pessoa: quantas restam ou "peça um novo".
     */
    public static ApiException wrongCode(VerificationCode vc) {
        vc.setAttempts(vc.getAttempts() + 1);
        int remaining = MAX_CODE_ATTEMPTS - vc.getAttempts();
        if (remaining <= 0) {
            vc.setExpiresAt(Instant.now());
            return ApiException.badRequest("CODIGO_EXPIRADO", Msg.t("identity.muitas_tentativas_codigo"));
        }
        return ApiException.badRequest("CODIGO_INVALIDO", Msg.t("identity.codigo_incorreto_restam_tentativas", remaining));
    }

    /**
     * Palpites em paralelo leriam o mesmo {@code attempts} antes de gravar: o contador atômico do RateLimitPort limita
     * as tentativas por hora de cada finalidade, independentemente disso.
     */
    public void requireCodeAttemptQuota(UUID userId, VerificationPurpose purpose) {
        if (!rateLimit.tryAcquire(userId, "code-attempt:" + purpose.name(), CODE_ATTEMPTS_PER_HOUR, Duration.ofHours(1))) {
            throw new ApiException(429, "MUITAS_TENTATIVAS", Msg.t("identity.muitas_tentativas_codigo"));
        }
    }

    private boolean approved(User u) {
        if (u.getProfileType() == ProfileType.MARCA) {
            return brands.findByOwnerId(u.getId()).map(b -> b.getApprovalStatus() == ApprovalStatus.APROVADO).orElse(false);
        }
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrities.findByOwnerId(u.getId()).map(c -> c.getVerificationStatus() == ApprovalStatus.APROVADO).orElse(false);
        }
        return true;
    }

    @Transactional
    public void resendEmailVerification(CurrentUser current) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (u.isEmailVerified()) {
            return;
        }
        if (!rateLimit.tryAcquire(u.getId(), "email-verification", 5, Duration.ofDays(1))) {
            RateLimitPort.QuotaStatus st = rateLimit.status(u.getId(), "email-verification", 5, Duration.ofDays(1));
            throw ApiException.tooMany(Msg.t("identity.limite_de_reenvios_atingido"), Map.of("resetAt", st.resetAt().toString()));
        }
        sendEmailVerification(u);
    }

    // ------------------------------------------------------------------ RF2 login
    public record LoginCommand(String identifier, String password, boolean rememberMe, String deviceName, String twoFactorCode) {
    }

    /**
     * Conta bloqueada (5 falhas em 15 min) responde igual a credencial errada — o mesmo 401 NAO_AUTENTICADO de uma conta
     * que não existe, e sempre depois de conferir o hash (tempo uniforme). Um 423 só para contas existentes revelaria o
     * cadastro; um 423 só com a senha certa viraria um oráculo de senha durante o bloqueio. Códigos 2FA errados contam
     * no mesmo bloqueio; o login completo zera o contador.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Session login(LoginCommand cmd, String ip, String userAgent) {
        String id = cmd.identifier() == null ? "" : cmd.identifier().trim();
        String password = cmd.password() == null ? "" : cmd.password();
        User u = id.contains("@") ? findByEmail(id).orElse(null)
                : users.findByUsernameIgnoreCase(normalizeUsername(id)).orElse(null);
        if (u == null) {
            hasher.matches(password, dummyHash);
            audit.log("anonymous", AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "usuario_inexistente"));
            throw invalidCredentials();
        }
        RateLimitPort.QuotaStatus lock = rateLimit.status(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
        boolean passwordOk = hasher.matches(password, u.getPasswordHash());
        if (lock.exhausted()) {
            audit.log(u.getId().toString(), AuditActions.LOGIN_BLOQUEADO_TENTATIVAS, "auth", "BLOQUEADO", ip, userAgent,
                    Map.of("resetAt", lock.resetAt().toString()));
            throw invalidCredentials();
        }
        if (!passwordOk) {
            rateLimit.tryAcquire(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
            audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "senha"));
            throw invalidCredentials();
        }
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw new ApiException(403, "CONTA_INDISPONIVEL", Msg.t("identity.esta_conta_nao_esta_disponivel"));
        }
        if (hasher.needsRehash(u.getPasswordHash())) {
            u.setPasswordHash(hasher.hash(password));       // parâmetros do Argon2 atualizados: refaz com a senha certa
        }
        if (u.isTwoFactorEnabled()) {
            if (cmd.twoFactorCode() == null || cmd.twoFactorCode().isBlank()) {
                sendTwoFactor(u);
                throw new ApiException(401, "DOIS_FATORES_NECESSARIO", Msg.t("identity.enviamos_um_codigo_de_verificacao"),
                        Map.of("twoFactorRequired", true));
            }
            VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                    VerificationPurpose.TWO_FACTOR).orElseThrow(() -> ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido")));
            if (!vc.isUsable(Instant.now())) {
                throw ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido_ou"));
            }
            if (!codeMatches(vc, u.getId(), cmd.twoFactorCode())) {
                vc.setAttempts(vc.getAttempts() + 1);
                if (vc.getAttempts() >= MAX_CODE_ATTEMPTS) {
                    vc.setExpiresAt(Instant.now());           // quinto erro: o código morre, é preciso pedir outro
                }
                rateLimit.tryAcquire(u.getId(), LOGIN_FAIL, MAX_LOGIN_FAILURES, LOCK_WINDOW);
                audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "2fa"));
                throw ApiException.unauthorized(Msg.t("identity.codigo_de_verificacao_invalido_ou"));
            }
            vc.setConsumedAt(Instant.now());
        }
        rateLimit.reset(u.getId(), LOGIN_FAIL);
        boolean newDevice = refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(u.getId(), Instant.now()).stream()
                .noneMatch(t -> userAgent != null && userAgent.equals(t.getUserAgent()));
        u.setLastLoginAt(Instant.now());
        audit.log(u.getId().toString(), AuditActions.LOGIN_SUCESSO, "auth", "SUCESSO", ip, userAgent, Map.of("newDevice", newDevice));
        if (newDevice && u.getLastLoginAt() != null) {
            notifications.notify(u.getId(), null, NotificationType.NEW_LOGIN_DEVICE, "SESSION", null,
                    Msg.k("identity.novo_acesso_a_sua_conta"), Msg.k("identity.login_em_se_nao_foi", (userAgent == null ? "dispositivo desconhecido" : shortAgent(userAgent))), Map.of("ip", ip == null ? "" : ip));
        }
        return openSession(u, cmd.rememberMe(), ip, userAgent, cmd.deviceName());
    }

    private static ApiException invalidCredentials() {
        return ApiException.unauthorized(Msg.t("identity.credenciais_invalidas_ou_bloqueio"));
    }

    private void sendTwoFactor(User u) {
        invalidateCodes(u.getId(), VerificationPurpose.TWO_FACTOR);
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.TWO_FACTOR);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofMinutes(10)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        Locale loc = mailLocale(u);
        email.send(u.getEmail(), Msg.t(loc, "identity.seu_codigo_de_acesso_ao"), Msg.t(loc, "identity.p_codigo_b_b_valido", code), "SECURITY");
    }

    /** Idioma dos e-mails do usuário: a preferência salva (RF23) e, sem ela, o idioma da requisição. */
    private Locale mailLocale(User u) {
        return preferences.findByUserId(u.getId()).map(p -> p.getLanguage() == null ? Msg.locale() : Msg.fromPreference(p.getLanguage().name())).orElseGet(Msg::locale);
    }

    private Session openSession(User u, boolean persistent, String ip, String userAgent, String deviceName) {
        UUID family = UUID.randomUUID();
        return issue(u, family, null, persistent, ip, userAgent, deviceName);
    }

    private Session issue(User u, UUID family, UUID rotatedFrom, boolean persistent, String ip, String userAgent, String deviceName) {
        String raw = Hashing.randomToken(32);
        RefreshToken rt = new RefreshToken();
        rt.setUser(u);
        rt.setTokenHash(Hashing.sha256(raw));
        rt.setFamilyId(family);
        rt.setRotatedFromId(rotatedFrom);
        rt.setPersistent(persistent);
        rt.setExpiresAt(Instant.now().plus(persistent ? Duration.ofDays(30) : Duration.ofDays(1)));
        rt.setCreatedIp(ip);
        rt.setUserAgent(userAgent == null ? null : userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent);
        rt.setDeviceName(deviceName == null ? shortAgent(userAgent) : deviceName);
        rt.setLocationApprox(u.getCountry());
        rt.setLastUsedAt(Instant.now());
        refreshTokens.save(rt);
        List<String> warnings = new ArrayList<>();
        if (!u.isEmailVerified()) {
            warnings.add(Msg.t("identity.confirme_seu_e_mail_para"));
        }
        if (u.getStatus() == AccountStatus.PENDING_VALIDATION) {
            warnings.add(Msg.t("identity.seu_perfil_aguarda_a_validacao"));
        }
        if (u.getStatus() == AccountStatus.DELETION_SCHEDULED) {
            warnings.add(Msg.t("identity.sua_conta_sera_excluida_em", u.getDeletionScheduledFor()));
        }
        return new Session(tokens.issueAccessToken(u, family), tokens.accessTokenTtl().toSeconds(), raw, rt.getExpiresAt(),
                family, Views.user(u), u.getStatus().name(), u.isEmailVerified(), warnings);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String rawRefresh, String ip, String userAgent) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            throw ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente"));
        }
        RefreshToken rt = refreshTokens.findByTokenHash(Hashing.sha256(rawRefresh))
                .orElseThrow(() -> ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente")));
        if (rt.getRevokedAt() != null) {
            // reutilização de refresh token já rotacionado: revoga a família inteira (roubo de token).
            revokeFamily(rt.getFamilyId());
            audit.log(rt.getUser().getId().toString(), AuditActions.REFRESH_REUTILIZADO, "session:" + rt.getFamilyId(),
                    "BLOQUEADO", ip, userAgent, Map.of());
            throw ApiException.unauthorized(Msg.t("identity.sessao_encerrada_por_seguranca_faca"));
        }
        if (rt.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized(Msg.t("identity.sessao_expirada_faca_login_novamente"));
        }
        User u = rt.getUser();
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw ApiException.unauthorized(Msg.t("identity.conta_indisponivel"));
        }
        rt.setRevokedAt(Instant.now());
        return issue(u, rt.getFamilyId(), rt.getId(), rt.isPersistent(), ip, userAgent, rt.getDeviceName());
    }

    public boolean sessionActive(UUID familyId) {
        if (familyId == null) {
            return false;
        }
        Instant now = Instant.now();
        return refreshTokens.findByFamilyId(familyId).stream()
                .anyMatch(t -> t.getRevokedAt() == null && t.getExpiresAt().isAfter(now));
    }

    @Transactional
    public void logout(CurrentUser user, UUID sessionId) {
        revokeFamily(sessionId);
        audit.log(user, AuditActions.LOGOUT, "session:" + sessionId, Map.of());
    }

    private void revokeFamily(UUID family) {
        Instant now = Instant.now();
        refreshTokens.findByFamilyId(family).forEach(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(now);
            }
        });
    }

    /** RF3.CA10 — sessões ativas (uma por família de refresh token). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sessions(CurrentUser user, UUID currentSession) {
        Map<UUID, RefreshToken> latest = new LinkedHashMap<>();
        refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(user.id(), Instant.now()).forEach(t ->
                latest.merge(t.getFamilyId(), t, (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b));
        List<Map<String, Object>> out = new ArrayList<>();
        for (RefreshToken t : latest.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessionId", t.getFamilyId());
            m.put("device", t.getDeviceName());
            m.put("userAgent", t.getUserAgent());
            m.put("ip", t.getCreatedIp());
            m.put("location", t.getLocationApprox());
            m.put("lastUsedAt", t.getLastUsedAt());
            m.put("expiresAt", t.getExpiresAt());
            m.put("current", t.getFamilyId().equals(currentSession));
            out.add(m);
        }
        return out;
    }

    @Transactional
    public void revokeSession(CurrentUser user, UUID sessionId) {
        List<RefreshToken> family = refreshTokens.findByFamilyId(sessionId);
        if (family.isEmpty() || !family.get(0).getUser().getId().equals(user.id())) {
            throw ApiException.notFound(Msg.t("identity.sessao"));
        }
        revokeFamily(sessionId);
        audit.log(user, AuditActions.SESSAO_REVOGADA, "session:" + sessionId, Map.of());
    }

    @Transactional
    public int revokeOtherSessions(UUID userId, UUID keepSession) {
        int count = 0;
        Instant now = Instant.now();
        for (RefreshToken t : refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, now)) {
            if (!t.getFamilyId().equals(keepSession)) {
                t.setRevokedAt(now);
                count++;
            }
        }
        return count;
    }

    // ------------------------------------------------------------------ RF3.CA29–CA30 recuperação de senha
    /**
     * Resposta uniforme (RF3.CA29): nunca revela se o e-mail existe — nem pelo corpo nem pelo tempo. O e-mail, que é a
     * parte lenta (chamada HTTP ao provedor), sai depois do commit numa thread à parte.
     */
    @Transactional
    public void requestPasswordReset(String rawEmail, String ip, String userAgent) {
        String mail = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        findByEmail(mail).ifPresent(u -> {
            if (!rateLimit.tryAcquire(u.getId(), "password-reset", 5, Duration.ofHours(1))) {
                // a tela responde igual (não revela se o e-mail existe), mas o log mostra por que nada foi enviado
                log.info("Redefinição de senha não enviada: limite de 5 pedidos por hora atingido (user {})", u.getId());
                return;
            }
            String token = Hashing.randomToken(32);
            VerificationCode vc = new VerificationCode();
            vc.setUser(u);
            vc.setPurpose(VerificationPurpose.PASSWORD_RESET);
            vc.setCodeHash(Hashing.sha256(token));
            vc.setTarget(u.getEmailHash());
            vc.setExpiresAt(Instant.now().plus(Duration.ofMinutes(30)));
            vc.setLastSentAt(Instant.now());
            codes.save(vc);
            Locale loc = mailLocale(u);
            sendAfterCommit(u.getEmail(), Msg.t(loc, "identity.redefinicao_de_senha_fashion_ai"),
                    Msg.t(loc, "identity.p_recebemos_um_pedido_para", frontendUrl, token), "SECURITY");
            notifications.notify(u.getId(), null, NotificationType.PASSWORD_RESET, "USER", u.getId(),
                    Msg.k("identity.pedido_de_redefinicao_de_senha"), Msg.k("identity.se_nao_foi_voce_ignore"), null);
            audit.log(u.getId().toString(), AuditActions.RECUPERACAO_SENHA, "auth", "SOLICITADA", ip, userAgent, Map.of());
        });
        // resposta uniforme: nunca revela se o e-mail existe (RF3.CA29).
    }

    /** Envia o e-mail só depois do commit (o link precisa do token gravado) e fora da thread da requisição. */
    private void sendAfterCommit(String to, String subject, String html, String category) {
        Runnable send = () -> {
            try {
                email.send(to, subject, html, category);
            } catch (RuntimeException ex) {
                log.warn("Falha ao enviar e-mail de {}: {}", category, ex.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    mailExecutor.execute(send);
                }
            });
        } else {
            mailExecutor.execute(send);
        }
    }

    /** Testes: executa o envio assíncrono na própria thread. */
    void mailExecutor(Executor executor) {
        this.mailExecutor = executor;
    }

    @Transactional
    public void confirmPasswordReset(String token, String newPassword, String confirm) {
        VerificationCode vc = codes.findByCodeHashAndPurpose(Hashing.sha256(token == null ? "" : token),
                VerificationPurpose.PASSWORD_RESET).orElseThrow(() -> ApiException.badRequest("LINK_INVALIDO",
                Msg.t("identity.link_invalido_ou_expirado_peca")));
        if (vc.getConsumedAt() != null || vc.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("LINK_INVALIDO", Msg.t("identity.link_invalido_ou_expirado_peca"));
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        User u = vc.getUser();
        u.setPasswordHash(hasher.hash(newPassword));
        vc.setConsumedAt(Instant.now());
        invalidateCodes(u.getId(), VerificationPurpose.PASSWORD_RESET);   // os outros links pedidos antes morrem junto
        rateLimit.reset(u.getId(), LOGIN_FAIL);                           // quem provou o e-mail sai do bloqueio
        revokeOtherSessions(u.getId(), null);
        audit.log(u.getId().toString(), AuditActions.TROCA_SENHA, "user:" + u.getId(), "SUCESSO", null, null,
                Map.of("via", "reset"));
    }

    /** RF3.CA11/CA33 — troca de senha com a senha atual; encerra todas as demais sessões. */
    @Transactional
    public int changePassword(CurrentUser user, UUID currentSession, String currentPassword, String newPassword, String confirm) {
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (!hasher.matches(currentPassword == null ? "" : currentPassword, u.getPasswordHash())) {
            throw ApiException.badRequest("SENHA_ATUAL_INCORRETA", Msg.t("identity.senha_atual_incorreta"));
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        u.setPasswordHash(hasher.hash(newPassword));
        invalidateCodes(u.getId(), VerificationPurpose.PASSWORD_RESET);
        int ended = revokeOtherSessions(u.getId(), currentSession);
        audit.log(user, AuditActions.TROCA_SENHA, "user:" + u.getId(), Map.of("sessoesEncerradas", ended));
        return ended;
    }

    /** Reautenticação exigida para dados sensíveis (RF3.CA01). */
    public void reauthenticate(UUID userId, String password) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (!hasher.matches(password == null ? "" : password, u.getPasswordHash())) {
            throw new ApiException(401, "REAUTENTICACAO_FALHOU", Msg.t("identity.confirme_sua_senha_para_alterar"));
        }
    }

    /** Conta pelo e-mail (hash de busca). */
    public Optional<User> findByEmail(String rawEmail) {
        return users.findByEmailHash(Hashing.emailHash(rawEmail == null ? "" : rawEmail));
    }

    public static String maskEmail(String mail) {
        int at = mail.indexOf('@');
        if (at <= 1) {
            return "***" + mail.substring(Math.max(0, at));
        }
        return mail.charAt(0) + "***" + mail.substring(at);
    }

    private static String shortAgent(String ua) {
        if (ua == null) {
            return "Dispositivo";
        }
        String browser = ua.contains("Edg") ? "Edge" : ua.contains("Chrome") ? "Chrome" : ua.contains("Firefox") ? "Firefox"
                : ua.contains("Safari") ? "Safari" : "Navegador";
        String os = ua.contains("Android") ? "Android" : ua.contains("iPhone") || ua.contains("iPad") ? "iOS"
                : ua.contains("Windows") ? "Windows" : ua.contains("Mac") ? "macOS" : ua.contains("Linux") ? "Linux" : "";
        return (browser + " " + os).trim();
    }

    static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
