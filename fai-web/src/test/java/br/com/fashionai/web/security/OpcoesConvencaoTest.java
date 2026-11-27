package br.com.fashionai.web.security;

import br.com.fashionai.application.security.CurrentUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET /api/opcoes/**} é público por convenção (SecurityConfig.PUBLIC_GET): ali só cabem catálogos iguais para
 * todo mundo. Nenhum GET nesse caminho pode receber a identidade de quem chama — dado do usuário vai para outra rota,
 * que continua exigindo sessão.
 */
class OpcoesConvencaoTest {
    private static final String CONVENCAO = "/api/opcoes/";
    private static final Set<Class<?>> IDENTIDADE = Set.of(CurrentUser.class, Principal.class, Authentication.class, Jwt.class);

    @Test
    void readsUnderTheOptionsConventionCarryNoUserIdentity() throws Exception {
        List<String> rotas = new ArrayList<>();
        List<String> problemas = new ArrayList<>();
        for (Class<?> controller : controllers()) {
            List<String> prefixos = caminhos(AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class));
            for (Method method : controller.getDeclaredMethods()) {
                RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null || !aceitaGet(mapping)) {
                    continue;
                }
                for (String prefixo : prefixos) {
                    for (String caminho : caminhos(mapping)) {
                        String rota = prefixo + caminho;
                        if (!rota.startsWith(CONVENCAO)) {
                            continue;
                        }
                        rotas.add(rota);
                        Arrays.stream(method.getParameterTypes())
                                .filter(tipo -> IDENTIDADE.stream().anyMatch(id -> id.isAssignableFrom(tipo)))
                                .forEach(tipo -> problemas.add(controller.getSimpleName() + "." + method.getName() + " (" + rota
                                        + ") recebe " + tipo.getSimpleName() + ": mova a rota para fora de " + CONVENCAO));
                    }
                }
            }
        }
        assertThat(rotas).contains("/api/opcoes/estados-conservacao", "/api/opcoes/marcas-politica", "/api/opcoes/canais-cupom");
        assertThat(problemas).isEmpty();
    }

    private static boolean aceitaGet(RequestMapping mapping) {
        return mapping.method().length == 0 || Arrays.asList(mapping.method()).contains(RequestMethod.GET);
    }

    private static List<String> caminhos(RequestMapping mapping) {
        if (mapping == null || mapping.path().length == 0) {
            return List.of("");
        }
        return List.of(mapping.path());
    }

    private static List<Class<?>> controllers() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<Class<?>> controllers = new ArrayList<>();
        for (BeanDefinition definition : scanner.findCandidateComponents("br.com.fashionai.web")) {
            controllers.add(Class.forName(definition.getBeanClassName(), false, OpcoesConvencaoTest.class.getClassLoader()));
        }
        assertThat(controllers).hasSizeGreaterThan(20);
        return controllers;
    }
}
