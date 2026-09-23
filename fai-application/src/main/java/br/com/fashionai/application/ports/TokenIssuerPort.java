package br.com.fashionai.application.ports;

import br.com.fashionai.domain.model.User;

import java.time.Duration;
import java.util.UUID;

/** Emissão do access token JWT (RNF2) — implementado na camada web com chave RSA (Nimbus). */
public interface TokenIssuerPort {
    String issueAccessToken(User user, UUID sessionId);

    Duration accessTokenTtl();
}
