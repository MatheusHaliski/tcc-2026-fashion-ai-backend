package br.com.fashionai.application.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** Texto canônico: chaves de mapa ordenadas; conjuntos ordenados; ids gerados na hora e instantes recentes viram marcadores. */
final class RoomPortrait {
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private final StringBuilder out = new StringBuilder();
    private final Map<String, String> tokens = new LinkedHashMap<>();

    void add(String label, Object value) {
        out.append(label).append(" = ");
        write(value);
        out.append('\n');
    }

    private void write(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> ordered = new TreeMap<>();
            m.forEach((k, x) -> ordered.put(text(String.valueOf(k)), x));
            out.append('{');
            ordered.forEach((k, x) -> {
                out.append(k).append(": ");
                write(x);
                out.append(", ");
            });
            out.append('}');
        } else if (v instanceof Collection<?> c) {
            Collection<?> items = c instanceof List<?> ? c : c.stream().map(x -> text(String.valueOf(x))).sorted().toList();
            out.append('[');
            items.forEach(x -> {
                write(x);
                out.append(", ");
            });
            out.append(']');
        } else if (v instanceof java.util.Optional<?> o) {
            out.append("Optional");
            write(o.map(List::of).orElse(List.of()));
        } else if (v instanceof Instant t) {
            out.append(t.isBefore(Instant.parse("2026-01-01T00:00:00Z")) ? t.toString() : "<agora>");
        } else if (v instanceof Record r) {
            Map<String, Object> fields = new LinkedHashMap<>();
            for (var c : r.getClass().getRecordComponents()) {
                try {
                    fields.put(c.getName(), c.getAccessor().invoke(r));
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
            }
            out.append(r.getClass().getSimpleName());
            write(fields);
        } else {
            out.append(text(String.valueOf(v)));
        }
    }

    private String text(String s) {
        Matcher u = UUID_RE.matcher(s);
        StringBuilder b = new StringBuilder();
        while (u.find()) {
            String id = u.group();
            String rep = id.startsWith("00000000-0000-0b00-") ? "#" + Long.parseLong(id.substring(24), 16)
                    : tokens.computeIfAbsent(id, k -> "<id" + (tokens.size() + 1) + ">");
            u.appendReplacement(b, Matcher.quoteReplacement(rep));
        }
        u.appendTail(b);
        return b.toString();
    }

    void verify(String golden) throws IOException {
        String actual = out.toString();
        try (InputStream in = RoomPortrait.class.getResourceAsStream(golden)) {
            if (in == null) {
                Path target = Path.of("target", "room-service-portrait.txt");
                Files.writeString(target, actual, StandardCharsets.UTF_8);
                throw new AssertionError("retrato gravado em " + target.toAbsolutePath() + "; copie para src/test/resources" + golden);
            }
            assertThat(actual).isEqualTo(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
