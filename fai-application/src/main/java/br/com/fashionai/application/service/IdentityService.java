package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
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
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import java.util.UUID;
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
    private static final int MAX_LOGIN_FAILURES = 5;
    private static final Duration LOCK_WINDOW = Duration.ofMinutes(15);

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

    public IdentityService(UserRepository users, UserPreferencesRepository preferences, BrandProfileRepository brands,
                           CelebrityProfileRepository celebrities, RefreshTokenRepository refreshTokens,
                           VerificationCodeRepository codes, PasswordHasherPort hasher, TokenIssuerPort tokens,
                           RateLimitPort rateLimit, EmailSenderPort email, NotificationService notifications, Audit audit,
                           @Value("${fashionai.frontend-url:http://localhost:3000}") String frontendUrl) {
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
    public record BrandData(String razaoSocial, String cnpj, String nomeFantasia, String logoUrl, String fashionCategory,
                            String storeUrl, String commercialContact, String officialHashtag, String activityProofUrl) {
    }

    public record CelebrityData(String stageName, String realName, String identityProofUrl, String officialPhotoUrl,
                                List<String> areas, Map<String, Object> verifiableFollowers, String verificationUrl,
                                String professionalHistory, String representationContact, List<String> fashionInterests,
                                boolean sealConsentGranted) {
    }

    public record RegisterCommand(ProfileType profileType, String fullName, String username, String email, String password,
                                  String confirmPassword, boolean acceptTerms, String birthDate, String country,
                                  BrandData brand, CelebrityData celebrity) {
    }

    public record Session(String accessToken, long expiresInSeconds, String refreshToken, Instant refreshExpiresAt,
                          UUID sessionId, Views.UserCard user, String status, boolean emailVerified,
                          List<String> warnings) {
    }

    @Transactional
    public Session register(RegisterCommand cmd, String ip, String userAgent) {
        Map<String, Object> errors = new LinkedHashMap<>();
        ProfileType type = cmd.profileType() == null ? ProfileType.PESSOAL : cmd.profileType();
        if (cmd.fullName() == null || cmd.fullName().trim().length() < 3) {
            errors.put("fullName", "Informe seu nome completo.");
        }
        String mail = cmd.email() == null ? "" : cmd.email().trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(mail).matches()) {
            errors.put("email", "Formato de e-mail inválido.");
        }
        validatePassword(cmd.password(), errors);
        if (cmd.password() != null && !cmd.password().equals(cmd.confirmPassword())) {
            errors.put("confirmPassword", "As senhas não coincidem.");
        }
        if (!cmd.acceptTerms()) {
            errors.put("acceptTerms", "É preciso aceitar os termos de uso e a política de privacidade.");
        }
        if (cmd.birthDate() != null && !cmd.birthDate().isBlank()) {
            try {
                LocalDate birth = LocalDate.parse(cmd.birthDate());
                if (Period.between(birth, LocalDate.now()).getYears() < 13) {
                    errors.put("birthDate", "O Fashion AI é destinado a maiores de 13 anos.");
                }
            } catch (DateTimeParseException ex) {
                errors.put("birthDate", "Data inválida (use AAAA-MM-DD).");
            }
        }
        if (type == ProfileType.MARCA) {
            BrandData b = cmd.brand();
            if (b == null || blank(b.razaoSocial())) {
                errors.put("brand.razaoSocial", "Razão social é obrigatória.");
            }
            if (b == null || !validCnpj(b.cnpj())) {
                errors.put("brand.cnpj", "CNPJ inválido.");
            }
            if (b == null || blank(b.logoUrl())) {
                errors.put("brand.logoUrl", "Envie o logo da marca.");
            }
        }
        if (type == ProfileType.CELEBRIDADE) {
            CelebrityData c = cmd.celebrity();
            if (c == null || blank(c.stageName())) {
                errors.put("celebrity.stageName", "Nome artístico é obrigatório.");
            }
            if (c == null || blank(c.identityProofUrl())) {
                errors.put("celebrity.identityProofUrl", "Envie o documento de identificação.");
            }
            if (c == null || blank(c.officialPhotoUrl())) {
                errors.put("celebrity.officialPhotoUrl", "Envie a foto oficial.");
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Corrija os campos destacados.", errors);
        }
        String emailHash = Hashing.emailHash(mail);
        if (users.existsByEmailHash(emailHash)) {
            // RF1.CA02 — recusa específica, sem vazar nenhum dado da conta existente.
            throw ApiException.conflict("EMAIL_EM_USO", "Este e-mail já está cadastrado. Faça login ou recupere a senha.");
        }
        String username = cmd.username() == null || cmd.username().isBlank() ? suggestUsername(cmd.fullName())
                : normalizeUsername(cmd.username());
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.badRequest("USERNAME_EM_USO", "Este @ já está em uso.",
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
        if (type == ProfileType.MARCA && cmd.brand() != null) {
            u.setAvatarUrl(cmd.brand().logoUrl());
        }
        if (type == ProfileType.CELEBRIDADE && cmd.celebrity() != null) {
            u.setAvatarUrl(cmd.celebrity().officialPhotoUrl());
        }
        users.save(u);
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(u);
        preferences.save(prefs);
        if (type == ProfileType.MARCA) {
            BrandData b = cmd.brand();
            BrandProfile bp = new BrandProfile();
            bp.setOwner(u);
            bp.setBrandName(blank(b.nomeFantasia()) ? b.razaoSocial().trim() : b.nomeFantasia().trim());
            bp.setSlug(uniqueBrandSlug(bp.getBrandName()));
            bp.setLogoUrl(b.logoUrl());
            bp.setCnpj(b.cnpj().replaceAll("\\D", ""));
            bp.setRazaoSocial(b.razaoSocial().trim());
            bp.setNomeFantasia(b.nomeFantasia());
            bp.setFashionCategory(b.fashionCategory());
            bp.setStoreUrl(b.storeUrl());
            bp.setCommercialContact(b.commercialContact());
            bp.setOfficialHashtag(b.officialHashtag());
            bp.setActivityProofUrl(b.activityProofUrl());
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
            cp.setAvatarUrl(c.officialPhotoUrl());
            cp.setRealName(c.realName());
            cp.setIdentityProofUrl(c.identityProofUrl());
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
            email.send(mail, "Cadastro recebido — pendente de validação",
                    "<p>Recebemos o cadastro de <b>" + escape(u.getDisplayName()) + "</b> como "
                            + (type == ProfileType.MARCA ? "marca" : "celebridade")
                            + ".</p><p>Status: <b>pendente_validação</b>. Um administrador do Fashion AI vai revisar os dados e você receberá a resposta por e-mail.</p>",
                    "SECURITY");
        }
        notifications.notify(u.getId(), null, NotificationType.WELCOME, "USER", u.getId(), "Boas-vindas ao Fashion AI!",
                "Monte seu guarda-roupa, crie looks e descubra seu DNA de Estilo.", null);
        notifications.notify(u.getId(), null, NotificationType.EMAIL_CONFIRMATION, "USER", u.getId(),
                "Confirme seu e-mail", "Enviamos um código para " + maskEmail(mail) + ". Até confirmar, você só pode navegar.", null);
        audit.log(u.getId().toString(), AuditActions.CADASTRO_CONTA, "user:" + u.getId(), "SUCESSO", ip, userAgent,
                Map.of("profileType", type.name()));
        return openSession(u, true, ip, userAgent, null);
    }

    public static void validatePassword(String password, Map<String, Object> errors) {
        if (password == null || password.length() < 8 || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")
                || !password.matches(".*[^A-Za-z0-9].*")) {
            errors.put("password", "A senha precisa de no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.");
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
        while (users.existsByUsernameIgnoreCase(candidate)) {
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
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.EMAIL_VERIFICATION);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        email.send(u.getEmail(), "Confirme seu e-mail no Fashion AI",
                "<p>Seu código de confirmação é <b style='font-size:22px;letter-spacing:4px'>" + code + "</b>.</p>"
                        + "<p>Ou abra: <a href='" + frontendUrl + "/verify-email?code=" + code + "'>confirmar e-mail</a>. Vale por 24 horas.</p>",
                "SECURITY");
    }

    @Transactional
    public Views.UserCard verifyEmail(CurrentUser current, String code) {
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        if (u.isEmailVerified()) {
            return Views.user(u);
        }
        VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                VerificationPurpose.EMAIL_VERIFICATION).orElseThrow(() -> ApiException.badRequest("CODIGO_INVALIDO",
                "Código inválido. Peça um novo código."));
        if (vc.getExpiresAt().isBefore(Instant.now()) || vc.getAttempts() >= 5) {
            throw ApiException.badRequest("CODIGO_EXPIRADO", "O código expirou. Peça um novo.");
        }
        if (!vc.getCodeHash().equals(Hashing.sha256(u.getId() + ":" + (code == null ? "" : code.trim())))) {
            vc.setAttempts(vc.getAttempts() + 1);
            throw ApiException.badRequest("CODIGO_INVALIDO", "Código incorreto. Restam " + (5 - vc.getAttempts()) + " tentativas.");
        }
        vc.setConsumedAt(Instant.now());
        u.setEmailVerified(true);
        boolean needsApproval = u.getProfileType() != ProfileType.PESSOAL && !approved(u);
        u.setStatus(needsApproval ? AccountStatus.PENDING_VALIDATION : AccountStatus.ACTIVE);
        audit.log(current, AuditActions.EMAIL_CONFIRMADO, "user:" + u.getId(), Map.of());
        return Views.user(u);
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
        User u = users.findById(current.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        if (u.isEmailVerified()) {
            return;
        }
        if (!rateLimit.tryAcquire(u.getId(), "email-verification", 5, Duration.ofDays(1))) {
            RateLimitPort.QuotaStatus st = rateLimit.status(u.getId(), "email-verification", 5, Duration.ofDays(1));
            throw ApiException.tooMany("Limite de reenvios atingido.", Map.of("resetAt", st.resetAt().toString()));
        }
        sendEmailVerification(u);
    }

    // ------------------------------------------------------------------ RF2 login
    public record LoginCommand(String identifier, String password, boolean rememberMe, String deviceName, String twoFactorCode) {
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session login(LoginCommand cmd, String ip, String userAgent) {
        String id = cmd.identifier() == null ? "" : cmd.identifier().trim();
        User u = id.contains("@") ? users.findByEmailHash(Hashing.emailHash(id)).orElse(null)
                : users.findByUsernameIgnoreCase(normalizeUsername(id)).orElse(null);
        if (u == null) {
            hasher.matches(cmd.password() == null ? "" : cmd.password(), dummyHash);
            audit.log("anonymous", AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "usuario_inexistente"));
            throw ApiException.unauthorized("E-mail/usuário ou senha incorretos.");
        }
        RateLimitPort.QuotaStatus lock = rateLimit.status(u.getId(), "login-fail", MAX_LOGIN_FAILURES, LOCK_WINDOW);
        if (lock.exhausted()) {
            audit.log(u.getId().toString(), AuditActions.LOGIN_BLOQUEADO_TENTATIVAS, "auth", "BLOQUEADO", ip, userAgent, Map.of());
            throw new ApiException(423, "CONTA_BLOQUEADA_TEMPORARIAMENTE",
                    "Muitas tentativas. Tente de novo depois de " + lock.resetAt() + " ou recupere a senha.",
                    Map.of("resetAt", lock.resetAt().toString()));
        }
        if (!hasher.matches(cmd.password() == null ? "" : cmd.password(), u.getPasswordHash())) {
            rateLimit.tryAcquire(u.getId(), "login-fail", MAX_LOGIN_FAILURES, LOCK_WINDOW);
            audit.log(u.getId().toString(), AuditActions.LOGIN_FALHO, "auth", "FALHA", ip, userAgent, Map.of("reason", "senha"));
            throw ApiException.unauthorized("E-mail/usuário ou senha incorretos.");
        }
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw new ApiException(403, "CONTA_INDISPONIVEL", "Esta conta não está disponível.");
        }
        if (u.isTwoFactorEnabled()) {
            if (cmd.twoFactorCode() == null || cmd.twoFactorCode().isBlank()) {
                sendTwoFactor(u);
                throw new ApiException(401, "DOIS_FATORES_NECESSARIO", "Enviamos um código de verificação para o seu e-mail.",
                        Map.of("twoFactorRequired", true));
            }
            VerificationCode vc = codes.findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId(),
                    VerificationPurpose.TWO_FACTOR).orElseThrow(() -> ApiException.unauthorized("Código de verificação inválido."));
            if (vc.getExpiresAt().isBefore(Instant.now())
                    || !vc.getCodeHash().equals(Hashing.sha256(u.getId() + ":" + cmd.twoFactorCode().trim()))) {
                throw ApiException.unauthorized("Código de verificação inválido ou expirado.");
            }
            vc.setConsumedAt(Instant.now());
        }
        boolean newDevice = refreshTokens.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(u.getId(), Instant.now()).stream()
                .noneMatch(t -> userAgent != null && userAgent.equals(t.getUserAgent()));
        u.setLastLoginAt(Instant.now());
        audit.log(u.getId().toString(), AuditActions.LOGIN_SUCESSO, "auth", "SUCESSO", ip, userAgent, Map.of("newDevice", newDevice));
        if (newDevice && u.getLastLoginAt() != null) {
            notifications.notify(u.getId(), null, NotificationType.NEW_LOGIN_DEVICE, "SESSION", null,
                    "Novo acesso à sua conta", "Login em " + (userAgent == null ? "dispositivo desconhecido" : shortAgent(userAgent))
                            + ". Se não foi você, encerre a sessão em Configurações › Conta.", Map.of("ip", ip == null ? "" : ip));
        }
        return openSession(u, cmd.rememberMe(), ip, userAgent, cmd.deviceName());
    }

    private void sendTwoFactor(User u) {
        String code = Hashing.numericCode(6);
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(VerificationPurpose.TWO_FACTOR);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + code));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofMinutes(10)));
        vc.setLastSentAt(Instant.now());
        codes.save(vc);
        email.send(u.getEmail(), "Seu código de acesso ao Fashion AI", "<p>Código: <b>" + code + "</b> (válido por 10 minutos).</p>", "SECURITY");
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
            warnings.add("Confirme seu e-mail para criar e editar conteúdo (acesso limitado).");
        }
        if (u.getStatus() == AccountStatus.PENDING_VALIDATION) {
            warnings.add("Seu perfil aguarda a validação de um administrador do Fashion AI.");
        }
        if (u.getStatus() == AccountStatus.DELETION_SCHEDULED) {
            warnings.add("Sua conta será excluída em " + u.getDeletionScheduledFor() + ". Cancele em Configurações › Seus dados.");
        }
        return new Session(tokens.issueAccessToken(u, family), tokens.accessTokenTtl().toSeconds(), raw, rt.getExpiresAt(),
                family, Views.user(u), u.getStatus().name(), u.isEmailVerified(), warnings);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String rawRefresh, String ip, String userAgent) {
        if (rawRefresh == null || rawRefresh.isBlank()) {
            throw ApiException.unauthorized("Sessão expirada. Faça login novamente.");
        }
        RefreshToken rt = refreshTokens.findByTokenHash(Hashing.sha256(rawRefresh))
                .orElseThrow(() -> ApiException.unauthorized("Sessão expirada. Faça login novamente."));
        if (rt.getRevokedAt() != null) {
            // reutilização de refresh token já rotacionado: revoga a família inteira (roubo de token).
            revokeFamily(rt.getFamilyId());
            audit.log(rt.getUser().getId().toString(), AuditActions.REFRESH_REUTILIZADO, "session:" + rt.getFamilyId(),
                    "BLOQUEADO", ip, userAgent, Map.of());
            throw ApiException.unauthorized("Sessão encerrada por segurança. Faça login novamente.");
        }
        if (rt.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Sessão expirada. Faça login novamente.");
        }
        User u = rt.getUser();
        if (u.getStatus() == AccountStatus.DELETED || u.getStatus() == AccountStatus.SUSPENDED) {
            throw ApiException.unauthorized("Conta indisponível.");
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
            throw ApiException.notFound("Sessão");
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
    @Transactional
    public void requestPasswordReset(String rawEmail, String ip, String userAgent) {
        String mail = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        users.findByEmailHash(Hashing.emailHash(mail)).ifPresent(u -> {
            if (!rateLimit.tryAcquire(u.getId(), "password-reset", 5, Duration.ofHours(1))) {
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
            email.send(u.getEmail(), "Redefinição de senha — Fashion AI",
                    "<p>Recebemos um pedido para redefinir sua senha.</p><p><a href='" + frontendUrl
                            + "/reset-password?token=" + token + "'>Redefinir senha</a> (válido por 30 minutos).</p>"
                            + "<p>Se não foi você, ignore este e-mail.</p>", "SECURITY");
            notifications.notify(u.getId(), null, NotificationType.PASSWORD_RESET, "USER", u.getId(),
                    "Pedido de redefinição de senha", "Se não foi você, ignore o e-mail e troque sua senha.", null);
            audit.log(u.getId().toString(), AuditActions.RECUPERACAO_SENHA, "auth", "SOLICITADA", ip, userAgent, Map.of());
        });
        // resposta uniforme: nunca revela se o e-mail existe (RF3.CA29).
    }

    @Transactional
    public void confirmPasswordReset(String token, String newPassword, String confirm) {
        VerificationCode vc = codes.findByCodeHashAndPurpose(Hashing.sha256(token == null ? "" : token),
                VerificationPurpose.PASSWORD_RESET).orElseThrow(() -> ApiException.badRequest("LINK_INVALIDO",
                "Link inválido ou expirado. Peça uma nova redefinição."));
        if (vc.getConsumedAt() != null || vc.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("LINK_INVALIDO", "Link inválido ou expirado. Peça uma nova redefinição.");
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", "As senhas não coincidem.");
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Corrija os campos destacados.", errors);
        }
        User u = vc.getUser();
        u.setPasswordHash(hasher.hash(newPassword));
        vc.setConsumedAt(Instant.now());
        revokeOtherSessions(u.getId(), null);
        audit.log(u.getId().toString(), AuditActions.TROCA_SENHA, "user:" + u.getId(), "SUCESSO", null, null,
                Map.of("via", "reset"));
    }

    /** RF3.CA11/CA33 — troca de senha com a senha atual; encerra todas as demais sessões. */
    @Transactional
    public int changePassword(CurrentUser user, UUID currentSession, String currentPassword, String newPassword, String confirm) {
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        if (!hasher.matches(currentPassword == null ? "" : currentPassword, u.getPasswordHash())) {
            throw ApiException.badRequest("SENHA_ATUAL_INCORRETA", "Senha atual incorreta.");
        }
        Map<String, Object> errors = new LinkedHashMap<>();
        validatePassword(newPassword, errors);
        if (newPassword != null && !newPassword.equals(confirm)) {
            errors.put("confirmPassword", "As senhas não coincidem.");
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", "Corrija os campos destacados.", errors);
        }
        u.setPasswordHash(hasher.hash(newPassword));
        int ended = revokeOtherSessions(u.getId(), currentSession);
        audit.log(user, AuditActions.TROCA_SENHA, "user:" + u.getId(), Map.of("sessoesEncerradas", ended));
        return ended;
    }

    /** Reautenticação exigida para dados sensíveis (RF3.CA01). */
    public void reauthenticate(UUID userId, String password) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Usuário"));
        if (!hasher.matches(password == null ? "" : password, u.getPasswordHash())) {
            throw new ApiException(401, "REAUTENTICACAO_FALHOU", "Confirme sua senha para alterar dados sensíveis.");
        }
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
