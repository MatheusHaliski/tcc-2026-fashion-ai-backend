package br.com.fashionai.application.hype;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StyleCompatibilityTest {
    @Test
    void overlapCoefficientDoesNotPunishSingleTagPieces() {
        var dna = StyleCompatibility.profile(List.of("casual", "street", "minimal", "classic", "sport"), List.of("black", "white"), List.of("work"));
        var piece = StyleCompatibility.profile(List.of("Casual"), List.of("black"), List.of("work"));
        Map<String, Object> s = StyleCompatibility.score(dna, piece);
        assertThat(s).containsEntry("score", 100L);
    }

    @Test
    void mismatchedPieceScoresLowEvenIfItCouldBeViral() {
        var dna = StyleCompatibility.profile(List.of("minimal"), List.of("black"), List.of("work"));
        var piece = StyleCompatibility.profile(List.of("boho"), List.of("orange"), List.of("party"));
        assertThat(StyleCompatibility.score(dna, piece)).containsEntry("score", 0L);
    }

    @Test
    void missingSidesAreLeftOutAndNoDnaMeansNoScore() {
        var dna = StyleCompatibility.profile(List.of("casual"), List.of(), List.of());
        var piece = StyleCompatibility.profile(List.of("casual", "sport"), List.of("red"), List.of("gym"));
        Map<String, Object> s = StyleCompatibility.score(dna, piece);
        assertThat(s).containsEntry("score", 100L);
        assertThat(((Map<?, ?>) s.get("parts")).keySet().toString()).isEqualTo("[styles]");
        assertThat(StyleCompatibility.score(StyleCompatibility.profile(null, null, null), piece)).isNull();
    }
}
