package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ports.GeocodingPort;
import br.com.fashionai.application.ports.WeatherPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Clima para o Autopiloto (HU17) e o Copilot (RF10): Open-Meteo (não é IA, sem chave), cache de 30 min por local
 * e mapeamento temperatura → categoria de vestuário (autopiloto-architecture.md §4). Sem local, devolve vazio e o
 * chamador informa que o clima não foi considerado (HU17 C3).
 */
@Service
public class WeatherService {
    static final Duration TTL = Duration.ofMinutes(30);

    public record Context(Double temperatureC, String description, String city, String band, String season, String note, boolean available) {
        public static Context none(String reason) {
            return new Context(null, null, null, null, null, reason, false);
        }
    }

    private record Cached(Context ctx, Instant at) {
    }

    private final ObjectProvider<WeatherPort> weather;
    private final ObjectProvider<GeocodingPort> geocoding;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public WeatherService(ObjectProvider<WeatherPort> weather, ObjectProvider<GeocodingPort> geocoding) {
        this.weather = weather;
        this.geocoding = geocoding;
    }

    /** ≥ 28 verão/leve · 18–27 primavera/outono · 10–17 outono/camadas · < 10 inverno/pesado. */
    public static String band(double t) {
        return t >= 28 ? "VERAO_LEVE" : t >= 18 ? "MEIA_ESTACAO" : t >= 10 ? "CAMADAS" : "INVERNO_PESADO";
    }

    public static String season(double t) {
        return t >= 28 ? "SUMMER" : t >= 18 ? "SPRING" : t >= 10 ? "AUTUMN" : "WINTER";
    }

    static final Set<String> HEAVY = Set.of("coat", "parka", "sweater", "hoodie", "long_boots", "cardigan", "sweatshirt");
    static final Set<String> LIGHT = Set.of("tank_top", "crop_top", "shorts", "bermuda_shorts", "denim_shorts", "sandals", "flip_flops", "skirt");
    static final Set<String> LAYERS = Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "sweater", "hoodie", "sweatshirt", "kimono", "vest");

    /** Peça climaticamente inadequada para a faixa (filtro antes de pontuar). */
    public static boolean unsuitable(String subcategory, String band) {
        if (subcategory == null || band == null) {
            return false;
        }
        return switch (band) {
            case "VERAO_LEVE" -> HEAVY.contains(subcategory);
            case "INVERNO_PESADO" -> LIGHT.contains(subcategory);
            default -> false;
        };
    }

    public static boolean isLayer(String subcategory) {
        return subcategory != null && LAYERS.contains(subcategory);
    }

    public Context resolve(Double latitude, Double longitude, String city) {
        String key;
        if (latitude != null && longitude != null) {
            key = String.format(Locale.ROOT, "%.2f,%.2f", latitude, longitude);
        } else if (city != null && !city.isBlank()) {
            key = "city:" + city.trim().toLowerCase(Locale.ROOT);
        } else {
            return Context.none(Msg.t("weather.localizacao_nao_informada_as_sugestoes"));
        }
        Cached c = cache.get(key);
        if (c != null && c.at().plus(TTL).isAfter(Instant.now())) {
            return c.ctx();
        }
        Double lat = latitude, lon = longitude;
        String name = city;
        if (lat == null || lon == null) {
            GeocodingPort geo = geocoding.getIfAvailable();
            Optional<GeocodingPort.Place> place = geo == null ? Optional.empty() : safe(() -> geo.geocode(city));
            if (place.isEmpty()) {
                return Context.none(Msg.t("weather.nao_encontramos_a_cidade_as", city));
            }
            lat = place.get().latitude();
            lon = place.get().longitude();
            name = place.get().name();
        }
        WeatherPort port = weather.getIfAvailable();
        final double fLat = lat, fLon = lon;
        Optional<WeatherPort.Weather> w = port == null ? Optional.empty() : safe(() -> port.current(fLat, fLon));
        if (w.isEmpty()) {
            return Context.none(Msg.t("weather.servico_de_clima_indisponivel_agora"));
        }
        double t = w.get().temperatureC();
        Context ctx = new Context(t, w.get().description(), name, band(t), season(t),
                LocalAdvisors.weatherNote(t, w.get().description()).orElse(null), true);
        cache.put(key, new Cached(ctx, Instant.now()));
        return ctx;
    }

    private static <T> Optional<T> safe(java.util.function.Supplier<Optional<T>> s) {
        try {
            return s.get();
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    public static Map<String, Object> view(Context c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("available", c.available());
        m.put("temperatureC", c.temperatureC());
        m.put("description", c.description());
        m.put("city", c.city());
        m.put("band", c.band());
        m.put("season", c.season());
        m.put("note", c.note());
        return m;
    }
}
