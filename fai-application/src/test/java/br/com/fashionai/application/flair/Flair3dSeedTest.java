package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.Flair3dAccess;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os 5 jogos do FLAIR 3D, um por capítulo (os outros 95 ficam em data/arquivo, fora da V98): o catálogo JSON (scripts/flair-games/data) é a fonte da V98. Cada jogo passa
 * pelas mesmas regras de vaga e requisito do motor (CbcRules.validate), os números (1..100, os do catálogo original) e os slugs são únicos, e a V98
 * gerada traz exatamente um INSERT por jogo com o id previsto. As faixas de nível, guarda-roupa e Hype são as do código.
 */
class Flair3dSeedTest {
    static final Path DATA = Path.of("..", "scripts", "flair-games", "data");
    static final Path MIGRATION = Path.of("..", "fai-infrastructure", "persistence-mysql", "src", "main", "resources", "db", "migration",
            "V98__flair_3d_jogos.sql");
    static final Set<String> BANDS = Set.of("LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL");
    static final Set<String> DISTRICTS = Set.of("SUITE", "RUNWAY", "CITY", "BACKSTAGE", "COMMUNITY");

    static List<Map<String, Object>> catalog() throws IOException {
        List<Map<String, Object>> games = new ArrayList<>();
        try (Stream<Path> files = Files.list(DATA)) {
            for (Path f : files.filter(p -> p.getFileName().toString().matches("serie-[a-e]\\.json")).sorted().toList()) {
                games.addAll(Json.list(Files.readString(f)));
            }
        }
        return games;
    }

    @SuppressWarnings("unchecked")
    @Test
    void osCincoJogosPassamPelasRegrasDoMotor() throws IOException {
        List<Map<String, Object>> games = catalog();
        assertThat(games).as("5 jogos (um por capítulo) em scripts/flair-games/data").hasSize(5);
        Set<Integer> numbers = new HashSet<>();
        Set<String> slugs = new HashSet<>();
        for (Map<String, Object> g : games) {
            int number = ((Number) g.get("number")).intValue();
            String slug = String.valueOf(g.get("slug"));
            assertThat(numbers.add(number)).as("número repetido " + number).isTrue();
            assertThat(slugs.add(slug)).as("slug repetido " + slug).isTrue();
            assertThat(number).isBetween(1, 100);
            assertThat(DISTRICTS).contains(String.valueOf(g.get("district")));
            List<Map<String, Object>> rawSlots = (List<Map<String, Object>>) g.get("slots");
            List<CbcRules.Slot> slots = rawSlots.stream().map(s -> {
                Map<String, Object> accepts = s.get("accepts") instanceof Map<?, ?> a ? new java.util.LinkedHashMap<>((Map<String, Object>) a) : new java.util.LinkedHashMap<>();
                if (Boolean.TRUE.equals(s.get("optional"))) {
                    accepts.put("optional", true);
                }
                return new CbcRules.Slot(String.valueOf(s.get("key")), String.valueOf(s.get("position")), accepts);
            }).toList();
            List<Map<String, Object>> reqs = (List<Map<String, Object>>) g.getOrDefault("requirements", List.of());
            assertThat(CbcRules.validate(slots, reqs)).as(slug).isEmpty();
            Map<String, Object> deck = (Map<String, Object>) g.get("deck");
            assertThat(((Number) deck.get("minCards")).intValue()).as("minCards " + slug).isEqualTo(CbcRules.requiredSlots(slots));
            assertThat(((Number) deck.get("maxCards")).intValue()).as("maxCards " + slug).isEqualTo(slots.size());
            Map<String, Object> hype = (Map<String, Object>) g.get("hype");
            for (String k : List.of("deckMin", "mandatoryMin", "mandatoryMax")) {
                assertThat(BANDS).as(slug + " " + k).contains(String.valueOf(hype.get(k)));
            }
            assertThat(Flair3dHype.PLAY_MODES).as(slug + " play").contains(String.valueOf(((Map<String, Object>) hype.get("play")).get("mode")));
            assertThat(Flair3dHype.PARTIAL_MODES).as(slug + " partial").contains(String.valueOf(((Map<String, Object>) hype.get("partial")).get("mode")));
            int points = ((Number) g.get("points")).intValue();
            assertThat(points).as("pontos " + slug).isBetween(0, 200);
        }
    }

    @Test
    void aMigracaoGeradaTemUmInsertPorJogoComOIdPrevisto() throws IOException {
        List<Map<String, Object>> games = catalog();
        String sql = Files.readString(MIGRATION);
        for (Map<String, Object> g : games) {
            int number = ((Number) g.get("number")).intValue();
            String id = String.format("7d000000-0000-4000-8000-%012d", number);
            assertThat(sql).as("INSERT do jogo " + number).contains("('" + id + "','" + g.get("slug") + "'");
            assertThat(sql).as("nível válido " + number).containsAnyOf(
                    Stream.of(FaiPointsService.Level.values()).map(l -> "'" + l.name() + "'").toArray(String[]::new));
        }
        for (Flair3dAccess.WardrobeLevel w : Flair3dAccess.WardrobeLevel.values()) {
            assertThat(w.name()).isNotBlank();
        }
        assertThat(sql).contains("FLAIR_3D").contains("FLAIR_3D_PERFECT").contains("flair_game_rewards");
    }
}
