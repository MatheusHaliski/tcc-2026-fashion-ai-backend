package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WeatherRulesTest {
    @Test
    void temperatureBandsMatchRf10() {
        assertThat(WeatherService.band(31)).isEqualTo("VERAO_LEVE");
        assertThat(WeatherService.band(28)).isEqualTo("VERAO_LEVE");
        assertThat(WeatherService.band(27.9)).isEqualTo("MEIA_ESTACAO");
        assertThat(WeatherService.band(18)).isEqualTo("MEIA_ESTACAO");
        assertThat(WeatherService.band(17.5)).isEqualTo("CAMADAS");
        assertThat(WeatherService.band(9.9)).isEqualTo("INVERNO_PESADO");
    }

    @Test
    void seasonsFollowTheSameThresholds() {
        assertThat(WeatherService.season(30)).isEqualTo("SUMMER");
        assertThat(WeatherService.season(20)).isEqualTo("SPRING");
        assertThat(WeatherService.season(12)).isEqualTo("AUTUMN");
        assertThat(WeatherService.season(3)).isEqualTo("WINTER");
    }

    @Test
    void unsuitablePiecesAreFilteredOnlyAtTheExtremes() {
        assertThat(WeatherService.unsuitable("coat", "VERAO_LEVE")).isTrue();
        assertThat(WeatherService.unsuitable("tank_top", "INVERNO_PESADO")).isTrue();
        assertThat(WeatherService.unsuitable("coat", "MEIA_ESTACAO")).isFalse();
        assertThat(WeatherService.unsuitable("jeans", "VERAO_LEVE")).isFalse();
        assertThat(WeatherService.unsuitable(null, "VERAO_LEVE")).isFalse();
        assertThat(WeatherService.isLayer("blazer")).isTrue();
        assertThat(WeatherService.isLayer("t_shirt")).isFalse();
    }
}
