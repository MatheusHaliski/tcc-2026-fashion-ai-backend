package br.com.fashionai.application.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Texto canônico do Inventory Score: chaves de mapa e conjuntos ordenados; ids fixos ({@code UUID(0xB00, n)}) viram
 * {@code #n}, os gerados na hora viram marcadores na ordem em que aparecem; datas e instantes viram distâncias em dias
 * até hoje (o cenário é relativo ao dia da execução), e instantes dos últimos minutos viram {@code <agora>}.
 */
final class InventoryScorePortrait {
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private final StringBuilder out = new StringBuilder();
    private final Map<String, String> tokens = new LinkedHashMap<>();
    private final LocalDate today = LocalDate.now(FaiPointsService.ZONE);
    private final boolean relative;

    /** @param relative datas relativas a hoje (cenário móvel) ou absolutas (cenário com datas fixas). */
    InventoryScorePortrait(boolean relative) {
        this.relative = relative;
    }

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
            out.append('[');
            if (c instanceof List<?>) {
                c.forEach(x -> {
                    write(x);
                    out.append(", ");
                });
            } else {
                c.stream().map(this::render).sorted().forEach(x -> out.append(x).append(", "));
            }
            out.append(']');
        } else if (v instanceof java.util.Optional<?> o) {
            out.append("Optional");
            write(o.map(List::of).orElse(List.of()));
        } else if (v instanceof LocalDate d) {
            out.append(relative ? "D" + ChronoUnit.DAYS.between(today, d) : d.toString());
        } else if (v instanceof Instant t) {
            out.append(instant(t));
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

    /** Um item de conjunto escrito à parte, para ordenar pelo texto canônico. */
    private String render(Object x) {
        int start = out.length();
        write(x);
        String piece = out.substring(start);
        out.setLength(start);
        return piece;
    }

    private String instant(Instant t) {
        if (Duration.between(t, Instant.now()).abs().toMinutes() < 10) {
            return "<agora>";
        }
        if (!relative) {
            return t.toString();
        }
        ZonedDateTime z = t.atZone(FaiPointsService.ZONE);
        return "D" + ChronoUnit.DAYS.between(today, z.toLocalDate()) + "@" + z.toLocalTime();
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
        try (InputStream in = InventoryScorePortrait.class.getResourceAsStream(golden)) {
            if (in == null) {
                Path target = Path.of("target", Path.of(golden).getFileName().toString());
                Files.writeString(target, actual, StandardCharsets.UTF_8);
                throw new AssertionError("retrato gravado em " + target.toAbsolutePath() + "; copie para src/test/resources" + golden);
            }
            Files.writeString(Path.of("target", Path.of(golden).getFileName() + ".atual"), actual, StandardCharsets.UTF_8);
            assertThat(actual).isEqualTo(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
