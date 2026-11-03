package br.com.fashionai.application.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Relógio dos Desafios de Montagem, compartilhado pelos colaboradores do {@link FlairChallengeService}: troca pelo
 * {@code useClock} (testes) vale para todos depois da construção (R82).
 */
final class FlairChallengeClock {
    private Clock clock = Clock.systemUTC();

    void use(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return Instant.now(clock);
    }

    LocalDate today() {
        return LocalDate.ofInstant(now(), FaiPointsService.ZONE);
    }
}
