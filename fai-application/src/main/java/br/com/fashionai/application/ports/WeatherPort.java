package br.com.fashionai.application.ports;

import java.util.Optional;

/** Open-Meteo (sem chave) — clima para o Copilot (RF10). Não é IA. */
public interface WeatherPort {
    Optional<Weather> current(double latitude, double longitude);

    record Weather(double temperatureC, int weatherCode, String description) {
    }
}
