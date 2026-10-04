package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Duas branches que criam a mesma versão de migration passam no merge sem conflito (os nomes são diferentes), mas o
 * Flyway recusa versões repetidas e a API não sobe — e nenhum outro teste roda o Flyway. Foi o que aconteceu com três
 * V31 e duas V32 no main. Este teste falha no CI antes do deploy: versões SQL e Java somadas, sem repetição.
 */
class MigrationVersionsTest {
    private static final Pattern NAME = Pattern.compile("^V([0-9_.]+)__.+\\.(sql|class)$");

    @Test
    void cadaVersaoDeMigrationApareceUmaVezSo() throws Exception {
        Map<String, List<String>> byVersion = new TreeMap<>();
        for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath*:db/migration/V*__*")) {
            String file = r.getFilename();
            Matcher m = file == null ? null : NAME.matcher(file);
            if (m == null || !m.matches() || file.contains("$")) {
                continue;                                    // classes internas (V34__...$Fk.class) não são migrations
            }
            String version = m.group(1).replace('_', '.').replaceAll("(\\.0+)+$", "");
            byVersion.computeIfAbsent(version, v -> new ArrayList<>()).add(file);
        }
        assertThat(byVersion).as("migrations encontradas no classpath").hasSizeGreaterThan(30);
        Map<String, List<String>> repeated = new TreeMap<>();
        byVersion.forEach((v, files) -> {
            if (files.size() > 1) {
                repeated.put(v, files);
            }
        });
        assertThat(repeated).as("versões de migration repetidas (renumere a mais nova)").isEmpty();
    }
}
