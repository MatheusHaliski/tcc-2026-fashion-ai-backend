package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

/**
 * HypeScore v2 — política de integridade dos sinais (antimanipulação mínima, com pontos de extensão documentados em
 * HYPESCORE_ARCHITECTURE.md §10). Decide se um sinal conta e com que peso, ANTES de entrar no agregado:
 *
 * <ul>
 *   <li><b>self-like farming</b>: interação ou visualização do próprio dono não conta (uso próprio conta: é uso);</li>
 *   <li><b>visualização artificial / save-unsave repetitivo / spam</b>: 1 sinal por pessoa, entidade, tipo e dia
 *       (dedupe com TTL no cache — Redis quando ligado, memória no fallback);</li>
 *   <li><b>contas recém-criadas</b>: pesam {@code newAccountWeight} nos primeiros {@code newAccountDays} dias;</li>
 *   <li><b>visitante</b>: sem conta não há como deduplicar — não conta.</li>
 * </ul>
 * Extensões previstas (não implementadas): reputação do ator, detecção de bots por cadência, grafo de contas que só
 * interagem entre si, limite por IP/dispositivo, e o patrocínio NUNCA entra aqui (conteúdo patrocinado tem rótulo próprio).
 */
@Component
public class HypeIntegrityPolicy {
    static final Set<HypeSignalType> OWNER_ACTIONS = Set.of(HypeSignalType.PIECE_USED, HypeSignalType.PIECE_IN_LOOK, HypeSignalType.LOOK_WORN);
    private static final Duration DEDUPE_TTL = Duration.ofHours(26);

    private final RenderCachePort cache;
    private final UserRepository users;
    private final HypeScoreConfig config;

    public HypeIntegrityPolicy(RenderCachePort cache, UserRepository users, HypeScoreConfig config) {
        this.cache = cache;
        this.users = users;
        this.config = config;
    }

    /** Peso do sinal (0 = descartado). */
    public double weight(DomainEvents.HypeSignal s, LocalDate day) {
        if (s.entityId() == null || s.actorId() == null) {
            return 0;
        }
        boolean ownerAction = OWNER_ACTIONS.contains(s.signal());
        if (!ownerAction && s.actorId().equals(s.ownerId())) {
            return 0;
        }
        String key = "hype:dedupe:" + s.signal() + ":" + s.entityId() + ":" + s.actorId() + ":" + day;
        if (cache.get(key).isPresent()) {
            return 0;
        }
        cache.put(key, "1", DEDUPE_TTL);
        if (ownerAction) {
            return 1;
        }
        return isNewAccount(s.actorId()) ? config.newAccountWeight() : 1;
    }

    boolean isNewAccount(UUID actorId) {
        if (config.newAccountDays() <= 0) {
            return false;
        }
        return users.findById(actorId).map(u -> u.getCreatedAt() != null
                && u.getCreatedAt().isAfter(Instant.now().minus(config.newAccountDays(), ChronoUnit.DAYS))).orElse(true);
    }
}
