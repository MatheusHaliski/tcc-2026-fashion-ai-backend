package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import org.mockito.Mockito;
import org.mockito.invocation.Invocation;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Retrato textual das respostas do MomentService (caracterização do R81): mapas com chaves ordenadas, listas na ordem
 * devolvida, UUIDs trocados por fichas estáveis (#1, #2… na ordem em que aparecem) e erros pelo código e status.
 */
final class MomentRetrato {
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private final StringBuilder out = new StringBuilder();
    private final Map<String, String> tokens = new LinkedHashMap<>();

    /** Grava uma linha "nome = valor" com o resultado da chamada (ou o erro de API que ela lançou). */
    void step(String name, Supplier<Object> call) {
        Object value;
        try {
            value = call.get();
        } catch (ApiException e) {
            value = "ApiException(" + e.code() + "," + e.status() + ")";
        }
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
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> sorted = new TreeMap<>();
            m.forEach((k, x) -> sorted.put(String.valueOf(k), x));
            StringBuilder b = new StringBuilder("{");
            sorted.forEach((k, x) -> b.append(k).append('=').append(render(x)).append(", "));
            return b.append('}').toString();
        }
        if (v instanceof Collection<?> c) {
            StringBuilder b = new StringBuilder("[");
            c.forEach(x -> b.append(render(x)).append(", "));
            return b.append(']').toString();
        }
        if (v instanceof Enum<?> e) {
            return e.name();
        }
        return tokenize(String.valueOf(v));
    }

    private String tokenize(String s) {
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
