package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.AuditableEntity;
import org.mockito.Mockito;
import org.mockito.invocation.Invocation;

import java.io.IOException;
import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Retrato textual dos serviços de identidade e conta (caracterização do R95). Mapas e conjuntos com ordem própria
 * (LinkedHashMap, listas) ficam na ordem — ela é contrato (detalhes de erro); os demais (Map.of, Set.of) são ordenados.
 * UUIDs viram fichas (#1, #2… na ordem em que aparecem); instantes, hashes/tokens hex, códigos de 6 dígitos e
 * milissegundos viram marcadores, para o retrato não mudar de uma execução para outra.
 */
final class IdentityRetrato {
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Pattern INSTANT_RE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T[0-9:.]+Z");
    private static final Pattern HEX_RE = Pattern.compile("\\b[0-9a-f]{64}\\b");
    private static final Pattern MILLIS_RE = Pattern.compile("\\b\\d{13}\\b");
    private static final Pattern CODE_RE = Pattern.compile("\\b\\d{6}\\b");
    private final StringBuilder out = new StringBuilder();
    private final Map<String, String> tokens = new LinkedHashMap<>();
    /** Falso quando o tamanho dos bytes depende de instantes (pacote JSON da exportação): vira "<n>". */
    boolean sizes = true;

    /** Grava "nome = valor" com o resultado da chamada (ou o erro de API: código, status, mensagem e detalhes). */
    void step(String name, Supplier<Object> call) {
        Object value;
        try {
            value = call.get();
        } catch (ApiException e) {
            value = "ApiException(" + e.code() + "," + e.status() + "," + e.getMessage() + "," + render(e.details()) + ")";
        }
        line(name, value);
    }

    void run(String name, Runnable call) {
        step(name, () -> {
            call.run();
            return "ok";
        });
    }

    void line(String name, Object value) {
        out.append(name).append(" = ").append(render(value)).append('\n');
    }

    /** Chamadas registradas num mock (método e argumentos), na ordem; zera o registro depois. */
    void calls(String name, Object mock) {
        Collection<Invocation> all = Mockito.mockingDetails(mock).getInvocations();
        StringBuilder b = new StringBuilder();
        for (Invocation i : all) {
            b.append(i.getMethod().getName()).append(render(Arrays.asList(i.getArguments()))).append("; ");
        }
        out.append(name).append(" = ").append(b).append('\n');
        Mockito.clearInvocations(mock);
    }

    String render(Object v) {
        if (v == null) {
            return "null";
        }
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> view = m instanceof LinkedHashMap<?, ?> || m instanceof SortedMap<?, ?>
                    ? new LinkedHashMap<>() : new TreeMap<>();
            m.forEach((k, x) -> view.put(render(k), x));
            StringBuilder b = new StringBuilder("{");
            view.forEach((k, x) -> b.append(k).append('=').append(!sizes && "bytes".equals(k) ? "<n>" : render(x)).append(", "));
            return b.append('}').toString();
        }
        if (v instanceof Collection<?> c) {
            List<String> parts = c.stream().map(this::render).toList();
            if (!(c instanceof List<?>) && !(c instanceof LinkedHashSet<?>)) {
                parts = parts.stream().sorted().toList();
            }
            return parts.toString();
        }
        if (v instanceof byte[] bytes) {
            return sizes ? "bytes[" + bytes.length + "]" : "bytes[<n>]";
        }
        if (v instanceof Object[] arr) {
            return render(Arrays.asList(arr));
        }
        if (v.getClass().isRecord()) {
            StringBuilder b = new StringBuilder(v.getClass().getSimpleName()).append('{');
            for (RecordComponent rc : v.getClass().getRecordComponents()) {
                try {
                    b.append(rc.getName()).append('=').append(render(rc.getAccessor().invoke(v))).append(", ");
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
            }
            return b.append('}').toString();
        }
        if (v instanceof AuditableEntity entity) {
            return entity.getClass().getSimpleName() + "(" + render(entity.getId()) + ")";
        }
        if (v instanceof Enum<?> e) {
            return e.name();
        }
        return tokenize(String.valueOf(v));
    }

    private String tokenize(String raw) {
        String s = INSTANT_RE.matcher(raw).replaceAll("<t>");
        s = HEX_RE.matcher(s).replaceAll("<hex>");
        s = MILLIS_RE.matcher(s).replaceAll("<ms>");
        s = CODE_RE.matcher(s).replaceAll("<code>");
        Matcher m = UUID_RE.matcher(s);
        StringBuilder b = new StringBuilder();
        while (m.find()) {
            String t = tokens.computeIfAbsent(m.group(), k -> "#" + (tokens.size() + 1));
            m.appendReplacement(b, Matcher.quoteReplacement(t));
        }
        m.appendTail(b);
        return b.toString();
    }

    String text() {
        return out.toString();
    }

    /** Lê o retrato versionado; com -Dretrato.gravar=true antes grava o texto atual (só no código original). */
    static String golden(String text, Path file) throws IOException {
        if (Boolean.getBoolean("retrato.gravar")) {
            Files.createDirectories(file.getParent());
            Files.writeString(file, text, StandardCharsets.UTF_8);
        }
        return Files.readString(file, StandardCharsets.UTF_8);
    }
}
