package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class MigrationV106OrigemTest {
    @Test
    void adicionaCamposAusentesEPreservaNomesExistentes() throws Exception {
        String sql = new ClassPathResource("db/migration/V106__origem_campos_referencia.sql")
                .getContentAsString(StandardCharsets.UTF_8).replaceAll("\\s+", " ");

        assertThat(sql).contains("COLUMN_NAME = 'nome'", "COLUMN_NAME = 'ativo'",
                "ADD COLUMN nome VARCHAR(80)", "ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE",
                "WHEN 'ADQUIRIDA' THEN 'Adquirida'", "WHEN 'HERDADA' THEN 'Herdada'",
                "WHEN 'TROCADA' THEN 'Trocada'", "ELSE codigo", "WHERE nome IS NULL OR nome = ''");
    }
}
