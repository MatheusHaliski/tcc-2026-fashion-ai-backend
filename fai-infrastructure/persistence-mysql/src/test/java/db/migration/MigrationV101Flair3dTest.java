package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V101 (FLAIR 3D): a partida guarda o andamento das etapas em {@code estado_json}, e cada elenco do CBC tem a linha do
 * contador de edições que a entrega bloqueia antes de numerar (chave primária por elenco, já semeada com os cinco).
 */
class MigrationV101Flair3dTest {
    static final List<String> ELENCOS = List.of("PRIMEIRO_ELENCO", "PALETA_ATELIE", "CASA_MARCA", "NOITE_ESTREIA", "ELENCO_LENDARIO");

    static String sql() throws Exception {
        return new ClassPathResource("db/migration/V101__flair3d_partidas.sql").getContentAsString(StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");
    }

    @Test
    void partidaGuardaOAndamentoDasEtapas() throws Exception {
        assertThat(sql()).contains("CREATE TABLE flair3d_matches (").contains("estado_json JSON NULL");
    }

    @Test
    void contadorDeEdicoesTemUmaLinhaPorElenco() throws Exception {
        String sql = sql();
        assertThat(sql).contains("CREATE TABLE flair_cbc_squad_edicoes ( elenco VARCHAR(32) PRIMARY KEY, ultima INT NOT NULL )");
        assertThat(sql).contains("INSERT INTO flair_cbc_squad_edicoes (elenco, ultima) VALUES");
        for (String elenco : ELENCOS) {
            assertThat(sql).contains("('" + elenco + "', 0)");
        }
    }
}
