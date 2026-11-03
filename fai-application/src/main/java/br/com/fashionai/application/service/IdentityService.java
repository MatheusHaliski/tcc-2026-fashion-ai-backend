package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.regex.Pattern;

/**
 * RF1 (cadastro Pessoal, Marca, Celebridade), RF2 (login) e RNF2 (JWT + refresh rotativo e recuperação
 * de sessão), com RF3.CA07–CA10 / CA29–CA33 (recuperação de senha, logout invalidando no servidor, sessões
 * ativas, troca de senha encerrando as demais sessões). Senhas só como hash Argon2 (RNF3/RF1.CA04).
 * <p>
 * Fachada (Facade) sobre os casos de uso em colaboradores package-private ({@link IdentityUseCases}), onde fica a
 * documentação detalhada de cada regra; cada método delega numa instrução. Transações e agendamento ficam aqui.
 */
@Service
public class IdentityService {
    public static final Pattern EMAIL = Pattern.compile("^[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$");
    public static final String TERMS_VERSION = "2026-10";
    static final String LOGIN_FAIL = "login-fail";
    /** Tentativas erradas por código de 6 dígitos (e-mail, troca de e-mail, 2FA): depois disso ele é invalidado. */
    public static final int MAX_CODE_ATTEMPTS = 5;
    /** Tentativas por hora e finalidade, contadas no RateLimitPort (atômico): segura palpites em paralelo. */
    static final int CODE_ATTEMPTS_PER_HOUR = 10;
    /** @ que ninguém escolhe no cadastro nem na troca (a conta de administração vem do AdminBootstrap). */
    public static final Set<String> RESERVED_USERNAMES = IdentityFieldRules.RESERVED_USERNAMES;

    private final IdentityUseCases cases;
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
        this.cases = IdentityUseCases.wire(users, preferences, brands, celebrities, refreshTokens, codes, hasher, tokens, rateLimit,
                email, notifications, audit, storage, frontendUrl, () -> issuerReview);
    }

    // ------------------------------------------------------------------ RF1
    public Map<String, Object> preRegistrationUpload(byte[] bytes, String kind, String ip) {
        return cases.preUploads().preRegistrationUpload(bytes, kind, ip);
    }

    @Scheduled(cron = "0 35 * * * *", zone = "America/Sao_Paulo")
    public int purgeStalePendingUploads() {
        return cases.preUploads().purgeStalePendingUploads();
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
        return cases.registration().register(cmd, ip, userAgent);
    }

    public static void validatePassword(String password, Map<String, Object> errors) {
        IdentityFieldRules.validatePassword(password, errors);
    }

    public static boolean validCnpj(String raw) {
        return IdentityFieldRules.validCnpj(raw);
    }

    public String suggestUsername(String name) {
        return cases.usernames().suggestUsername(name);
    }

    public List<String> usernameSuggestions(String taken) {
        return cases.usernames().usernameSuggestions(taken);
    }

    public static String normalizeUsername(String raw) {
        return IdentityFieldRules.normalizeUsername(raw);
    }

    /** @ reservado (administração, suporte, a própria marca): comparação exata depois da normalização. */
    public static boolean reservedUsername(String normalized) {
        return IdentityFieldRules.reservedUsername(normalized);
    }

    public static String usernameProblem(String normalized) {
        return IdentityFieldRules.usernameProblem(normalized);
    }

    // ------------------------------------------------------------------ confirmação de e-mail e códigos de 6 dígitos
    @Transactional(noRollbackFor = ApiException.class)
    public Views.UserCard verifyEmail(CurrentUser current, String code) {
        return cases.verification().verifyEmail(current, code);
    }

    public void invalidateCodes(UUID userId, VerificationPurpose purpose) {
        cases.codeBook().invalidateCodes(userId, purpose);
    }

    public static boolean codeMatches(VerificationCode vc, UUID userId, String code) {
        return IdentityCodes.codeMatches(vc, userId, code);
    }

    public static ApiException wrongCode(VerificationCode vc) {
        return IdentityCodes.wrongCode(vc);
    }

    public void requireCodeAttemptQuota(UUID userId, VerificationPurpose purpose) {
        cases.codeBook().requireCodeAttemptQuota(userId, purpose);
    }

    @Transactional
    public void resendEmailVerification(CurrentUser current) {
        cases.verification().resendEmailVerification(current);
    }

    // ------------------------------------------------------------------ RF2 login e sessões
    public record LoginCommand(String identifier, String password, boolean rememberMe, String deviceName, String twoFactorCode) {
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session login(LoginCommand cmd, String ip, String userAgent) {
        return cases.logins().login(cmd, ip, userAgent);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String rawRefresh, String ip, String userAgent) {
        return cases.sessions().refresh(rawRefresh, ip, userAgent);
    }

    public boolean sessionActive(UUID familyId) {
        return cases.sessions().sessionActive(familyId);
    }

    @Transactional
    public void logout(CurrentUser user, UUID sessionId) {
        cases.sessions().logout(user, sessionId);
    }

    /** RF3.CA10 — sessões ativas (uma por família de refresh token). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sessions(CurrentUser user, UUID currentSession) {
        return cases.sessions().sessions(user, currentSession);
    }

    @Transactional
    public void revokeSession(CurrentUser user, UUID sessionId) {
        cases.sessions().revokeSession(user, sessionId);
    }

    @Transactional
    public int revokeOtherSessions(UUID userId, UUID keepSession) {
        return cases.sessions().revokeOtherSessions(userId, keepSession);
    }

    // ------------------------------------------------------------------ RF3.CA29–CA30 recuperação e troca de senha
    @Transactional
    public void requestPasswordReset(String rawEmail, String ip, String userAgent) {
        cases.passwords().requestPasswordReset(rawEmail, ip, userAgent);
    }

    /** Testes: executa o envio assíncrono na própria thread. */
    void mailExecutor(Executor executor) {
        cases.passwords().mailExecutor(executor);
    }

    @Transactional
    public void confirmPasswordReset(String token, String newPassword, String confirm) {
        cases.passwords().confirmPasswordReset(token, newPassword, confirm);
    }

    /** RF3.CA11/CA33 — troca de senha com a senha atual; encerra todas as demais sessões. */
    @Transactional
    public int changePassword(CurrentUser user, UUID currentSession, String currentPassword, String newPassword, String confirm) {
        return cases.passwords().changePassword(user, currentSession, currentPassword, newPassword, confirm);
    }

    /** Reautenticação exigida para dados sensíveis (RF3.CA01). */
    public void reauthenticate(UUID userId, String password) {
        cases.passwords().reauthenticate(userId, password);
    }

    /** Conta pelo e-mail (hash de busca). */
    public Optional<User> findByEmail(String rawEmail) {
        return cases.logins().findByEmail(rawEmail);
    }

    public static String maskEmail(String mail) {
        return IdentityFormats.maskEmail(mail);
    }

    static String escape(String s) {
        return IdentityFormats.escape(s);
    }
}
