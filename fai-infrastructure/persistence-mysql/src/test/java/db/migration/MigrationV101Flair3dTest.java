package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MigrationV101Flair3dTest {
    static final List<String> ELENCOS = List.of("PRIMEIRO_ELENCO", "PALETA_ATELIE", "CASA_MARCA", "NOITE_ESTREIA", "ELENCO_LENDARIO");

    static String sql() throws Exception {
        return new ClassPathResource("db/migration/V104__flair3d_andamento_e_edicoes.sql").getContentAsString(StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");
    }

    @Test
    void migrationAplicadaPreservaChecksumOriginal() throws Exception {
        assertThat(AppliedMigrationChecksumsTest.checksum(new ClassPathResource("db/migration/V101__flair3d_partidas.sql")))
                .isEqualTo(-135863203);
    }

    @Test
    void partidaGuardaOAndamentoDasEtapas() throws Exception {
        assertThat(sql()).contains("ALTER TABLE flair3d_matches ADD COLUMN estado_json JSON NULL");
    }

    @Test
    void contadorDeEdicoesTemUmaLinhaPorElenco() throws Exception {
        String sql = sql();
        assertThat(sql).contains("CREATE TABLE flair_cbc_squad_edicoes ( elenco VARCHAR(32) PRIMARY KEY, ultima INT NOT NULL )");
        assertThat(sql).contains("INSERT INTO flair_cbc_squad_edicoes (elenco, ultima)")
                .contains("GREATEST(0, COALESCE(MAX(entregas.edicao), 0))")
                .contains("entregas.elenco = elencos.elenco AND entregas.ok = TRUE")
                .contains("GROUP BY elencos.elenco");
        for (String elenco : ELENCOS) {
            assertThat(sql).contains("'" + elenco + "'");
        }
    }
}
