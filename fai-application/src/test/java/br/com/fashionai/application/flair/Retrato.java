package br.com.fashionai.application.flair;

import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.SortedSet;
import java.util.TreeMap;

/**
 * Retrato canônico de saídas dos motores puros do FLAIR para testes de caracterização. Mapas e conjuntos com ordem
 * definida ({@code LinkedHashMap}, {@code LinkedHashSet}, ordenados) mantêm a ordem; os demais ({@code Map.of},
 * {@code Set.of}, {@code HashMap}) saem com as chaves ordenadas, porque {@code Map.of}/{@code Set.of} mudam a ordem de
 * iteração a cada JVM. Records saem pelos componentes, na ordem da declaração.
 */
public final class Retrato {
    private Retrato() {
    }

    public static String of(Object o) {
        StringBuilder b = new StringBuilder();
        write(o, b);
        return b.toString();
    }

    /** Digest do retrato; o texto também vai para {@code target/retrato/<nome>.txt}, para comparar com {@code diff}. */
    public static String sha(String name, Object o) {
        String text = of(o);
        try {
            java.nio.file.Path dir = java.nio.file.Path.of("target", "retrato");
            java.nio.file.Files.createDirectories(dir);
            java.nio.file.Files.writeString(dir.resolve(name + ".txt"), text.replace(";", ";\n"));
            byte[] d = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void write(Object o, StringBuilder b) {
        if (o == null) {
            b.append("null");
        } else if (o instanceof Map<?, ?> m) {
            Map<String, Object> view = new LinkedHashMap<>();
            if (m instanceof LinkedHashMap<?, ?> || m instanceof SortedMap<?, ?>) {
                m.forEach((k, v) -> view.put(String.valueOf(k), v));
            } else {
                Map<String, Object> sorted = new TreeMap<>();
                m.forEach((k, v) -> sorted.put(String.valueOf(k), v));
                view.putAll(sorted);
            }
            b.append('{');
            view.forEach((k, v) -> {
                b.append(k).append('=');
                write(v, b);
                b.append(';');
            });
            b.append('}');
        } else if (o instanceof Collection<?> c) {
            List<String> parts = new ArrayList<>();
            c.forEach(x -> parts.add(of(x)));
            boolean ordered = c instanceof List<?> || c instanceof LinkedHashSet<?> || c instanceof SortedSet<?>;
            if (!ordered) {
                parts.sort(null);
            }
            b.append(ordered ? '[' : '<').append(String.join(",", parts)).append(ordered ? ']' : '>');
        } else if (o instanceof Object[] arr) {
            write(java.util.Arrays.asList(arr), b);
        } else if (o.getClass().isRecord()) {
            b.append(o.getClass().getSimpleName()).append('(');
            for (RecordComponent rc : o.getClass().getRecordComponents()) {
                try {
                    b.append(rc.getName()).append('=');
                    java.lang.reflect.Method accessor = rc.getAccessor();
                    accessor.setAccessible(true);
                    write(accessor.invoke(o), b);
                    b.append(';');
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
            }
            b.append(')');
        } else {
            b.append(o.getClass().getSimpleName()).append(':').append(o);
        }
    }
}
