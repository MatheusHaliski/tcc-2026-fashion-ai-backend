package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HypeIntegrityPolicyTest {
    static final class MapCache implements RenderCachePort {
        final Map<String, String> m = new HashMap<>();

        public Optional<String> get(String key) {
            return Optional.ofNullable(m.get(key));
        }

        public void put(String key, String value, Duration ttl) {
            m.put(key, value);
        }

        public void evict(String key) {
            m.remove(key);
        }
    }

    private final UUID owner = UUID.randomUUID();
    private final UUID veteran = UUID.randomUUID();
    private final UUID newcomer = UUID.randomUUID();
    private final UUID piece = UUID.randomUUID();
    private final LocalDate day = LocalDate.of(2026, 10, 4);
    private HypeIntegrityPolicy policy;

    @BeforeEach
    void setUp() {
        UserRepository users = mock(UserRepository.class);
        User old = new User();
        old.markCreatedAt(Instant.now().minus(400, ChronoUnit.DAYS));
        User fresh = new User();
        fresh.markCreatedAt(Instant.now().minus(1, ChronoUnit.DAYS));
        when(users.findById(veteran)).thenReturn(Optional.of(old));
        when(users.findById(newcomer)).thenReturn(Optional.of(fresh));
        policy = new HypeIntegrityPolicy(new MapCache(), users, HypeScoreConfig.defaults());
    }

    private DomainEvents.HypeSignal signal(HypeSignalType t, UUID actor) {
        return new DomainEvents.HypeSignal(t, HypeEntityType.PIECE, piece, actor, owner);
    }

    @Test
    void selfInteractionsDoNotCount() {
        assertThat(policy.weight(signal(HypeSignalType.LIKE_CREATED, owner), day)).isZero();
        assertThat(policy.weight(signal(HypeSignalType.PIECE_VIEWED, owner), day)).isZero();
    }

    @Test
    void ownerUsageCountsBecauseUsingIsTheSignal() {
        assertThat(policy.weight(signal(HypeSignalType.PIECE_USED, owner), day)).isEqualTo(1.0);
    }

    @Test
    void repeatedSignalsFromTheSamePersonOnTheSameDayCountOnce() {
        assertThat(policy.weight(signal(HypeSignalType.SAVE_CREATED, veteran), day)).isEqualTo(1.0);
        assertThat(policy.weight(signal(HypeSignalType.SAVE_CREATED, veteran), day)).isZero();   // save → unsave → save
        assertThat(policy.weight(signal(HypeSignalType.SAVE_CREATED, veteran), day.plusDays(1))).isEqualTo(1.0);
    }

    @Test
    void newAccountsWeighLessAndVisitorsDoNotCount() {
        assertThat(policy.weight(signal(HypeSignalType.LIKE_CREATED, newcomer), day)).isEqualTo(0.5);
        assertThat(policy.weight(signal(HypeSignalType.PIECE_VIEWED, null), day)).isZero();
    }
}
