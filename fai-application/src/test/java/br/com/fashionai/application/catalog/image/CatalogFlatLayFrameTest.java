package br.com.fashionai.application.catalog.image;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** Total frame com o flat lay aprovado da Fase 2 (V85): só a imagem certa, marcada como IA, e o recorte real como fallback. */
class CatalogFlatLayFrameTest {
    private static final String SOURCE = "https://loja.example/camiseta.jpg";
    private static final String SHA = "a".repeat(64);

    private static CatalogImage approved() {
        CatalogImage image = new CatalogImage();
        ReflectionTestUtils.setField(image, "id", UUID.randomUUID());   // o JPA gera no persist
        image.setImageUrl(SOURCE);
        image.setSourceSha256(SHA);
        image.setFlatLayUrl("https://media.example/catalog/flatlay/x/front.jpg");
        image.setFlatLayBackUrl("https://media.example/catalog/flatlay/x/back.jpg");
        image.setFlatLayStatus("APPROVED");
        image.setFlatLayJson(json(image, Map.of()));
        return image;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> whole(Map<String, Object> card) {
        return (Map<String, Object>) card.get("whole");
    }

    private static String json(CatalogImage image, Map<String, Object> changes) {
        Map<String, Object> info = new LinkedHashMap<>(Map.of("version", "FLAT_LAY_V1", "imageId", image.getId().toString(),
                "originalUrl", SOURCE, "sourceSha256", SHA, "aiGenerated", true, "background", "#FFFFFF"));
        info.putAll(changes);
        return Json.write(info);
    }

    @Test
    void flatLayAprovadoViraOTotalFrameMarcadoComoIa() {
        Map<String, Object> frame = CatalogFlatLayFrame.of(approved());
        assertThat(frame).isNotNull();
        assertThat(frame.get("url")).isEqualTo("https://media.example/catalog/flatlay/x/front.jpg");
        assertThat(frame.get("backUrl")).isEqualTo("https://media.example/catalog/flatlay/x/back.jpg");
        assertThat(frame).containsEntry("aiGenerated", true).containsEntry("rendered", true)
                .containsEntry("processed", true).containsEntry("version", "FLAT_LAY_V1");
        assertThat(frame.get("box")).isEqualTo(Map.of("x", 0.0, "y", 0.0, "w", 1.0, "h", 1.0));
    }

    @Test
    void semAprovacaoOuComFotoTrocadaVoltaAoRecorteReal() {
        CatalogImage pending = approved();
        pending.setFlatLayStatus("PENDING");
        assertThat(CatalogFlatLayFrame.of(pending)).isNull();

        CatalogImage swapped = approved();
        swapped.setImageUrl("https://loja.example/outra-foto.jpg");
        assertThat(CatalogFlatLayFrame.of(swapped)).isNull();

        CatalogImage reanalysed = approved();
        reanalysed.setSourceSha256("b".repeat(64));
        assertThat(CatalogFlatLayFrame.of(reanalysed)).isNull();

        CatalogImage otherRow = approved();
        otherRow.setFlatLayJson(json(otherRow, Map.of("imageId", UUID.randomUUID().toString())));
        assertThat(CatalogFlatLayFrame.of(otherRow)).isNull();
    }

    @Test
    void urlOuJsonInvalidosNaoChegamNaInterface() {
        CatalogImage badUrl = approved();
        badUrl.setFlatLayUrl("javascript:alert(1)");
        assertThat(CatalogFlatLayFrame.of(badUrl)).isNull();

        CatalogImage badJson = approved();
        badJson.setFlatLayJson("{não é json");
        assertThat(CatalogFlatLayFrame.of(badJson)).isNull();

        CatalogImage oldVersion = approved();
        oldVersion.setFlatLayJson(json(oldVersion, Map.of("version", "FLAT_LAY_V0")));
        assertThat(CatalogFlatLayFrame.of(oldVersion)).isNull();

        CatalogImage noBack = approved();
        noBack.setFlatLayBackUrl(null);
        assertThat(CatalogFlatLayFrame.of(noBack)).doesNotContainKey("backUrl");
    }

    @Test
    void cardComPhotoSetDefaultGanhaOFlatLayNoTotalFrameSemMudarOTecido() {
        // o caso do app em 03/11: produto com photo set DEFAULT mostrava o asset padrão também no Total frame
        Map<String, Object> card = new LinkedHashMap<>(Map.of("url", "https://media.example/default/blusa.png", "mode", "DEFAULT",
                "defaultAssetUrl", "https://media.example/default/blusa.png"));
        Map<String, Object> shown = CatalogFlatLayFrame.onCard(approved(), card);
        assertThat(shown).containsEntry("mode", "DEFAULT").containsEntry("url", "https://media.example/default/blusa.png");
        assertThat(whole(shown)).containsEntry("aiGenerated", true).containsEntry("version", "FLAT_LAY_V1");
        assertThat(card).doesNotContainKey("whole");   // não altera o mapa de quem chamou

        Map<String, Object> realWhole = new LinkedHashMap<>(Map.of("mode", "PROCESSED", "whole", Map.of("version", "WHOLE_FRAME_V3")));
        assertThat(whole(CatalogFlatLayFrame.onCard(approved(), realWhole))).containsEntry("version", "FLAT_LAY_V1");
    }

    @Test
    void semCardAprovadoOFlatLayAindaApareceNoTotalFrame() {
        CatalogImage image = approved();
        Map<String, Object> shown = CatalogFlatLayFrame.onCard(image, null);
        assertThat(shown).containsEntry("mode", "DEFAULT").containsEntry("sourceUrl", SOURCE).containsEntry("imageId", image.getId());
        assertThat(whole(shown)).containsEntry("url", "https://media.example/catalog/flatlay/x/front.jpg");
    }

    @Test
    void semFlatLayValidoOCardContinuaComoVeio() {
        Map<String, Object> card = Map.of("url", "https://media.example/catalog/framed/y.jpg", "mode", "PROCESSED");
        CatalogImage none = new CatalogImage();
        ReflectionTestUtils.setField(none, "id", UUID.randomUUID());
        assertThat(CatalogFlatLayFrame.onCard(none, card)).isSameAs(card);
        assertThat(CatalogFlatLayFrame.onCard(none, null)).isNull();
        assertThat(CatalogImagePipelineService.wholeFrame(approved())).isNull();   // o recorte real não vira flat lay
    }
}
