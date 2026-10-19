package br.com.fashionai.web.controller;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Duas rotas com o mesmo método, caminho e condições derrubam a API na subida ("Ambiguous mapping"), e os testes de
 * fatia por controller não carregam o contexto inteiro para perceber. Aconteceu com POST /api/try-on/person-photos
 * declarado em dois controllers: o CI passou e o deploy do Railway falhou.
 */
class ControllerMappingUniquenessTest {

    @Test
    void nenhumaRotaHttpEhDeclaradaDuasVezes() throws Exception {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        Map<String, List<String>> owners = new HashMap<>();
        int controllers = 0;
        for (var candidate : scanner.findCandidateComponents("br.com.fashionai.web")) {
            Class<?> type = Class.forName(candidate.getBeanClassName());
            controllers++;
            RequestMapping base = AnnotatedElementUtils.findMergedAnnotation(type, RequestMapping.class);
            String[] prefixes = base == null || base.path().length == 0 ? new String[]{""} : base.path();
            for (Method method : type.getDeclaredMethods()) {
                RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) {
                    continue;
                }
                String[] paths = mapping.path().length == 0 ? new String[]{""} : mapping.path();
                String verbs = mapping.method().length == 0 ? "*" : Arrays.stream(mapping.method()).map(Enum::name).sorted()
                        .collect(Collectors.joining(","));
                String conditions = String.join("|", sorted(mapping.consumes()), sorted(mapping.produces()),
                        sorted(mapping.params()), sorted(mapping.headers()));
                for (String prefix : prefixes) {
                    for (String path : paths) {
                        String key = verbs + " " + normalize(prefix + "/" + path) + " [" + conditions + "]";
                        owners.computeIfAbsent(key, k -> new ArrayList<>()).add(type.getSimpleName() + "." + method.getName());
                    }
                }
            }
        }
        assertThat(controllers).as("controllers encontrados no classpath").isGreaterThan(50);
        Map<String, List<String>> duplicated = owners.entrySet().stream().filter(e -> e.getValue().size() > 1)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        assertThat(duplicated).as("rotas declaradas mais de uma vez").isEmpty();
    }

    private static String sorted(String[] values) {
        return Arrays.stream(values).sorted().collect(Collectors.joining(","));
    }

    private static String normalize(String path) {
        String clean = path.replaceAll("/+", "/");
        return clean.length() > 1 && clean.endsWith("/") ? clean.substring(0, clean.length() - 1) : clean;
    }
}
