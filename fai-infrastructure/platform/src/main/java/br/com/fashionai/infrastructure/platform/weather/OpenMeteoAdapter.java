package br.com.fashionai.infrastructure.platform.weather;

import br.com.fashionai.application.ports.GeocodingPort;
import br.com.fashionai.application.ports.WeatherPort;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Clima e geocodificação pela Open-Meteo (gratuita, sem chave). Qualquer falha vira Optional.empty():
 * o Autopiloto continua sem a dimensão clima (RF10.CA03).
 */
@Component
@ConditionalOnProperty(name = "fashionai.weather.enabled", havingValue = "true", matchIfMissing = true)
public class OpenMeteoAdapter implements WeatherPort, GeocodingPort {
    private static final Logger log = LoggerFactory.getLogger(OpenMeteoAdapter.class);
    private final RestClient forecast = Http.client("https://api.open-meteo.com", 8);
    private final RestClient geocoding = Http.client("https://geocoding-api.open-meteo.com", 8);

    @Override
    @SuppressWarnings("unchecked")
    public Optional<Weather> current(double latitude, double longitude) {
        try {
            Map<String, Object> body = forecast.get()
                    .uri(u -> u.path("/v1/forecast").queryParam("latitude", latitude).queryParam("longitude", longitude)
                            .queryParam("current", "temperature_2m,weather_code").queryParam("timezone", "auto").build())
                    .retrieve().body(Map.class);
            Map<String, Object> current = body == null ? null : (Map<String, Object>) body.get("current");
            if (current == null || current.get("temperature_2m") == null) {
                return Optional.empty();
            }
            int code = current.get("weather_code") == null ? 0 : ((Number) current.get("weather_code")).intValue();
            return Optional.of(new Weather(((Number) current.get("temperature_2m")).doubleValue(), code, describe(code)));
        } catch (RuntimeException e) {
            log.warn("Open-Meteo indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<Place> geocode(String city) {
        if (city == null || city.isBlank()) {
            return Optional.empty();
        }
        try {
            Map<String, Object> body = geocoding.get()
                    .uri(u -> u.path("/v1/search").queryParam("name", city.trim()).queryParam("count", 1)
                            .queryParam("language", "pt").queryParam("format", "json").build())
                    .retrieve().body(Map.class);
            List<Map<String, Object>> results = body == null ? null : (List<Map<String, Object>>) body.get("results");
            if (results == null || results.isEmpty()) {
                return Optional.empty();
            }
            Map<String, Object> r = results.get(0);
            return Optional.of(new Place(String.valueOf(r.get("name")), String.valueOf(r.getOrDefault("country", "")),
                    ((Number) r.get("latitude")).doubleValue(), ((Number) r.get("longitude")).doubleValue()));
        } catch (RuntimeException e) {
            log.warn("Geocodificação indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** Códigos WMO usados pela Open-Meteo, em português. */
    static String describe(int code) {
        if (code == 0) return "céu limpo";
        if (code <= 2) return "poucas nuvens";
        if (code == 3) return "nublado";
        if (code <= 48) return "neblina";
        if (code <= 57) return "garoa";
        if (code <= 67) return "chuva";
        if (code <= 77) return "neve";
        if (code <= 82) return "pancadas de chuva";
        if (code <= 86) return "pancadas de neve";
        return "tempestade";
    }
}
