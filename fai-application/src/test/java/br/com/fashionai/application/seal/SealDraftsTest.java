package br.com.fashionai.application.seal;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SealDraftsTest {
    private static WardrobeItem piece(String color, String occasions, String styles) {
        WardrobeItem w = new WardrobeItem();
        w.setColor(color);
        w.setCategory("upper_piece");
        w.setOccasionTags(occasions);
        w.setStyleTags(styles);
        return w;
    }

    @Test
    void brandDraftUsesTheMostFrequentColorFamilyBrandAndTags() {
        List<WardrobeItem> pieces = List.of(piece("navy", "party", "streetwear"), piece("blue", "party,work", "streetwear"),
                piece("red", "casual", "classic"));
        Map<String, Object> d = SealDrafts.suggest("Zara", false, SealTier.LOOK, pieces);
        assertThat(d.get("tier")).isEqualTo("LOOK");
        Map<String, Object> policy = map(d.get("policy"));
        Map<String, Object> rule = map(list(policy.get("rules")).get(0));
        assertThat(rule).containsEntry("quantifier", "AT_LEAST").containsEntry("color", "Azul").containsEntry("brand", "Zara");
        assertThat(list(policy.get("occasions"))).containsExactly("party", "work");
        assertThat(list(policy.get("styles"))).first().isEqualTo("streetwear");
        Map<String, Object> design = map(d.get("design"));
        assertThat(design).containsEntry("kind", "CIRCULAR").containsEntry("mode", "TEMPLATE");
        assertThat(String.valueOf(design.get("template"))).startsWith("circular/");
        assertThat(map(design.get("element"))).containsEntry("text", "ZAR").containsEntry("id", "BAG");
        assertThat(list(d.get("reasons"))).isNotEmpty();
        // a sugestão é válida para o próprio validador da política
        assertThat(br.com.fashionai.application.service.SealPolicies.normalize(policy)).isNotNull();
    }

    @Test
    void celebrityDraftIsAPremiumFolhaWithTheStageNameAsTitle() {
        Map<String, Object> d = SealDrafts.suggest("Zendaya", true, SealTier.LOOK, List.of(piece("emerald", null, "chic")));
        assertThat(map(d.get("design"))).containsEntry("kind", "FOLHA").containsEntry("template", "folha/mat-12").containsEntry("label", "Zendaya");
        Map<String, Object> rule = map(list(map(d.get("policy")).get("rules")).get(0));
        assertThat(rule).containsEntry("color", "Verde").doesNotContainKey("brand");
    }

    @Test
    void withoutPiecesTheBrandRuleStillAppliesAndPieceTierUsesTheHanger() {
        Map<String, Object> d = SealDrafts.suggest("New Balance", false, SealTier.PECA, List.of());
        assertThat(d.get("tier")).isEqualTo("PECA");
        Map<String, Object> rule = map(list(map(d.get("policy")).get("rules")).get(0));
        assertThat(rule).containsEntry("brand", "New Balance").doesNotContainKey("color");
        assertThat(map(map(d.get("design")).get("element"))).containsEntry("id", "HANGER").containsEntry("text", "NB");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object o) {
        return (Map<String, Object>) o;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object o) {
        return (List<Object>) o;
    }
}
