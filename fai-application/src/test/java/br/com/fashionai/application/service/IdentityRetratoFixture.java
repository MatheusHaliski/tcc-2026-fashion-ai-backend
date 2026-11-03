package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.AdditionalAnswers;
import org.mockito.Mockito;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Cenário do retrato do IdentityService (R95): repositórios em memória do testkit, storage em memória, hash de senha
 * e limite de tentativas falsos mas gravando as chamadas (mock que delega), e-mail, notificações, auditoria e a análise
 * de emissor como mocks. O retrato é a lista de respostas, chamadas e linhas gravadas.
 */
abstract class IdentityRetratoFixture {
    static final String PASSWORD = "Senha@Forte1";
    final Map<String, Long> buckets = new ConcurrentHashMap<>();
    final Map<String, byte[]> objects = new LinkedHashMap<>();
    final IdentityRetrato r = new IdentityRetrato();
    Kit kit;
    IdentityService identity;
    IssuerReviewService issuerReview;
    RateLimitPort rateLimit;
    PasswordHasherPort hasher;
    MediaStoragePort storage;

    @BeforeEach
    void setUpRetrato() {
        kit = new Kit();
        rateLimit = Mockito.mock(RateLimitPort.class, AdditionalAnswers.delegatesTo(new RateLimitPort() {
            public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
                return buckets.merge(bucket + ":" + userId, 1L, Long::sum) <= limit;
            }

            public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
                return new QuotaStatus(limit, buckets.getOrDefault(bucket + ":" + userId, 0L), Instant.now().plus(window));
            }

            public void reset(UUID userId, String bucket) {
                buckets.remove(bucket + ":" + userId);
            }

            public void release(UUID userId, String bucket) {
                buckets.computeIfPresent(bucket + ":" + userId, (k, v) -> Math.max(0L, v - 1));
            }
        }));
        hasher = Mockito.mock(PasswordHasherPort.class, AdditionalAnswers.delegatesTo(new PasswordHasherPort() {
            public String hash(String raw) {
                return "h:" + raw;
            }

            public boolean matches(String raw, String encoded) {
                return encoded != null && (encoded.equals("h:" + raw) || encoded.equals("old:" + raw));
            }

            public boolean needsRehash(String encoded) {
                return encoded != null && encoded.startsWith("old:");
            }
        }));
        TokenIssuerPort tokens = Mockito.mock(TokenIssuerPort.class);
        when(tokens.issueAccessToken(any(), any())).thenAnswer(i -> "jwt:" + ((User) i.getArgument(0)).getUsername());
        when(tokens.accessTokenTtl()).thenReturn(Duration.ofMinutes(15));
        storage = Mockito.mock(MediaStoragePort.class);
        when(storage.put(anyString(), any(), anyString())).thenAnswer(i -> {
            String key = i.getArgument(0);
            byte[] bytes = i.getArgument(1);
            objects.put(key, bytes);
            return new MediaStoragePort.StoredObject(key, "http://media/" + key, bytes.length, i.getArgument(2));
        });
        when(storage.get(anyString())).thenAnswer(i -> {
            byte[] bytes = objects.get((String) i.getArgument(0));
            if (bytes == null) {
                throw new IllegalStateException("ausente");
            }
            return bytes;
        });
        when(storage.keyOf(anyString())).thenAnswer(i -> {
            String url = i.getArgument(0);
            return url.startsWith("http://media/") ? Optional.of(url.substring("http://media/".length())) : Optional.empty();
        });
        when(storage.publicUrl(anyString())).thenAnswer(i -> URI.create("http://media/" + i.getArgument(0)));
        when(storage.listOlderThan(anyString(), any(), anyInt())).thenAnswer(i -> objects.keySet().stream()
                .filter(k -> k.startsWith((String) i.getArgument(0))).toList());
        kit.with(rateLimit, hasher, tokens, storage);
        identity = kit.build(IdentityService.class);
        issuerReview = Mockito.mock(IssuerReviewService.class);
        identity.setIssuerReview(issuerReview);
        identity.mailExecutor(Runnable::run);
    }

    /** Chamadas de todos os colaboradores falsos desde o último retrato. */
    void calls() {
        r.calls("email", kit.dep(EmailSenderPort.class));
        r.calls("notifications", kit.dep(NotificationService.class));
        r.calls("audit", kit.dep(Audit.class));
        r.calls("storage", storage);
        r.calls("rateLimit", rateLimit);
        r.calls("hasher", hasher);
        r.calls("tokens", kit.dep(TokenIssuerPort.class));
        r.calls("issuerReview", issuerReview);
    }

    /** Linhas gravadas nos repositórios em memória e nos contadores. */
    void rows() {
        for (User u : MemoryRepository.<User>rows(kit.dep(UserRepository.class))) {
            r.line("user", List.of(u, u.getUsername(), u.getDisplayName(), u.getEmail(), String.valueOf(u.getEmailHash()),
                    String.valueOf(u.getPasswordHash()), u.getProfileType(), String.valueOf(u.getStatus()), u.isEmailVerified(),
                    String.valueOf(u.getCountry()), String.valueOf(u.getBirthDate()), String.valueOf(u.getSex()),
                    String.valueOf(u.getAvatarUrl()), u.isPrivateAccount(), String.valueOf(u.getTermsVersion()),
                    String.valueOf(u.getTermsAcceptedAt() != null), String.valueOf(u.getLastLoginAt() != null)));
        }
        for (UserPreferences p : MemoryRepository.<UserPreferences>rows(kit.dep(UserPreferencesRepository.class))) {
            r.line("prefs", List.of(p.getUser(), String.valueOf(p.getLanguage()), String.valueOf(p.getMannequinSex())));
        }
        for (BrandProfile b : MemoryRepository.<BrandProfile>rows(kit.dep(BrandProfileRepository.class))) {
            r.line("brand", List.of(b.getOwner(), b.getBrandName(), b.getSlug(), String.valueOf(b.getLogoUrl()), b.getCnpj(),
                    b.getRazaoSocial(), String.valueOf(b.getNomeFantasia()), String.valueOf(b.getFashionCategory()),
                    String.valueOf(b.getStoreUrl()), String.valueOf(b.getCommercialContact()), String.valueOf(b.getOfficialHashtag()),
                    String.valueOf(b.getActivityProofUrl()), String.valueOf(b.getCountry()), b.getApprovalStatus()));
        }
        for (CelebrityProfile c : MemoryRepository.<CelebrityProfile>rows(kit.dep(CelebrityProfileRepository.class))) {
            r.line("celebrity", List.of(c.getOwner(), c.getStageName(), c.getSlug(), String.valueOf(c.getAvatarUrl()),
                    String.valueOf(c.getRealName()), String.valueOf(c.getIdentityProofUrl()), String.valueOf(c.getAreasJson()),
                    String.valueOf(c.getVerifiableFollowersJson()), String.valueOf(c.getVerificationUrl()),
                    String.valueOf(c.getProfessionalHistory()), String.valueOf(c.getRepresentationContact()),
                    String.valueOf(c.getFashionInterestsJson()), c.isSealConsentGranted(), c.getVerificationStatus()));
        }
        Instant now = Instant.now();
        for (VerificationCode c : MemoryRepository.<VerificationCode>rows(kit.dep(VerificationCodeRepository.class))) {
            r.line("code", List.of(c.getUser(), c.getPurpose(), String.valueOf(c.getTarget()), c.getAttempts(),
                    String.valueOf(c.getConsumedAt() != null), minutes(now, c.getExpiresAt()), String.valueOf(c.getLastSentAt() != null)));
        }
        for (RefreshToken t : MemoryRepository.<RefreshToken>rows(kit.dep(RefreshTokenRepository.class))) {
            r.line("refresh", List.of(t.getUser(), String.valueOf(t.getFamilyId()), String.valueOf(t.getRotatedFromId()),
                    t.isPersistent(), minutes(now, t.getExpiresAt()), String.valueOf(t.getCreatedIp()), String.valueOf(t.getUserAgent()),
                    String.valueOf(t.getDeviceName()), String.valueOf(t.getLocationApprox()), String.valueOf(t.getRevokedAt() != null)));
        }
        r.line("buckets", buckets);
        r.line("objects", List.copyOf(objects.keySet()));
    }

    static String minutes(Instant now, Instant at) {
        return at == null ? "null" : Math.round(Duration.between(now, at).getSeconds() / 60.0) + "min";
    }

    /** Código conhecido, mais novo que os gerados pelo serviço (o serviço lê o mais recente). */
    VerificationCode knownCode(User u, VerificationPurpose purpose, String plain) {
        VerificationCode vc = new VerificationCode();
        vc.setUser(u);
        vc.setPurpose(purpose);
        vc.setCodeHash(Hashing.sha256(u.getId() + ":" + plain));
        vc.setTarget(u.getEmailHash());
        vc.setExpiresAt(Instant.now().plus(Duration.ofHours(1)));
        vc.markCreatedAt(Instant.now().plusSeconds(60));
        return kit.dep(VerificationCodeRepository.class).save(vc);
    }

    User userNamed(String username) {
        return kit.dep(UserRepository.class).findByUsernameIgnoreCase(username).orElseThrow();
    }

    /** O último token de 64 hex enviado por e-mail (link de redefinição). */
    String lastMailedToken() {
        String token = null;
        for (var i : Mockito.mockingDetails(kit.dep(EmailSenderPort.class)).getInvocations()) {
            Matcher m = Pattern.compile("[0-9a-f]{64}").matcher(String.valueOf(i.getArguments()[2]));
            if (m.find()) {
                token = m.group();
            }
        }
        return token;
    }

    static byte[] png(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < w; x++) {
            for (int y = 0; y < h; y++) {
                img.setRGB(x, y, (x * 7 + y * 3) % 256 << 8 | 0x40);
            }
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
