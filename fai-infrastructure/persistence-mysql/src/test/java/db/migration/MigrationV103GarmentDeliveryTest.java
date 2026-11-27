package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V103 (Garment Delivery): a encomenda guarda só o prefixo do CEP, nenhuma coluna de pagamento, uma linha por etapa,
 * o registro de fabricação no passaporte e os tipos de lavagem só quando o código ainda não existe.
 */
class MigrationV103GarmentDeliveryTest {
    static String sql() throws Exception {
        return new ClassPathResource("db/migration/V103__garment_delivery.sql").getContentAsString(StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");
    }

    static String tabela(String nome) throws Exception {
        String sql = sql();
        int inicio = sql.indexOf("CREATE TABLE " + nome + " (");
        assertThat(inicio).as("tabela " + nome).isGreaterThanOrEqualTo(0);
        return sql.substring(inicio, sql.indexOf(");", inicio));
    }

    @Test
    void encomendaTemDadoMinimoDeEntregaENenhumDadoDePagamento() throws Exception {
        assertThat(tabela("garment_orders")).contains("cep_prefix CHAR(5) NOT NULL", "delivery_label VARCHAR(40) NULL",
                "CONSTRAINT uq_garment_order_request UNIQUE (owner_id, request_id)", "CONSTRAINT uq_garment_order_serial UNIQUE (serial_number)",
                "version BIGINT NOT NULL DEFAULT 0", "FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE",
                "FOREIGN KEY (piece_id) REFERENCES wardrobe_items (id) ON DELETE SET NULL ON UPDATE CASCADE")
                .doesNotContain("card", "pix", "street", "phone", "cep CHAR(8)");
    }

    @Test
    void etapaEUnicaPorEncomendaEPassaporteGanhaRegistroDeFabricacao() throws Exception {
        assertThat(tabela("garment_order_events")).contains("CONSTRAINT uq_garment_order_event UNIQUE (order_id, stage)",
                "FOREIGN KEY (order_id) REFERENCES garment_orders (id) ON DELETE CASCADE");
        assertThat(sql()).contains("ALTER TABLE garment_passports ADD COLUMN manufacturing_json LONGTEXT NULL;");
        for (String codigo : new String[]{"MAQUINA_40", "MAQUINA_30_DELICADO", "LAVAR_A_MAO", "NAO_LAVAR"}) {
            assertThat(sql()).contains("WHERE NOT EXISTS (SELECT 1 FROM `TipoLavagem` WHERE codigo = '" + codigo + "')");
        }
    }
}
