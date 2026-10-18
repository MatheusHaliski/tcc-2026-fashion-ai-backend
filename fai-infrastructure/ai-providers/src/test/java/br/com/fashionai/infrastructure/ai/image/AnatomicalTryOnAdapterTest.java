package br.com.fashionai.infrastructure.ai.image;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** Motivo da recusa vindo do worker: só um código curto em maiúsculas chega ao app; qualquer outra coisa é descartada. */
class AnatomicalTryOnAdapterTest {
    private static byte[] json(String s) { return s.getBytes(StandardCharsets.UTF_8); }

    @Test void shortUppercaseCodeIsForwardedAsReason() {
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("{\"code\":\"EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED\"}"))).isEqualTo("EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED");
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("{\"code\":\"VERTEX_PREDICTION_HTTP_422\"}"))).isEqualTo("VERTEX_PREDICTION_HTTP_422");
    }

    @Test void anythingElseIsDropped() {
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("{\"code\":\"data:image/png;base64,AAAA\"}"))).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("{\"code\":[\"X\"]}"))).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("not json"))).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(json("{\"code\":\"" + "A".repeat(5000) + "\"}"))).isNull();
        assertThat(AnatomicalTryOnAdapter.reasonOf(null)).isNull();
    }
}
