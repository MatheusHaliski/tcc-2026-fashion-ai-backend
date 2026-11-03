package br.com.fashionai.application.testkit;

import br.com.fashionai.application.common.ApiException;
import org.mockito.Mockito;
import org.mockito.invocation.Invocation;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Retrato canônico de saídas de serviço para testes de caracterização: chaves de mapa ordenadas, records por campo,
 * entidades como {@code Tipo#id}, bytes e imagens por SHA-256, ids gerados na hora e instantes "de agora" como
 * marcadores (na ordem em que aparecem). Ids fixos com o prefixo dado viram só os 12 últimos dígitos.
 */
public final class Portrait {
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Instant RECENT = Instant.parse("2026-01-01T00:00:00Z");
    private final StringBuilder out = new StringBuilder();
    private final Map<String, String> tokens = new LinkedHashMap<>();
    private final String fixedPrefix;

    public Portrait(String fixedPrefix) {
        this.fixedPrefix = fixedPrefix;
    }

    public void add(String label, Object value) {
        out.append(label).append(" = ");
        write(value);
        out.append('\n');
    }

    /** Resultado da chamada ou, se ela recusar com {@link ApiException}, o status, o código, a mensagem e os detalhes. */
    public static Object attempt(Supplier<?> call) {
        try {
            return call.get();
        } catch (ApiException ex) {
            return Map.of("status", ex.status(), "code", String.valueOf(ex.code()), "message", String.valueOf(ex.getMessage()),
                    "details", ex.details() == null ? Map.of() : ex.details());
        }
    }

    /** Todas as chamadas recebidas pelo mock, na ordem: método e argumentos. */
    public void invocations(String label, Object mock) {
        int i = 0;
        for (Invocation inv : Mockito.mockingDetails(mock).getInvocations()) {
            add(label + "." + (i++) + "." + inv.getMethod().getName(), java.util.Arrays.asList(inv.getArguments()));
        }
    }

    public static String sha(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** SHA-256 dos pixels ARGB (largura, altura e cada pixel), independente do codificador de imagem. */
    public static String pixels(BufferedImage img) {
        StringBuilder b = new StringBuilder(img.getWidth() + "x" + img.getHeight() + ":");
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                b.append(Integer.toHexString(img.getRGB(x, y))).append(',');
            }
        }
        return img.getWidth() + "x" + img.getHeight() + ":" + sha(b.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void write(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> ordered = new TreeMap<>();
            m.forEach((k, x) -> ordered.put(String.valueOf(k), x));
            out.append('{');
            ordered.forEach((k, x) -> {
                out.append(text(k)).append(": ");
                write(x);
                out.append(", ");
            });
            out.append('}');
        } else if (v instanceof Collection<?> c) {
            Collection<?> items = c instanceof List<?> ? c : c.stream().map(x -> String.valueOf((Object) x)).sorted().toList();
            out.append('[');
            items.forEach(x -> {
                write(x);
                out.append(", ");
            });
            out.append(']');
        } else if (v instanceof Object[] arr) {
            write(java.util.Arrays.asList(arr));
        } else if (v instanceof byte[] bytes) {
            out.append("bytes(").append(bytes.length).append(", ").append(sha(bytes)).append(')');
        } else if (v instanceof BufferedImage img) {
            out.append("image(").append(pixels(img)).append(')');
        } else if (v instanceof Optional<?> o) {
            out.append("Optional(");
            write(o.orElse(null));
            out.append(')');
        } else if (v instanceof Instant t) {
            out.append(t.isBefore(RECENT) ? t.toString() : "<agora>");
        } else if (v instanceof LocalDate d) {
            out.append(d.isBefore(LocalDate.of(2026, 1, 1)) ? d.toString() : "<hoje>");
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
        } else if (v != null && v.getClass().getName().startsWith("br.com.fashionai.domain.model.") && !(v instanceof Enum<?>)) {
            out.append(v.getClass().getSimpleName()).append('#').append(text(String.valueOf(entityId(v))));
        } else if (v != null && v.getClass().getName().contains("$MockitoMock$")) {
            out.append("<mock>");
        } else {
            out.append(text(String.valueOf(v)));
        }
    }

    private static Object entityId(Object entity) {
        try {
            Method m = entity.getClass().getMethod("getId");
            return m.invoke(entity);
        } catch (ReflectiveOperationException e) {
            return "?";
        }
    }

    private String text(String s) {
        Matcher u = UUID_RE.matcher(s);
        StringBuilder b = new StringBuilder();
        while (u.find()) {
            String id = u.group();
            String rep = id.startsWith(fixedPrefix) ? id.substring(24) : tokens.computeIfAbsent(id, k -> "<id" + (tokens.size() + 1) + ">");
            u.appendReplacement(b, Matcher.quoteReplacement(rep));
        }
        u.appendTail(b);
        return b.toString();
    }

    /** Compara com o retrato gravado; sem ele, grava em {@code target/} e falha pedindo a cópia para os recursos de teste. */
    public void verify(Class<?> anchor, String golden) throws IOException {
        String actual = out.toString();
        try (InputStream in = anchor.getResourceAsStream(golden)) {
            if (in == null) {
                Path target = Path.of("target", Path.of(golden).getFileName().toString());
                Files.writeString(target, actual, StandardCharsets.UTF_8);
                throw new AssertionError("retrato gravado em " + target.toAbsolutePath() + "; copie para src/test/resources" + golden);
            }
            assertThat(actual).isEqualTo(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
}
