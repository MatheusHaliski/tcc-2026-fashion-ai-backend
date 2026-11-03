package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Os casos de uso por trás do {@link IdentityService}, montados uma vez no construtor do serviço com as mesmas
 * dependências (só referências: nenhuma é chamada aqui, exceto o hash descartável do login, como antes).
 */
record IdentityUseCases(IdentityPreUploads preUploads, IdentityUsernames usernames, IdentityCodes codeBook,
                        IdentitySessions sessions, IdentityRegistration registration, IdentityEmailVerification verification,
                        IdentityLogin logins, IdentityPasswords passwords) {

    static IdentityUseCases wire(UserRepository users, UserPreferencesRepository preferences, BrandProfileRepository brands,
                                 CelebrityProfileRepository celebrities, RefreshTokenRepository refreshTokens,
                                 VerificationCodeRepository codes, PasswordHasherPort hasher, TokenIssuerPort tokens,
                                 RateLimitPort rateLimit, EmailSenderPort email, NotificationService notifications, Audit audit,
                                 MediaStoragePort storage, String frontendUrl, Supplier<IssuerReviewService> issuerReview) {
        IdentityPreUploads preUploads = new IdentityPreUploads(storage, rateLimit, users, brands, celebrities);
        IdentityUsernames usernames = new IdentityUsernames(users);
        IdentityCodes codeBook = new IdentityCodes(codes, rateLimit, email, preferences, frontendUrl);
        IdentitySessions sessions = new IdentitySessions(refreshTokens, tokens, audit);
        IdentityRegistration registration = new IdentityRegistration(users, preferences, brands, celebrities, hasher, email,
                notifications, audit, storage, preUploads, usernames, codeBook, sessions, issuerReview);
        IdentityEmailVerification verification = new IdentityEmailVerification(users, codes, brands, celebrities, rateLimit,
                audit, codeBook, issuerReview);
        IdentityLogin logins = new IdentityLogin(users, codes, refreshTokens, hasher, rateLimit, notifications, audit, codeBook,
                sessions, hasher.hash("fashion-ai-timing-" + UUID.randomUUID()));
        IdentityPasswords passwords = new IdentityPasswords(users, codes, hasher, rateLimit, email, notifications, audit,
                frontendUrl, codeBook, sessions, new IdentityLockout(rateLimit, hasher, audit), logins);
        return new IdentityUseCases(preUploads, usernames, codeBook, sessions, registration, verification, logins, passwords);
    }
}
