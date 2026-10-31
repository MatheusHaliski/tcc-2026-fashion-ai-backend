package br.com.fashionai.web.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do contrato HTTP das rotas agrupadas pela {@code @Tag} dos controllers FlairModes, Hype, Lookbook,
 * Seal e Wardrobe (lote R60a). Dividir um controller em vários com a mesma {@code @Tag} não pode mudar verbo, caminho,
 * condições, status, resumo do OpenAPI, nome do método, parâmetros (anotações e tipos, com os campos dos corpos) nem o
 * tipo de retorno. O retrato aceito fica em {@code src/test/resources/contrato/rotas-por-tag-r60a.txt}; o atual é
 * gravado em {@code target/contrato-rotas-por-tag-r60a.txt} para comparação.
 */
class ContratoRotasPorTagTest {
    static final Set<String> TAGS = Set.of(
            "FLAIR — modos (Battle, Squad, League, World Tour, Conquest, Deck Battle e eventos especiais)",
            "HypeScore v2 — relevância de peças e looks ao longo do tempo",
            "RF6 — Lookbook, Look do Dia e HypeScore (painel em v2; agrupamentos por similaridade)",
            "RF20/RF21 — Selos, vínculos (SealBond) e promoções",
            "RF4/RF7/RF15/RF16 — Peças do guarda-roupa");

    static final String RETRATO = "/contrato/rotas-por-tag-r60a.txt";

    @Test
    void rotasDasTagsMantemOContratoHttp() throws Exception {
        List<String> atual = descreve();
        Path saida = Path.of("target", "contrato-rotas-por-tag-r60a.txt");
        Files.createDirectories(saida.getParent());
        Files.write(saida, atual, StandardCharsets.UTF_8);
        assertThat(atual).as("rotas encontradas").hasSizeGreaterThan(100);
        assertThat(atual).containsExactlyElementsOf(esperado());
    }

    static List<String> esperado() throws IOException {
        try (InputStream in = ContratoRotasPorTagTest.class.getResourceAsStream(RETRATO)) {
            assertThat(in).as("retrato " + RETRATO).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).lines().filter(l -> !l.isBlank()).toList();
        }
    }

    static List<String> descreve() throws ClassNotFoundException {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<String> out = new ArrayList<>();
        for (var candidate : scanner.findCandidateComponents("br.com.fashionai.web")) {
            Class<?> type = Class.forName(candidate.getBeanClassName());
            Tag tag = type.getAnnotation(Tag.class);
            if (tag == null || !TAGS.contains(tag.name())) {
                continue;
            }
            for (Method m : type.getDeclaredMethods()) {
                RequestMapping rm = AnnotatedElementUtils.findMergedAnnotation(m, RequestMapping.class);
                if (rm != null) {
                    out.add(rota(tag, m, rm));
                }
            }
        }
        out.sort(String::compareTo);
        return out;
    }

    static String rota(Tag tag, Method m, RequestMapping rm) {
        ResponseStatus status = m.getAnnotation(ResponseStatus.class);
        Operation op = m.getAnnotation(Operation.class);
        String verbos = Arrays.stream(rm.method()).map(Enum::name).sorted().collect(Collectors.joining(","));
        return verbos + " " + String.join(",", rm.path()) + " [consumes=" + String.join(",", rm.consumes())
                + " produces=" + String.join(",", rm.produces()) + " params=" + String.join(",", rm.params())
                + " headers=" + String.join(",", rm.headers()) + "] status=" + (status == null ? "-" : status.value())
                + " | tag=" + tag.name() + " | " + (op == null ? "-" : op.summary()) + " | " + m.getName()
                + Arrays.stream(m.getParameters()).map(ContratoRotasPorTagTest::parametro)
                .collect(Collectors.joining(", ", "(", ")")) + " -> " + m.getGenericReturnType().getTypeName();
    }

    static String parametro(Parameter p) {
        return anotacoes(p.getAnnotations()) + tipo(p.getParameterizedType()) + " " + p.getName();
    }

    /** Corpos declarados no pacote web viram nome simples + campos (o contrato JSON), não o nome da classe externa. */
    static String tipo(Type t) {
        if (t instanceof Class<?> c && c.isRecord() && c.getName().startsWith("br.com.fashionai.web.")) {
            return c.getSimpleName() + Arrays.stream(c.getRecordComponents()).map(ContratoRotasPorTagTest::campo)
                    .collect(Collectors.joining(", ", "{", "}"));
        }
        return t.getTypeName();
    }

    static String campo(RecordComponent rc) {
        String anotacoes = anotacoes(rc.getAnnotations()) + anotacoes(rc.getAccessor().getAnnotations())
                + anotacoes(rc.getAnnotatedType().getAnnotations());
        return anotacoes + rc.getGenericType().getTypeName() + " " + rc.getName();
    }

    static String anotacoes(Annotation[] as) {
        return Arrays.stream(as).map(Annotation::toString).sorted().map(a -> a + " ").collect(Collectors.joining());
    }
}
