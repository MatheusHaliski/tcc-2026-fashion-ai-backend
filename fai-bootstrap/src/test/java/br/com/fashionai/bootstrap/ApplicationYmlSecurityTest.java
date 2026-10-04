package br.com.fashionai.bootstrap;

import br.com.fashionai.infrastructure.mysql.config.MysqlSslModeEnvironmentPostProcessor;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * application.yml sem padrões inseguros: senha do MySQL obrigatória (nada de "change-me"), TLS do MySQL pelo
 * sslMode (com a compatibilidade de MYSQL_USE_SSL), allowPublicKeyRetrieval só por opção, e as variáveis novas de
 * Redis (ACL), Cassandra (TLS), OpenSearch (TLS) e backup mapeadas.
 */
class ApplicationYmlSecurityTest {

    /** Ambiente só com o application.yml (documento padrão) e as variáveis dadas — nada do ambiente da máquina. */
    private static StandardEnvironment env(String... kv) throws Exception {
        Map<String, Object> vars = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            vars.put(kv[i], kv[i + 1]);
        }
        StandardEnvironment env = new StandardEnvironment();
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        env.getPropertySources().addFirst(new MapPropertySource("variaveis", vars));
        env.getPropertySources().addLast(new YamlPropertySourceLoader().load("application.yml", new ClassPathResource("application.yml")).get(0));
        new MysqlSslModeEnvironmentPostProcessor(Supplier::get).postProcessEnvironment(env, new SpringApplication());
        return env;
    }

    @Test
    void semSenhaPadraoNoArquivo() throws Exception {
        String yml = new String(new ClassPathResource("application.yml").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertThat(yml).doesNotContain("change-me").doesNotContain("useSSL").doesNotContain("allowPublicKeyRetrieval=true");
    }

    @Test
    void senhaDoMysqlEObrigatoria() throws Exception {
        assertThatThrownBy(() -> env().getProperty("spring.datasource.password"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("MYSQL_PASSWORD");
        assertThat(env("MYSQL_PASSWORD", "x").getProperty("spring.datasource.password")).isEqualTo("x");
    }

    @Test
    void tlsPreferidoPorPadraoESemRecuperacaoDaChavePublica() throws Exception {
        String url = env().getProperty("spring.datasource.url");
        assertThat(url).contains("sslMode=PREFERRED").contains("allowPublicKeyRetrieval=false");
    }

    @Test
    void sslModeExplicitoVence() throws Exception {
        assertThat(env("MYSQL_SSL_MODE", "VERIFY_CA", "MYSQL_USE_SSL", "false").getProperty("spring.datasource.url")).contains("sslMode=VERIFY_CA");
        assertThat(env("MYSQL_SSL_MODE", "REQUIRED", "MYSQL_USE_SSL", "true").getProperty("spring.datasource.url")).contains("sslMode=REQUIRED");
    }

    @Test
    void useSslLegadoTrueViraRequired() throws Exception {
        assertThat(env("MYSQL_USE_SSL", "true").getProperty("spring.datasource.url")).contains("sslMode=REQUIRED");
        // o backup usa o mesmo modo
        assertThat(env("MYSQL_USE_SSL", "true").getProperty("fashionai.backup.ssl-mode")).isEqualTo("REQUIRED");
    }

    @Test
    void useSslLegadoFalseNaoDesligaTls() throws Exception {
        // DISABLED sem allowPublicKeyRetrieval quebraria o caching_sha2_password: fica PREFERRED
        assertThat(env("MYSQL_USE_SSL", "false").getProperty("spring.datasource.url")).contains("sslMode=PREFERRED");
    }

    @Test
    void recuperacaoDaChavePublicaSoPorOpcao() throws Exception {
        assertThat(env("MYSQL_SSL_MODE", "DISABLED", "MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL", "true").getProperty("spring.datasource.url"))
                .contains("sslMode=DISABLED").contains("allowPublicKeyRetrieval=true");
    }

    @Test
    void backupUsaUsuarioProprioQuandoDefinido() throws Exception {
        StandardEnvironment e = env("MYSQL_USER", "fashionai_app", "MYSQL_PASSWORD", "app");
        assertThat(e.getProperty("fashionai.backup.user")).isEqualTo("fashionai_app");
        assertThat(e.getProperty("fashionai.backup.password")).isEqualTo("app");
        StandardEnvironment b = env("MYSQL_PASSWORD", "app", "MYSQL_BACKUP_USER", "fashionai_backup", "MYSQL_BACKUP_PASSWORD", "bk");
        assertThat(b.getProperty("fashionai.backup.user")).isEqualTo("fashionai_backup");
        assertThat(b.getProperty("fashionai.backup.password")).isEqualTo("bk");
        assertThat(b.getProperty("fashionai.backup.retention-count", Integer.class)).isEqualTo(14);
        assertThat(b.getProperty("fashionai.backup.cron")).isEqualTo("0 0 3 * * *");
    }

    @Test
    void redisCassandraEOpenSearchComCredenciaisETls() throws Exception {
        StandardEnvironment e = env("REDIS_USERNAME", "fai_app", "CASSANDRA_SSL", "true", "CASSANDRA_CA_CERT_PEM", "pem",
                "OPENSEARCH_CA_CERT_PEM", "ca", "OPENSEARCH_TLS_INSECURE", "true");
        assertThat(e.getProperty("spring.data.redis.username")).isEqualTo("fai_app");
        assertThat(e.getProperty("fashionai.cassandra.ssl.enabled", Boolean.class)).isTrue();
        assertThat(e.getProperty("fashionai.cassandra.ssl.ca-cert-pem")).isEqualTo("pem");
        assertThat(e.getProperty("fashionai.opensearch.ca-cert-pem")).isEqualTo("ca");
        assertThat(e.getProperty("fashionai.opensearch.tls-insecure", Boolean.class)).isTrue();
        StandardEnvironment d = env();
        assertThat(d.getProperty("spring.data.redis.username")).isEmpty();
        assertThat(d.getProperty("fashionai.opensearch.tls-insecure", Boolean.class)).isFalse();
        assertThat(d.getProperty("fashionai.opensearch.tls-verify-hostname", Boolean.class)).isTrue();
        assertThat(d.getProperty("fashionai.cassandra.ssl.enabled", Boolean.class)).isFalse();
    }

    @Test
    void compatibilidadeDoUseSslRegistradaNoSpringFactories() throws Exception {
        var found = new StringBuilder();
        var resources = getClass().getClassLoader().getResources("META-INF/spring.factories");
        while (resources.hasMoreElements()) {
            try (var in = resources.nextElement().openStream()) {
                found.append(new String(in.readAllBytes(), StandardCharsets.UTF_8)).append('\n');
            }
        }
        assertThat(found.toString()).contains(EnvironmentPostProcessor.class.getName() + "=" + MysqlSslModeEnvironmentPostProcessor.class.getName());
    }
}
