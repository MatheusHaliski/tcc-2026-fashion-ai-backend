package br.com.fashionai.bootstrap;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.ClassUtils;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O Spring Boot ignora em silêncio um {@code spring.autoconfigure.exclude} que aponta para classe inexistente — e o
 * Boot 4 renomeou todas as autoconfigurações (pacotes por módulo). Sem este teste, uma atualização do Boot faria o
 * Cassandra voltar a ser ligado sem o perfil "cassandra" e ninguém notaria até a API tentar conectar em produção.
 */
class AutoConfigurationExclusionsTest {

    @Test
    void cadaExclusaoDoApplicationYmlEUmaAutoconfiguracaoQueExiste() throws Exception {
        PropertySource<?> yml = new YamlPropertySourceLoader().load("application.yml", new ClassPathResource("application.yml")).get(0);
        List<String> excluded = new ArrayList<>();
        for (int i = 0; yml.getProperty("spring.autoconfigure.exclude[" + i + "]") != null; i++) {
            excluded.add(String.valueOf(yml.getProperty("spring.autoconfigure.exclude[" + i + "]")));
        }
        assertThat(excluded).as("exclusões do Cassandra no documento padrão").hasSize(5);
        ClassLoader cl = getClass().getClassLoader();
        for (String name : excluded) {
            assertThat(ClassUtils.isPresent(name, cl)).as("classe existe: %s", name).isTrue();
            assertThat(ClassUtils.forName(name, cl).isAnnotationPresent(AutoConfiguration.class))
                    .as("é @AutoConfiguration: %s", name).isTrue();
        }
    }
}
