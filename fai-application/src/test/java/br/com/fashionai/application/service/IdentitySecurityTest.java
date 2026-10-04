package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
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
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Proxy;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Força bruta e enumeração no IdentityService: tentativas de código gravadas e limitadas, bloqueio de login que
 * responde como credencial errada, 2FA contando no bloqueio, links de redefinição invalidados e @ reservados.
 */
class IdentitySecurityTest {
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

    // ------------------------------------------------------------------ confirmação de e-mail

    @Test
    void tentativaErradaNaConfirmacaoNaoEDesfeitaPeloRollback() throws Exception {
        Transactional tx = IdentityService.class.getMethod("verifyEmail", CurrentUser.class, String.class).getAnnotation(Transactional.class);
        assertTrue(Arrays.asList(tx.noRollbackFor()).contains(ApiException.class));
        Transactional change = AccountService.class.getMethod("confirmEmailChange", CurrentUser.class, String.class).getAnnotation(Transactional.class);
        assertTrue(Arrays.asList(change.noRollbackFor()).contains(ApiException.class));
    }

    @Test
    void cincoCodigosErradosInvalidamOCodigoDeConfirmacao() {
        user.setEmailVerified(false);
        VerificationCode vc = code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        for (int i = 1; i <= 4; i++) {
            assertEquals("CODIGO_INVALIDO", error(() -> identity.verifyEmail(me(), "000000")).code());
            assertEquals(i, vc.getAttempts());
        }
        assertEquals("CODIGO_EXPIRADO", error(() -> identity.verifyEmail(me(), "000000")).code());
        assertEquals(5, vc.getAttempts());
        // nem o código certo vale mais: é preciso pedir outro
        assertEquals("CODIGO_EXPIRADO", error(() -> identity.verifyEmail(me(), "123456")).code());
        assertFalse(user.isEmailVerified());
    }

    @Test
    void palpitesPorHoraSaoLimitadosMesmoComCodigosNovos() {
        user.setEmailVerified(false);
        for (int i = 0; i < IdentityService.CODE_ATTEMPTS_PER_HOUR; i++) {
            if (i % 4 == 0) {
                code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
            }
            error(() -> identity.verifyEmail(me(), "000000"));
        }
        code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        assertEquals(429, error(() -> identity.verifyEmail(me(), "123456")).status());
    }

    @Test
    void reenvioInvalidaOCodigoAnterior() {
        user.setEmailVerified(false);
        VerificationCode old = code(VerificationPurpose.EMAIL_VERIFICATION, "111111");
        identity.resendEmailVerification(me());
        assertNotNull(old.getConsumedAt());
        assertEquals(2, codeRows.size());
        assertEquals("CODIGO_INVALIDO", error(() -> identity.verifyEmail(me(), "111111")).code());
        assertFalse(user.isEmailVerified());
    }

    @Test
    void codigoCertoConfirma() {
        user.setEmailVerified(false);
        code(VerificationPurpose.EMAIL_VERIFICATION, "123456");
        identity.verifyEmail(me(), " 123456 ");
        assertTrue(user.isEmailVerified());
    }

    AccountService account() {
        return new AccountService(users(), null, null, codes(), null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, identity, null, (to, s, h, c) -> mails.add(to), null,
                new Audit(e -> audited.add(e.acao())), null);
    }

    @Test
    void trocaDeEmailTambemContaTentativasEInvalidaNaQuinta() {
        VerificationCode vc = code(VerificationPurpose.EMAIL_CHANGE, "222222");
        vc.setTarget("novo@exemplo.com");
        AccountService account = account();
        for (int i = 1; i <= 4; i++) {
            assertEquals("CODIGO_INVALIDO", error(() -> account.confirmEmailChange(me(), "999999")).code());
            assertEquals(i, vc.getAttempts());
        }
        assertEquals("CODIGO_EXPIRADO", error(() -> account.confirmEmailChange(me(), "999999")).code());
        assertEquals("CODIGO_INVALIDO", error(() -> account.confirmEmailChange(me(), "222222")).code());
        assertEquals("maria@exemplo.com", user.getEmail());
    }

    @Test
    void trocaDeEmailComCodigoCerto() {
        VerificationCode vc = code(VerificationPurpose.EMAIL_CHANGE, "222222");
        vc.setTarget("novo@exemplo.com");
        account().confirmEmailChange(me(), "222222");
        assertEquals("novo@exemplo.com", user.getEmail());
        assertNotNull(vc.getConsumedAt());
    }

