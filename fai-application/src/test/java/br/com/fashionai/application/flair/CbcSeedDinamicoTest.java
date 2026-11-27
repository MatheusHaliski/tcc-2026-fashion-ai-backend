package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os Desafios de Montagem dinâmicos semeados na V131 (docs/flair/cbc/MONTAGEM_DINAMICA.md) passam pelas mesmas regras
 * da administração (vagas e requisitos válidos), usam só os cenários que o cliente sabe tocar
 * (lib/flair/montagem/dinamico/catalogo.ts), ficam sempre disponíveis (sem Momento) e entram uma vez só (idempotente).
 */
class CbcSeedDinamicoTest {
    static final Pattern ROW = Pattern.compile(
            "SELECT '(7e[^']*)', '([a-z0-9-]+)',.*?\\n\\s*'([a-z0-9-]+)', '(EASY|MEDIUM|HARD|LEGENDARY)', 'ACTIVE', (NULL|'[^']*'),\\n\\s*'(\\[.*?\\])',\\n\\s*'(\\[.*?\\])',"
                    + ".*?WHERE NOT EXISTS \\(SELECT 1 FROM flair_challenges WHERE slug = '([a-z0-9-]+)' OR id = '(7e[^']*)'\\);",
            Pattern.DOTALL);
    static final List<String> CENARIOS = List.of("firefly-fogo", "arena", "logo-fai", "logo-deriva", "caleidoscopio");

    @Test
    void desafiosDinamicosCumpremAsRegrasEEntramUmaVezSo() throws IOException {
        String sql = Files.readString(CbcSeedTest.MIGRATIONS.resolve("V131__montagem_quebra_cabeca_dinamico.sql"));
        Matcher m = ROW.matcher(sql);
        List<String> slugs = new ArrayList<>();
        List<String> cenarios = new ArrayList<>();
        while (m.find()) {
            String slug = m.group(2);
            List<CbcRules.Slot> slots = Json.list(m.group(6)).stream()
                    .map(s -> new CbcRules.Slot(String.valueOf(s.get("key")), String.valueOf(s.get("position")))).toList();
            List<Map<String, Object>> reqs = Json.list(m.group(7));
            assertThat(CbcRules.validate(slots, reqs)).as(slug).isEmpty();
            assertThat(m.group(5)).as("sempre disponível " + slug).isEqualTo("NULL");
            assertThat(m.group(8)).as("guarda pelo slug").isEqualTo(slug);
            assertThat(m.group(9)).as("guarda pelo id").isEqualTo(m.group(1));
            slugs.add(slug);
            cenarios.add(m.group(3));
        }
        assertThat(slugs).hasSize(5).doesNotHaveDuplicates();
        assertThat(cenarios).containsExactlyElementsOf(CENARIOS);
        assertThat(sql).doesNotContainIgnoringCase("CREATE ").doesNotContainIgnoringCase("ALTER ").doesNotContainIgnoringCase("DROP ");
    }
}
