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

    @Test
    void legacyDesignsWithoutKindAreCircular() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("mode", "GENERATED"));
        assertThat(d).containsEntry("kind", "CIRCULAR").containsEntry("template", null).doesNotContainKey("label");
    }

    @Test
    void fashionAiAndFolhaAreAlwaysATemplateOfTheirOwnGallery() {
        Map<String, Object> fai = SealDesigns.normalize(Map.of("kind", "fashionai", "mode", "GENERATED", "template", "fai/03"));
        assertThat(fai).containsEntry("kind", "FASHIONAI").containsEntry("mode", "TEMPLATE").containsEntry("template", "fai/03");
        // modelo de outro tipo ou inexistente aponta o campo
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "FASHIONAI", "template", "circular/01")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString()).contains("template"));
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/nao-existe")))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "OVAL"))).isInstanceOf(ApiException.class);
    }

    @Test
    void circularTemplateKeepsTheCentralElementAndKindComesFromTheTemplate() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("mode", "TEMPLATE", "template", "circular/02",
                "element", Map.of("id", "crown", "text", "nb")));
        assertThat(d).containsEntry("kind", "CIRCULAR").containsEntry("template", "circular/02");
        assertThat(section(d, "element")).containsEntry("id", "CROWN").containsEntry("text", "NB");
        // fora do modo TEMPLATE o modelo é descartado
        assertThat(SealDesigns.normalize(Map.of("kind", "CIRCULAR", "template", "circular/02"))).containsEntry("mode", "TEMPLATE");
        assertThat(SealDesigns.normalize(Map.of("kind", "CIRCULAR", "mode", "GENERATED", "template", "circular/02"))).containsEntry("template", null);
    }

    @Test
    void folhaTextsAreShortAndPlain() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/mat-04", "label", "  Zara   Azul ", "caption", "Coleção verão"));
        assertThat(d).containsEntry("label", "Zara Azul").containsEntry("caption", "Coleção verão");
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/mat-04", "label", "<script>alert(1)</script>")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString()).contains("label"));
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/mat-04", "caption", "x".repeat(41))))
                .isInstanceOf(ApiException.class);
        assertThat(SealDesigns.labelFrom("Selo <Zara> #1 da coleção de verão 2026")).hasSizeLessThanOrEqualTo(SealDesigns.LABEL_MAX).doesNotContain("<");
    }

    @Test
    void everyFolhaTextIsEditableWithinItsLimit() {
        Map<String, Object> d = SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/col-01",
                "texts", Map.of("series", "Série Verão · Nº 7", "subtitle", "Moda · Rua", "style", "São Paulo", "year", "2027", "emblem", "ZR", "hack", "x")));
        assertThat(section(d, "texts")).containsEntry("series", "Série Verão · Nº 7").containsEntry("style", "São Paulo")
                .containsEntry("year", "2027").containsEntry("emblem", "ZR").doesNotContainKey("hack");
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/col-01", "texts", Map.of("year", "1234567"))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString()).contains("texts.year"));
        // o circular não carrega textos de folha
        assertThat(SealDesigns.normalize(Map.of("kind", "CIRCULAR", "template", "circular/01", "texts", Map.of("year", "2027")))).doesNotContainKey("texts");
    }

    @Test
    void coreCanBeTheElementAnUploadedImageOrText() {
        assertThat(section(SealDesigns.normalize(Map.of("template", "circular/01")), "core")).containsEntry("mode", "ELEMENT");
        Map<String, Object> img = SealDesigns.normalize(Map.of("template", "circular/01",
                "core", Map.of("mode", "image", "imageUrl", "/media/users/u/seals/core-1.png", "text", "Verão", "textColor", "#ffffff", "zoom", 9)));
        assertThat(section(img, "core")).containsEntry("mode", "IMAGE").containsEntry("text", "Verão").containsEntry("textColor", "#FFFFFF").containsEntry("zoom", 3.0);
        assertThat(section(SealDesigns.normalize(Map.of("kind", "FOLHA", "template", "folha/fai-02", "core", Map.of("mode", "TEXT", "text", "ZARA"))), "core"))
                .containsEntry("mode", "TEXT");
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("template", "circular/01", "core", Map.of("mode", "IMAGE"))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString()).contains("core.imageUrl"));
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("template", "circular/01", "core", Map.of("mode", "IMAGE", "imageUrl", "javascript:alert(1)"))))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SealDesigns.normalize(Map.of("template", "circular/01", "core", Map.of("mode", "TEXT"))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.details().toString()).contains("core.text"));
        // padrão FashionAI é arte pronta: sem núcleo
        assertThat(SealDesigns.normalize(Map.of("kind", "FASHIONAI", "template", "fai/01"))).doesNotContainKey("core");
    }

    @Test
    void catalogListsTheThreeKindsAndTheirTemplates() {
        assertThat(SealDesigns.KINDS).containsExactly("CIRCULAR", "FOLHA", "FASHIONAI");
        @SuppressWarnings("unchecked")
        Map<String, java.util.Set<String>> t = (Map<String, java.util.Set<String>>) SealDesigns.catalog().get("templates");
        assertThat(t.get("fai")).hasSizeGreaterThanOrEqualTo(10).contains("fai/01");
        assertThat(t.get("circular")).hasSizeGreaterThanOrEqualTo(10).contains("circular/01");
        assertThat(t.get("folha")).contains("folha/fai-01", "folha/mat-12", "folha/col-01", "folha/cmat-05");
        assertThat(SealDesigns.nearestCircular("#2A5FA8")).startsWith("circular/");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(Map<String, Object> d, String key) {
        return (Map<String, Object>) d.get(key);
    }
}
