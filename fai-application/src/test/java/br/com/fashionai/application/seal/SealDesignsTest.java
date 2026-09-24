package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.service.BackgroundStudioService;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SealDesignsTest {
    @Test
    void normalizeFillsDefaultsAndUppercases() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("field", Map.of("pattern", "grade", "nodeColors", List.of("#ff0000", "nope")),
                "element", Map.of("id", "star", "text", "ab!")));
        assertThat(d).containsEntry("mode", "GENERATED");
        assertThat(section(d, "field")).containsEntry("pattern", "GRADE").containsEntry("nodeColors", List.of("#FF0000"));
        assertThat(section(d, "element")).containsEntry("id", "STAR").containsEntry("text", "AB");
        assertThat(section(d, "border")).containsEntry("material", "FOSCO");
    }

    @Test
    void textLongerThanThreeCharsIsRejected() {
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("element", Map.of("text", "ABCD"))))
                .isInstanceOf(ApiException.class).hasMessageContaining("desenho do selo");
    }

    @Test
    void unknownPatternMaterialOrColorPointsToTheField() {
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("field", Map.of("pattern", "XADREZ", "material", "PLASTICO"),
                "border", Map.of("color", "red"))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString())
                        .contains("field.pattern").contains("field.material").contains("border.color"));
    }

    @Test
    void uploadModeRequiresAnUploadedFile() {
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("mode", "UPLOAD"))).isInstanceOf(ApiException.class);
        assertThat(SealDesigns.normalize(Map.of("mode", "UPLOAD", "uploadUrl", "/media/users/x/seals/a.png"))).containsEntry("mode", "UPLOAD");
    }

    @Test
    void geometryKeepsThePlacementsProportionsInRange() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("center", Map.of("radius", 0.9), "border", Map.of("width", 0.5)));
        assertThat((double) section(d, "center").get("radius")).isEqualTo(0.6);
        assertThat((double) section(d, "border").get("width")).isEqualTo(0.12);
    }

    @Test
    void defaultDesignDiffersForPremiumAndTier() {
        assertThat(section(SealDesigns.defaultDesign(true, SealTier.LOOK), "border")).containsEntry("material", "HOLOGRAFICO");
        assertThat(section(SealDesigns.defaultDesign(false, SealTier.PECA), "element")).containsEntry("id", "HANGER");
        assertThat(SealDesigns.PATTERNS).hasSizeGreaterThanOrEqualTo(12);
        assertThat(SealDesigns.MATERIALS).hasSizeGreaterThanOrEqualTo(12);
    }

    @Test
    void everyAnatomyHasASealPlacement() {
        assertThat(BackgroundStudioService.SEAL_PLACEMENT.keySet()).containsExactlyElementsOf(BackgroundStudioService.ANATOMIES);
        assertThat(BackgroundStudioService.PIECE_SEAL_PLACEMENT.keySet()).containsExactlyElementsOf(BackgroundStudioService.PIECE_ANATOMIES);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(Map<String, Object> d, String key) {
        return (Map<String, Object>) d.get(key);
    }
}
