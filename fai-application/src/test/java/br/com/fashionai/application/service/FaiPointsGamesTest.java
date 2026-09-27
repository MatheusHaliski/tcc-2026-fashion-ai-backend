package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** RF41 — qualquer jogo lança FAI Points pela mesma ponte: jogar, vencer, 1× por partida, teto diário. */
class FaiPointsGamesTest {
    private final List<FaiPointsLedgerEntry> rows = new ArrayList<>();
    private final Map<String, FaiPointsRule> rules = new HashMap<>();
    private FaiPointsService service;
    private final UUID player = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        rule("GAME_PLAYED", 5, 6);
        rule("GAME_WON", 10, 4);
        rule("FLAIR_QUEST", 10, 3);
        FaiPointsLedgerEntryRepository ledger = proxy(FaiPointsLedgerEntryRepository.class, (name, a) -> switch (name) {
            case "existsByIdempotencyKey" -> rows.stream().anyMatch(e -> e.getIdempotencyKey().equals(a[0]));
            case "countByUserIdAndActionCodeAndCreatedAtAfter" -> rows.stream()
                    .filter(e -> e.getUserId().equals(a[0]) && e.getActionCode().equals(a[1])).count();
            case "save" -> {
                FaiPointsLedgerEntry e = (FaiPointsLedgerEntry) a[0];
                rows.add(e);
                yield e;
            }
            case "balance" -> rows.stream().filter(e -> e.getUserId().equals(a[0])).mapToLong(FaiPointsLedgerEntry::getDelta).sum();
            case "lifetime" -> rows.stream().filter(e -> e.getUserId().equals(a[0]) && e.isCountsLifetime()).mapToLong(FaiPointsLedgerEntry::getDelta).sum();
            default -> throw new UnsupportedOperationException(name);
        });
        FaiPointsRuleRepository ruleRepo = proxy(FaiPointsRuleRepository.class, (name, a) -> {
            if ("findById".equals(name)) {
                return Optional.ofNullable(rules.get((String) a[0]));
            }
            throw new UnsupportedOperationException(name);
        });
        service = new FaiPointsService(ledger, ruleRepo, null, null, null, null, null);
    }

    private void rule(String code, int points, Integer dailyCap) {
        FaiPointsRule r = new FaiPointsRule();
        r.setActionCode(code);
        r.setPoints(points);
        r.setDailyCap(dailyCap);
        r.setOncePerRef(true);
        rules.put(code, r);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.util.function.BiFunction<String, Object[], Object> body) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (p, m, a) -> m.getDeclaringClass() == Object.class ? m.invoke(new Object(), a) : body.apply(m.getName(), a));
    }

    @Test
    void jogarPontuaEVencerPontuaDeNovo() {
        assertEquals(15, service.game(player, "FLAIR_DUEL", "m1", "WIN"));
        assertEquals(5, service.game(player, "FLAIR_BATTLE", "m2", "LOSS"));
        assertEquals(5, service.game(player, "CHALLENGE", "c1", null));
        assertEquals(25, service.balance(player));
        assertEquals(25, service.lifetime(player));
        assertTrue(rows.stream().allMatch(e -> "GAME".equals(e.getRefType())));
    }

    @Test
    void mesmaPartidaNaoPagaDuasVezes() {
        assertEquals(15, service.game(player, "FLAIR_TEAM", "m1", "WIN"));
        assertEquals(0, service.game(player, "FLAIR_TEAM", "m1", "WIN"));
        // o mesmo id de partida em outro jogo é outra partida
        assertEquals(5, service.game(player, "FLAIR_ARENA", "m1", null));
    }

    @Test
    void tetoDiarioSeguraOFarmSemQuebrarOJogo() {
        int total = 0;
        for (int i = 0; i < 10; i++) {
            total += service.game(player, "FLAIR_DUEL", "m" + i, "WIN");
        }
        assertEquals(6 * 5 + 4 * 10, total);     // 6 partidas e 4 vitórias pagas; as outras só não pontuam
        assertEquals(0, service.game(player, "FLAIR_CHESS", "x", "WIN"));
    }

    @Test
    void semRegraAtivaNaoPaga() {
        rules.get("GAME_WON").setActive(false);
        assertEquals(5, service.game(player, "FLAIR_DUEL", "m1", "WIN"));
        rules.clear();
        assertEquals(0, service.game(player, "FLAIR_DUEL", "m2", "WIN"));
        assertEquals(1, rows.size());
    }
}
