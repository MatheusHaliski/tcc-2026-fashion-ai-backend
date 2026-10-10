package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os desafios semeados na V56 passam pelas mesmas regras da administração: vagas e requisitos válidos, nenhum desafio
 * em Momento religioso (R1), tema só onde o Momento tem ≥ 2 leituras (P2) e um desafio aberto a qualquer nível em cada
 * Momento (A1). A semente não passa pelo serviço, então o teste lê o SQL.
 */
class CbcSeedTest {
    static final Path MIGRATIONS = Path.of("..", "fai-infrastructure", "persistence-mysql", "src", "main", "resources", "db", "migration");
    static final Pattern ROW = Pattern.compile("^\\('7c[^']*','([a-z0-9-]+)',.*?'(EASY|MEDIUM|HARD|LEGENDARY)','ACTIVE',(NULL|'[0-9a-f-]{36}'),'(\\[.*?\\])','(\\[.*?\\])',",
            Pattern.MULTILINE);
    /** Momentos da V53 com natureza e número de leituras (a V56 dá 4 leituras ao Inverno 2027). */
    static final Map<String, String> NATURE = Map.of("6a000000-0000-4000-8000-000000000004", "RELIGIOUS");
    static final Map<String, Integer> READINGS = Map.of("6a000000-0000-4000-8000-000000000001", 4, "6a000000-0000-4000-8000-000000000002", 8,
            "6a000000-0000-4000-8000-000000000007", 0, "6a000000-0000-4000-8000-000000000008", 8, "6a000000-0000-4000-8000-000000000010", 4);

    @Test
    void desafiosSemeadosCumpremAsRegrasDoLivro() throws IOException {
        String sql = Files.readString(MIGRATIONS.resolve("V56__desafios_de_montagem.sql"));
        Matcher m = ROW.matcher(sql);
        Map<String, List<Boolean>> openByMoment = new HashMap<>();
        List<String> slugs = new ArrayList<>();
        while (m.find()) {
            String slug = m.group(1);
            String moment = "NULL".equals(m.group(3)) ? null : m.group(3).replace("'", "");
            List<CbcRules.Slot> slots = Json.list(m.group(4)).stream()
                    .map(s -> new CbcRules.Slot(String.valueOf(s.get("key")), String.valueOf(s.get("position")))).toList();
            List<Map<String, Object>> reqs = Json.list(m.group(5));
            slugs.add(slug);
            assertThat(CbcRules.validate(slots, reqs)).as(slug).isEmpty();
            if (moment != null) {
                assertThat(NATURE.get(moment)).as("R1 " + slug).isNull();
                if (CbcRules.hasTheme(reqs)) {
                    assertThat(READINGS.getOrDefault(moment, 0)).as("P2 " + slug).isGreaterThanOrEqualTo(2);
                }
                openByMoment.computeIfAbsent(moment, k -> new ArrayList<>()).add(CbcRules.levelOpen(reqs));
            }
        }
        assertThat(slugs).hasSize(16).doesNotHaveDuplicates();
        openByMoment.forEach((moment, open) -> assertThat(open).as("A1 " + moment).contains(true));
        assertThat(sql).contains("WHERE slug = 'inverno-2027'");
    }
}
