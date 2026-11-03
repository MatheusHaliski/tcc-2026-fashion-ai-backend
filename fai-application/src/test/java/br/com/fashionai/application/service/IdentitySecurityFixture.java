package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

import java.lang.reflect.Proxy;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fixture compartilhada dos testes de força bruta e enumeração do IdentityService (antes num só IdentitySecurityTest):
 * repositórios em memória por proxy, RateLimitPort de janela fixa, hash falso com atraso opcional e os construtores
 * de comando, código e conta usados pelos temas (confirmação de e-mail, login, redefinição de senha, cadastro).
 */
abstract class IdentitySecurityFixture {
    static final String PASSWORD = "Senha@Forte1";

    final Map<UUID, User> userRows = new HashMap<>();
    final List<VerificationCode> codeRows = new ArrayList<>();
    final List<String> mails = new ArrayList<>();
    final List<Runnable> queuedMails = new ArrayList<>();
    final List<String> audited = java.util.Collections.synchronizedList(new ArrayList<>());
    final Map<String, Long> buckets = new ConcurrentHashMap<>();
    /** Atraso do hash falso: abre a janela entre ler o contador e somar a falha (teste da corrida). */
    volatile long hashDelayMs;
    IdentityService identity;
    User user;

    /** RateLimitPort com janela fixa (contagem só, sem relógio): basta para as regras de bloqueio. */
    final RateLimitPort rateLimit = new RateLimitPort() {
        @Override
        public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
            return buckets.merge(bucket + ":" + userId, 1L, Long::sum) <= limit;
        }

