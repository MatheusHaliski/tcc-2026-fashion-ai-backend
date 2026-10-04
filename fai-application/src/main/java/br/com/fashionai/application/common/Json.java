package br.com.fashionai.application.common;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Utilitário JSON para as colunas JSON do MySQL (listas curtas, configs do Background Studio, métricas). */
public final class Json {
    /** Jackson 3: imutável (thread-safe por construção) e com java.time embutido; datas saem em ISO-8601. */
    public static final ObjectMapper MAPPER = JsonMapper.builder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)   // JSON já gravado com null lê como no Jackson 2
            .build();

    private Json() {
    }

    public static String write(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JacksonException ex) {
            throw new IllegalStateException("JSON inválido", ex);
        }
    }

    public static Map<String, Object> map(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (JacksonException ex) {
            return new LinkedHashMap<>();
        }
    }

    public static List<String> strings(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<ArrayList<String>>() {
            });
        } catch (JacksonException ex) {
            return new ArrayList<>();
        }
    }

    /** Lista de objetos (JSON de colunas como modules_json, slots_json). */
    public static List<Map<String, Object>> list(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<ArrayList<Map<String, Object>>>() {
            });
        } catch (JacksonException ex) {
            return new ArrayList<>();
        }
    }

    public static List<UUID> uuids(String json) {
        return strings(json).stream().map(UUID::fromString).collect(Collectors.toCollection(ArrayList::new));
    }

    public static List<Double> doubles(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<ArrayList<Double>>() {
            });
        } catch (JacksonException ex) {
            return new ArrayList<>();
        }
    }

    public static <T> T read(String json, Class<T> type) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, type);
        } catch (JacksonException ex) {
            return null;
        }
    }

    /** CSV curto (occasion/style/tags) → lista limpa. */
    public static List<String> csv(String csv) {
        if (csv == null || csv.isBlank()) {
            return new ArrayList<>();
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(ArrayList::new));
    }

    public static String csv(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        return values.stream().map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.joining(","));
    }
}
