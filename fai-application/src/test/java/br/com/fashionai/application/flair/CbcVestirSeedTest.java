package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V110 — os Desafios de Montagem "vestir a cena": a migration retira os desafios antigos sem apagar nada (DRAFT, só
 * linhas sem série) e semeia cinco desafios de quatro vagas, uma por personagem, cada uma pedindo a roupa dele
 * (subcategoria e cor). As vagas, na ordem, são as mesmas do manifesto das cenas do front (lib/flair/vestir/cenas.json),
 * que diz qual recorte de roupa aparece em cada vaga.
 */
class CbcVestirSeedTest {
    static final Path SQL = CbcSeedTest.MIGRATIONS.resolve("V110__desafios_de_montagem_vestir_a_cena.sql");
    static final Path MANIFESTO = Path.of("..", "lib", "flair", "vestir", "cenas.json");
    static final Pattern ROW = Pattern.compile("^\\('7e[^']*','([a-z0-9-]+)',.*?'(vestir-[a-z]+)','(EASY|MEDIUM|HARD|LEGENDARY)','ACTIVE',NULL,'(\\[.*?\\])','(\\[.*?\\])',",
            Pattern.MULTILINE);

    record Semente(String slug, String cenario, List<Map<String, Object>> vagas, List<Map<String, Object>> requisitos) {
    }

    static List<Semente> sementes() throws IOException {
        Matcher m = ROW.matcher(Files.readString(SQL));
        List<Semente> out = new ArrayList<>();
        while (m.find()) {
            out.add(new Semente(m.group(1), m.group(2), Json.list(m.group(4)), Json.list(m.group(5))));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    static List<CbcRules.Slot> slots(Semente s) {
        return s.vagas().stream().map(v -> new CbcRules.Slot(String.valueOf(v.get("key")), String.valueOf(v.get("position")),
                (Map<String, Object>) v.get("accepts"))).toList();
    }

    @Test
    void retiraOsAntigosSemApagarNadaEPoupaOsCapitulos() throws IOException {
        String sql = Files.readString(SQL).replaceAll("(?m)^--.*$", "").replaceAll("\\s+", " ");
        assertThat(sql).contains("UPDATE flair_challenges SET status = 'DRAFT'", "WHERE series IS NULL AND status <> 'DRAFT' AND slug NOT IN (");
        assertThat(sql).doesNotContainIgnoringCase("DELETE ").doesNotContainIgnoringCase("DROP ").doesNotContainIgnoringCase("TRUNCATE");
    }

    @Test
    @SuppressWarnings("unchecked")
    void cincoDesafiosDeQuatroVagasBatemComAsCenasDoFront() throws IOException {
        List<Semente> sementes = sementes();
        Map<String, Object> manifesto = Json.map(Files.readString(MANIFESTO));
        assertThat(sementes).extracting(Semente::slug)
                .containsExactly("gala-na-piscina", "noite-da-jaqueta-college", "atelie-do-futuro", "show-no-galpao", "praca-dos-jacarandas");
        for (Semente s : sementes) {
            List<CbcRules.Slot> slots = slots(s);
            assertThat(CbcRules.validate(slots, s.requisitos())).as(s.slug()).isEmpty();
            assertThat(CbcRules.levelOpen(s.requisitos())).as(s.slug()).isTrue();
            assertThat(slots).as(s.slug()).hasSize(4).allSatisfy(v -> {
                assertThat(v.accepts()).containsKeys("subcategory", "color");
                assertThat(v.optional()).isFalse();
            });
            Map<String, Object> cena = (Map<String, Object>) manifesto.get(s.cenario());
            assertThat(cena).as("cena " + s.cenario()).isNotNull().containsEntry("slug", s.slug());
            assertThat(((List<Map<String, Object>>) cena.get("pessoas")).stream().map(p -> p.get("vaga")).toList())
                    .as("vagas de " + s.slug()).isEqualTo(slots.stream().map(CbcRules.Slot::key).toList());
            for (Map<String, Object> v : s.vagas()) {
                assertThat((Map<String, Object>) v.get("label")).containsKeys("pt-BR", "en", "es");
                assertThat((Map<String, Object>) v.get("story")).containsKeys("pt-BR", "en", "es");
            }
        }
    }

    @Test
    void cadaVagaSoFechaComARoupaDoPersonagem() throws IOException {
        Semente show = sementes().stream().filter(s -> s.slug().equals("show-no-galpao")).findFirst().orElseThrow();
        List<CbcRules.Slot> slots = slots(show);
        CbcRules.Slot voz = slots.get(1);
        // a cantora: vestido vermelho (vinho é da mesma família de cor); camiseta vermelha ou vestido preto não servem
        assertThat(CbcRules.misses(voz, carta("full_body_piece", "dress", "burgundy"))).isEmpty();
        assertThat(CbcRules.misses(voz, carta("upper_piece", "t_shirt", "red"))).containsExactly("subcategory");
        assertThat(CbcRules.misses(voz, carta("full_body_piece", "dress", "black"))).containsExactly("color");
        // a baixista: macacão preto
        assertThat(CbcRules.misses(slots.get(3), carta("full_body_piece", "jumpsuit", "black"))).isEmpty();
    }

    static CbcRules.Card carta(String categoria, String subcategoria, String cor) {
        return new CbcRules.Card(UUID.randomUUID(), "VES", "PRATA", 70, "Norte", "PIECE", Set.of(), Set.of(cor),
                Set.of(), Set.of(), Map.of(), null, null, categoria, subcategoria);
    }
}