        @Override
        public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
            return new QuotaStatus(limit, buckets.getOrDefault(bucket + ":" + userId, 0L), Instant.now().plus(window));
        }

        @Override
        public void reset(UUID userId, String bucket) {
            buckets.remove(bucket + ":" + userId);
        }

        @Override
        public void release(UUID userId, String bucket) {
            buckets.computeIfPresent(bucket + ":" + userId, (k, v) -> Math.max(0L, v - 1));
        }
    };

    @SuppressWarnings("unchecked")
    static <T> T proxy(Class<T> type, BiFunction<String, Object[], Object> body) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (p, m, a) -> m.getDeclaringClass() == Object.class ? m.invoke(new Object(), a) : body.apply(m.getName(), a));
    }

    static User newUser(String username, String email) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setDisplayName(username);
        u.setEmail(email);
        u.setEmailHash(Hashing.emailHash(email));
        u.setPasswordHash("h:" + PASSWORD);
        u.setProfileType(ProfileType.PESSOAL);
        u.setStatus(AccountStatus.ACTIVE);
        u.setEmailVerified(true);
        return u;
    }

    UserRepository users() {
        return proxy(UserRepository.class, (name, a) -> switch (name) {
            case "findById" -> Optional.ofNullable(userRows.get((UUID) a[0]));
            case "findByEmailHash" -> userRows.values().stream().filter(u -> a[0].equals(u.getEmailHash())).findFirst();
            case "existsByEmailHash" -> userRows.values().stream().anyMatch(u -> a[0].equals(u.getEmailHash()));
            case "findByUsernameIgnoreCase" -> userRows.values().stream().filter(u -> ((String) a[0]).equalsIgnoreCase(u.getUsername())).findFirst();
            case "existsByUsernameIgnoreCase" -> userRows.values().stream().anyMatch(u -> ((String) a[0]).equalsIgnoreCase(u.getUsername()));
            case "save" -> {
                User u = (User) a[0];
                userRows.put(u.getId(), u);
                yield u;
            }
            default -> throw new UnsupportedOperationException(name);
        });
    }

    VerificationCodeRepository codes() {
        return proxy(VerificationCodeRepository.class, (name, a) -> switch (name) {
            case "save" -> {
                VerificationCode c = (VerificationCode) a[0];
                c.markCreatedAt(Instant.now().plusNanos(codeRows.size()));
                codeRows.add(c);
                yield c;
            }
            case "findFirstByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc" -> open((UUID) a[0], (VerificationPurpose) a[1])
                    .reduce((first, second) -> second);
            case "findByUserIdAndPurposeAndConsumedAtIsNull" -> open((UUID) a[0], (VerificationPurpose) a[1]).toList();
            case "findByCodeHashAndPurpose" -> codeRows.stream().filter(c -> a[0].equals(c.getCodeHash()) && c.getPurpose() == a[1]).findFirst();
            default -> throw new UnsupportedOperationException(name);
        });
    }

    java.util.stream.Stream<VerificationCode> open(UUID userId, VerificationPurpose purpose) {
        return codeRows.stream().filter(c -> c.getUser().getId().equals(userId) && c.getPurpose() == purpose && c.getConsumedAt() == null);
    }

    @BeforeEach
    void setUp() {
        user = newUser("maria", "maria@exemplo.com");
        userRows.put(user.getId(), user);
        PasswordHasherPort hasher = new PasswordHasherPort() {
            public String hash(String raw) { return "h:" + raw; }
            public boolean matches(String raw, String encoded) {
                if (hashDelayMs > 0) {
                    try {
                        Thread.sleep(hashDelayMs);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
                return ("h:" + raw).equals(encoded);
            }
        };
        TokenIssuerPort tokens = new TokenIssuerPort() {
            public String issueAccessToken(User u, UUID sessionId) { return "jwt"; }
            public Duration accessTokenTtl() { return Duration.ofMinutes(15); }
        };
        RefreshTokenRepository refresh = proxy(RefreshTokenRepository.class, (name, a) -> switch (name) {
            case "save" -> a[0];
            case "findByUserIdAndRevokedAtIsNullAndExpiresAtAfter" -> List.<RefreshToken>of();
            default -> throw new UnsupportedOperationException(name);
        });
        UserPreferencesRepository prefs = proxy(UserPreferencesRepository.class, (name, a) -> switch (name) {
            case "findByUserId" -> Optional.empty();
            case "save" -> a[0];
            default -> throw new UnsupportedOperationException(name);
        });
        EmailSenderPort email = (to, subject, html, category) -> mails.add(to + "|" + html);
        NotificationService notifications = org.mockito.Mockito.mock(NotificationService.class);
        MediaStoragePort storage = proxy(MediaStoragePort.class, (name, a) -> switch (name) {
            case "keyOf" -> Optional.empty();
            case "publicUrl" -> URI.create("http://x/media/" + a[0]);
            default -> throw new UnsupportedOperationException(name);
        });
        identity = new IdentityService(users(), prefs, proxy(BrandProfileRepository.class, (n, a) -> Optional.empty()),
                proxy(CelebrityProfileRepository.class, (n, a) -> Optional.empty()), refresh, codes(), hasher, tokens, rateLimit,
                email, notifications, new Audit(e -> audited.add(e.acao() + ":" + e.resultado())), storage, "http://front");
        identity.mailExecutor(queuedMails::add);
    }

    @AfterEach
    void clear() {
        userRows.clear();
        codeRows.clear();
    }

    CurrentUser me() {
        return CurrentUser.of(user, "127.0.0.1", "teste");
    }

    VerificationCode code(VerificationPurpose purpose, String plain) {
        VerificationCode vc = new VerificationCode();
        vc.setUser(user);
        vc.setPurpose(purpose);
        vc.setCodeHash(Hashing.sha256(user.getId() + ":" + plain));
        vc.setExpiresAt(Instant.now().plus(Duration.ofHours(1)));
        vc.setLastSentAt(Instant.now());
        codes().save(vc);
        return vc;
    }

    static ApiException error(Runnable r) {
        return assertThrows(ApiException.class, r::run);
    }

    AccountService account() {
        return new AccountService(users(), null, null, codes(), null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, identity, null, (to, s, h, c) -> mails.add(to), null,
                new Audit(e -> audited.add(e.acao())), null);
    }

    IdentityService.LoginCommand login(String identifier, String password, String twoFactor) {
        return new IdentityService.LoginCommand(identifier, password, false, "teste", twoFactor);
    }

    static String token(String mail) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[0-9a-f]{64}").matcher(mail);
        assertTrue(m.find(), mail);
        return m.group();
    }

    IdentityService.RegisterCommand register(String username) {
        return new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Pessoa Nova", username, "nova@exemplo.com", "Senha@Forte1",
                "Senha@Forte1", true, null, "BR", null, null, null, MannequinSex.FEMININO);
    }

    static List<String> errorKeys(ApiException ex) {
        assertEquals("FORMULARIO_INVALIDO", ex.code());
        return ((Map<?, ?>) ex.details()).keySet().stream().map(String::valueOf).toList();
    }
}
