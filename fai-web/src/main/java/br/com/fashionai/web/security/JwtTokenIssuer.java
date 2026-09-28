package br.com.fashionai.web.security;

import br.com.fashionai.application.ports.TokenIssuerPort;
import br.com.fashionai.domain.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Access token RS256 curto (RNF2): sub/user_id, sessão (sid), papel e tipo de perfil. */
@Component
public class JwtTokenIssuer implements TokenIssuerPort {
    private final JwtEncoder encoder;
    private final String issuer;
    private final String audience;
    private final Duration ttl;

    public JwtTokenIssuer(JwtEncoder encoder,
                          @Value("${fashionai.jwt.issuer:fashionai}") String issuer,
                          @Value("${fashionai.jwt.audience:fashionai-api}") String audience,
                          @Value("${fashionai.jwt.access-ttl-minutes:15}") long ttlMinutes) {
        this.encoder = encoder;
        this.issuer = issuer;
        this.audience = audience;
        this.ttl = Duration.ofMinutes(ttlMinutes);
    }

    @Override
    public String issueAccessToken(User user, UUID sessionId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .audience(java.util.List.of(audience))       // só esta API aceita o token (RFC 8725 §3.9)
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .claim("user_id", user.getId().toString())
                .claim("sid", sessionId.toString())
                .claim("username", user.getUsername())
                .claim("role", user.getRole())
                .claim("profile_type", user.getProfileType().name())
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId("fai-1").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    @Override
    public Duration accessTokenTtl() {
        return ttl;
    }
}
