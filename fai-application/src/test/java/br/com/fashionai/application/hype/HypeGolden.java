package br.com.fashionai.application.hype;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Retrato textual (caracterização) das saídas do HypeScore: mapas com ordem de inserção mantêm a ordem (é contrato do
 * JSON), mapas sem ordem são ordenados pela chave; números saem com {@link Double#toString} (equivalência exata).
 * Para regravar um retrato: {@code -Dhype.golden.write=true}.
 */
final class HypeGolden {
    private static final Path DIR = Path.of("src/test/resources/hype/golden");

    private HypeGolden() {
    }

    static String canonical(Object v) {
        StringBuilder sb = new StringBuilder();
        write(sb, v, 0);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object v, int depth) {
        if (v instanceof Map<?, ?> m) {
            Map<?, ?> ordered = m instanceof LinkedHashMap<?, ?> || m instanceof SortedMap<?, ?> || m instanceof EnumMap<?, ?> ? m : sorted(m);
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : ordered.entrySet()) {
                sb.append(first ? "" : ",").append('\n').append("  ".repeat(depth + 1)).append(e.getKey()).append('=');
                write(sb, e.getValue(), depth + 1);
                first = false;
            }
            sb.append('}');
        } else if (v instanceof Collection<?> c) {
            sb.append('[');
            boolean first = true;
            for (Object x : c) {
                sb.append(first ? "" : ", ");
                write(sb, x, depth + 1);
                first = false;
            }
            sb.append(']');
        } else if (v instanceof double[] a) {
            sb.append(java.util.Arrays.toString(a));
        } else if (v instanceof int[] a) {
            sb.append(java.util.Arrays.toString(a));
        } else if (v instanceof BigDecimal b) {
            sb.append(b.toPlainString());
        } else if (v instanceof Float || v instanceof Double) {
            sb.append(Double.toString(((Number) v).doubleValue()));
        } else if (v != null && v.getClass().isRecord() && idOf(v) != null) {
            sb.append(v.getClass().getSimpleName()).append('#').append(idOf(v));   // view montada por outro serviço: só a identidade
        } else {
            sb.append(v);
        }
    }

    private static Object idOf(Object rec) {
        for (java.lang.reflect.RecordComponent c : rec.getClass().getRecordComponents()) {
            if (c.getName().equals("id")) {
                try {
                    return c.getAccessor().invoke(rec);
                } catch (ReflectiveOperationException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private static Map<String, Object> sorted(Map<?, ?> m) {
        Map<String, Object> out = new TreeMap<>();
        m.forEach((k, x) -> out.put(String.valueOf(k), x));
        return out;
    }

    /** Compara com o retrato gravado (gerado no código original, antes da extração). */
    static void assertMatches(String name, String actual) throws IOException {
        Path file = DIR.resolve(name + ".txt");
        if (Boolean.getBoolean("hype.golden.write") || !Files.exists(file)) {
            Files.createDirectories(DIR);
            Files.writeString(file, actual, StandardCharsets.UTF_8);
        }
        assertThat(actual).isEqualTo(Files.readString(file, StandardCharsets.UTF_8));
    }
}
