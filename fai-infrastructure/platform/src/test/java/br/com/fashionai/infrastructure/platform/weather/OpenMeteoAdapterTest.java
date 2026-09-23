package br.com.fashionai.infrastructure.platform.weather;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenMeteoAdapterTest {
    @Test
    void wmoCodesAreDescribedInPortuguese() {
        assertThat(OpenMeteoAdapter.describe(0)).isEqualTo("céu limpo");
        assertThat(OpenMeteoAdapter.describe(3)).isEqualTo("nublado");
        assertThat(OpenMeteoAdapter.describe(61)).isEqualTo("chuva");
        assertThat(OpenMeteoAdapter.describe(95)).isEqualTo("tempestade");
    }
}