    // ------------------------------------------------------------------ login

    IdentityService.LoginCommand login(String identifier, String password, String twoFactor) {
        return new IdentityService.LoginCommand(identifier, password, false, "teste", twoFactor);
    }

    @Test
    void contaBloqueadaRespondeIgualAContaInexistente() {
        for (int i = 0; i < 5; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        ApiException locked = error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua"));
        ApiException lockedWrong = error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        ApiException missing = error(() -> identity.login(login("ninguem", "errada", null), "1.1.1.1", "ua"));
        for (ApiException e : List.of(locked, lockedWrong)) {
            assertEquals(missing.status(), e.status());
            assertEquals(missing.code(), e.code());
            assertEquals(missing.getMessage(), e.getMessage());
            assertEquals(missing.details(), e.details());
        }
        assertEquals(401, locked.status());
        assertTrue(audited.contains("LOGIN_BLOQUEADO_TENTATIVAS:BLOQUEADO"), audited.toString());
    }

    @Test
    void loginCertoZeraAsFalhas() {
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        assertNotNull(identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua").accessToken());
        assertFalse(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        assertNotNull(identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua").accessToken());
    }

    /**
     * Corrida: o contador era lido antes do hash e somado depois — 40 pedidos em paralelo liam "0 falhas" e avaliavam
     * 40 senhas. Com a reserva atômica antes do hash, só 5 palpites são avaliados, venha de quantos IPs vier.
     */
    @Test
    void palpitesEmParaleloNaoPassamDoLimiteDoBloqueio() throws Exception {
        hashDelayMs = 30;
        ExecutorService pool = Executors.newFixedThreadPool(40);
        try {
            List<Future<?>> all = new ArrayList<>();
            for (int i = 0; i < 40; i++) {
                String guess = "errada" + i;
                String ip = "100.64.0." + (i + 1);
                all.add(pool.submit(() -> error(() -> identity.login(login("maria", guess, null), ip, "ua"))));
            }
            for (Future<?> f : all) {
                f.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        long evaluated = audited.stream().filter(a -> a.startsWith(AuditActions.LOGIN_FALHO + ":")).count();
        assertEquals(5, evaluated, "palpites de senha avaliados");
        hashDelayMs = 0;
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
    }

    @Test
    void senhaCertaNaoContaComoFalha() {
        for (int i = 0; i < 4; i++) {
            error(() -> identity.login(login("maria", "errada", null), "1.1.1.1", "ua"));
        }
        user.setTwoFactorEnabled(true);           // senha certa sem o código: não zera nem soma
        assertEquals("DOIS_FATORES_NECESSARIO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
        assertEquals(4, rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).used());
    }

    /** Sessão roubada (token de 15 min) tentando descobrir a senha atual pela troca de senha: mesmo bloqueio do login. */
    @Test
    void trocaDeSenhaContaNoBloqueioENaoViraOraculo() {
        CurrentUser me = CurrentUser.of(user, "1.1.1.1", "ua");
        for (int i = 0; i < 5; i++) {
            String guess = "chute" + i;
            assertEquals("SENHA_ATUAL_INCORRETA",
                    error(() -> identity.changePassword(me, UUID.randomUUID(), guess, "Nova@Forte123", "Nova@Forte123")).code());
        }
        ApiException blocked = error(() -> identity.changePassword(me, UUID.randomUUID(), PASSWORD, "Nova@Forte123", "Nova@Forte123"));
        assertEquals(429, blocked.status());
        assertEquals("MUITAS_TENTATIVAS", blocked.code());
        assertEquals("h:" + PASSWORD, user.getPasswordHash());
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
    }

    @Test
    void reautenticacaoTambemContaNoBloqueio() {
        for (int i = 0; i < 5; i++) {
            assertEquals("REAUTENTICACAO_FALHOU", error(() -> identity.reauthenticate(user.getId(), "chute")).code());
        }
        assertEquals(429, error(() -> identity.reauthenticate(user.getId(), PASSWORD)).status());
    }

    @Test
    void codigo2faErradoContaTentativasEAlimentaOBloqueio() {
        user.setTwoFactorEnabled(true);
        assertEquals("DOIS_FATORES_NECESSARIO", error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua")).code());
        VerificationCode vc = codeRows.get(codeRows.size() - 1);
        for (int i = 0; i < 5; i++) {
            assertEquals(401, error(() -> identity.login(login("maria", PASSWORD, "000000"), "1.1.1.1", "ua")).status());
        }
        assertEquals(5, vc.getAttempts());
        assertFalse(vc.isUsable(Instant.now().plusSeconds(1)));
        assertTrue(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
        // bloqueada: mesmo com senha certa e um código válido novo
        VerificationCode fresh = code(VerificationPurpose.TWO_FACTOR, "654321");
        assertEquals("NAO_AUTENTICADO", error(() -> identity.login(login("maria", PASSWORD, "654321"), "1.1.1.1", "ua")).code());
        assertTrue(fresh.getConsumedAt() == null);
    }

    @Test
    void novoCodigo2faInvalidaOAnterior() {
        user.setTwoFactorEnabled(true);
        VerificationCode old = code(VerificationPurpose.TWO_FACTOR, "111111");
        error(() -> identity.login(login("maria", PASSWORD, null), "1.1.1.1", "ua"));
        assertNotNull(old.getConsumedAt());
    }

    // ------------------------------------------------------------------ redefinição de senha

    @Test
    void redefinicaoInvalidaOsOutrosLinksEZeraOBloqueio() {
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        assertTrue(mails.isEmpty(), "o e-mail sai depois, fora da requisição");
        assertEquals(2, queuedMails.size());
        queuedMails.forEach(Runnable::run);
        String first = token(mails.get(0));
        String second = token(mails.get(1));
        for (int i = 0; i < 5; i++) {
            buckets.merge(IdentityService.LOGIN_FAIL + ":" + user.getId(), 1L, Long::sum);
        }
        identity.confirmPasswordReset(second, "Nova@Senha1", "Nova@Senha1");
        assertEquals("LINK_INVALIDO", error(() -> identity.confirmPasswordReset(first, "Outra@Senha2", "Outra@Senha2")).code());
        assertEquals("h:Nova@Senha1", user.getPasswordHash());
        assertFalse(rateLimit.status(user.getId(), IdentityService.LOGIN_FAIL, 5, Duration.ofMinutes(15)).exhausted());
    }

    @Test
    void trocaDeSenhaInvalidaLinksDeRedefinicaoPendentes() {
        identity.requestPasswordReset("maria@exemplo.com", "1.1.1.1", "ua");
        queuedMails.forEach(Runnable::run);
        String pending = token(mails.get(0));
        identity.changePassword(me(), UUID.randomUUID(), PASSWORD, "Nova@Senha1", "Nova@Senha1");
        assertEquals("LINK_INVALIDO", error(() -> identity.confirmPasswordReset(pending, "Outra@Senha2", "Outra@Senha2")).code());
    }

    @Test
    void pedidoDeRedefinicaoParaEmailInexistenteNaoEnviaNada() {
        identity.requestPasswordReset("ninguem@exemplo.com", "1.1.1.1", "ua");
        assertTrue(queuedMails.isEmpty());
        assertTrue(mails.isEmpty());
    }

    static String token(String mail) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[0-9a-f]{64}").matcher(mail);
        assertTrue(m.find(), mail);
        return m.group();
    }

    // ------------------------------------------------------------------ @ do cadastro

    IdentityService.RegisterCommand register(String username) {
        return new IdentityService.RegisterCommand(ProfileType.PESSOAL, "Pessoa Nova", username, "nova@exemplo.com", "Senha@Forte1",
                "Senha@Forte1", true, null, "BR", null, null, null, MannequinSex.FEMININO);
    }

    @Test
    void usernameQueNormalizaParaVazioOuReservadoERecusado() {
        for (String bad : new String[]{"!!!", "@@", "admin", "@Suporte", "FashionAI"}) {
            ApiException ex = error(() -> identity.register(register(bad), "1.1.1.1", "ua"));
            assertEquals("FORMULARIO_INVALIDO", ex.code(), bad);
            assertTrue(((Map<?, ?>) ex.details()).containsKey("username"), bad);
        }
        assertTrue(IdentityService.reservedUsername("moderador"));
        assertNotEquals("admin", identity.suggestUsername("Admin"));
    }
}
