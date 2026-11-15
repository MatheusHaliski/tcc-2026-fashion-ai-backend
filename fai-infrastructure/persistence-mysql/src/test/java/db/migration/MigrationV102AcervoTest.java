package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V102 (ACERVO): as cinco tabelas existem com as colunas que as entidades mapeiam; cada peça tem no máximo um lugar;
 * apagar um compartimento solta a peça e o desejo (SET NULL) em vez de apagá-los; apagar a peça ou a conta leva junto o
 * que é dela.
 */
class MigrationV102AcervoTest {
    static final List<String> AUDITORIA = List.of("version BIGINT NOT NULL DEFAULT 0", "created_at DATETIME(6) NOT NULL",
            "updated_at DATETIME(6) NOT NULL", "created_by VARCHAR(80) NULL", "last_modified_by VARCHAR(80) NULL");

    static String sql() throws Exception {
        return new ClassPathResource("db/migration/V102__acervo.sql").getContentAsString(StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");
    }

    static String tabela(String nome) throws Exception {
        String sql = sql();
        int inicio = sql.indexOf("CREATE TABLE " + nome + " (");
        assertThat(inicio).as("tabela " + nome).isGreaterThanOrEqualTo(0);
        return sql.substring(inicio, sql.indexOf(");", inicio));
    }

    @Test
    void asCincoTabelasTemAsColunasDeAuditoriaDasEntidades() throws Exception {
        for (String nome : List.of("acervo_ambientes", "acervo_moveis", "acervo_compartimentos", "acervo_pecas", "acervo_desejos")) {
            assertThat(tabela(nome)).contains("id CHAR(36) NOT NULL PRIMARY KEY", "user_id CHAR(36) NOT NULL").contains(AUDITORIA);
        }
    }

    @Test
    void movelGuardaAConfiguracaoEmCentimetros() throws Exception {
        assertThat(tabela("acervo_moveis")).contains("modo VARCHAR(16) NOT NULL", "largura_cm INT NOT NULL", "altura_cm INT NOT NULL",
                "profundidade_cm INT NOT NULL", "material VARCHAR(16) NOT NULL", "cor VARCHAR(24) NOT NULL", "porta VARCHAR(16) NOT NULL",
                "puxador VARCHAR(16) NOT NULL", "puxador_acabamento VARCHAR(16) NOT NULL",
                "FOREIGN KEY (ambiente_id) REFERENCES acervo_ambientes (id) ON DELETE CASCADE ON UPDATE CASCADE");
        assertThat(tabela("acervo_compartimentos")).contains("tipo VARCHAR(16) NOT NULL", "ordem INT NOT NULL DEFAULT 0",
                "FOREIGN KEY (movel_id) REFERENCES acervo_moveis (id) ON DELETE CASCADE ON UPDATE CASCADE");
    }

    @Test
    void cadaPecaTemUmLugarSoEApagarOCompartimentoNaoApagaAPeca() throws Exception {
        assertThat(tabela("acervo_pecas")).contains("UNIQUE KEY uk_acervo_peca_piece (piece_id)", "compartimento_id CHAR(36) NULL",
                "largura_cm DECIMAL(6, 1) NULL", "comprimento_cm DECIMAL(6, 1) NULL", "medidas_nota VARCHAR(160) NULL",
                "FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE CASCADE ON UPDATE CASCADE",
                "FOREIGN KEY (compartimento_id) REFERENCES acervo_compartimentos (id) ON DELETE SET NULL ON UPDATE CASCADE");
    }

    @Test
    void desejoFicaSeparadoDasPecasComPrecoEstimadoOpcional() throws Exception {
        assertThat(tabela("acervo_desejos")).contains("preco_estimado DECIMAL(10, 2) NULL", "moeda CHAR(3) NOT NULL DEFAULT 'BRL'",
                "FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
                "FOREIGN KEY (compartimento_id) REFERENCES acervo_compartimentos (id) ON DELETE SET NULL ON UPDATE CASCADE")
                .doesNotContain("wardrobe_items");
    }
}
