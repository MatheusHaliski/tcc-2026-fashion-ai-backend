package br.com.fashionai.application.common;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class JsonAndErrorsTest {
    @Test
    void csvRoundTrip() {
        assertThat(Json.csv(List.of("classic", "minimalist"))).isEqualTo("classic,minimalist");
        assertThat(Json.csv("classic, minimalist,,")).containsExactly("classic", "minimalist");
        assertThat(Json.csv((String) null)).isEmpty();
    }

    @Test
    void jsonHelpersTolerateNullAndRoundTrip() {
        String json = Json.write(Map.of("a", 1, "b", List.of("x")));
        assertThat(Json.map(json)).containsEntry("a", 1);
        assertThat(Json.map(null)).isEmpty();
        assertThat(Json.list("[{\"k\":\"v\"}]")).hasSize(1).first().satisfies(m -> assertThat(m).containsEntry("k", "v"));
        assertThat(Json.strings("[\"a\",\"b\"]")).containsExactly("a", "b");
    }

    @Test
    void apiExceptionFactoriesCarryStableCodes() {
        assertThat(ApiException.notFound("Peça").status()).isEqualTo(404);
        assertThat(ApiException.notFound("Peça").code()).isEqualTo("NAO_ENCONTRADO");
        assertThat(ApiException.forbidden("x").status()).isEqualTo(403);
        assertThat(ApiException.unauthorized("x").code()).isEqualTo("NAO_AUTENTICADO");
        assertThat(ApiException.conflict("PECA_INDISPONIVEL", "x").status()).isEqualTo(409);
        assertThat(ApiException.tooMany("x", Map.of("limit", 50)).status()).isEqualTo(429);
        assertThat(new ApiException(400, "X", "m", null).details()).isEmpty();
    }
}
