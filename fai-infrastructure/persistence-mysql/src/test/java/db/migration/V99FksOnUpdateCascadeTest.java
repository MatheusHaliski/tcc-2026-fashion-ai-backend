package db.migration;

import db.migration.V99__fks_on_update_cascade.Fk;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class V99FksOnUpdateCascadeTest {

    private static Fk fk(String name, String delete, String update) {
        return new Fk(name, "wardrobe_items", List.of("brand_id"), "brands", List.of("id"), delete, update);
    }

    @Test
    void restrictENoActionViramCascadeESetNullEMantido() {
        assertThat(V99__fks_on_update_cascade.targetDeleteRule("RESTRICT")).isEqualTo("CASCADE");
        assertThat(V99__fks_on_update_cascade.targetDeleteRule("NO ACTION")).isEqualTo("CASCADE");
        assertThat(V99__fks_on_update_cascade.targetDeleteRule("SET NULL")).isEqualTo("SET NULL");
        assertThat(V99__fks_on_update_cascade.targetDeleteRule("CASCADE")).isEqualTo("CASCADE");
    }

    @Test
    void fkJaSemRestricaoEPulada() {
        assertThat(V99__fks_on_update_cascade.alreadyUnrestricted(fk("a", "SET NULL", "CASCADE"))).isTrue();
        assertThat(V99__fks_on_update_cascade.alreadyUnrestricted(fk("a", "CASCADE", "CASCADE"))).isTrue();
        assertThat(V99__fks_on_update_cascade.alreadyUnrestricted(fk("a", "CASCADE", "RESTRICT"))).isFalse();
        assertThat(V99__fks_on_update_cascade.alreadyUnrestricted(fk("a", "RESTRICT", "CASCADE"))).isFalse();
    }

    @Test
    void alterTrocaAConstraintNumComandoSo() {
        String sql = V99__fks_on_update_cascade.alterSql(fk("fkp_wardrobe_items__brand_id", "RESTRICT", "RESTRICT"),
                "fkc_wardrobe_items__brand_id");
        assertThat(sql).isEqualTo("ALTER TABLE `wardrobe_items` DROP FOREIGN KEY `fkp_wardrobe_items__brand_id`, "
                + "ADD CONSTRAINT `fkc_wardrobe_items__brand_id` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) "
                + "ON DELETE CASCADE ON UPDATE CASCADE");
    }

    @Test
    void nomeNovoDifereDoAntigoCabeEm64ENaoColide() {
        Fk longo = fk("fkp_" + "x".repeat(70), "CASCADE", "RESTRICT");
        assertThat(V99__fks_on_update_cascade.newName(longo, Set.of())).hasSizeLessThanOrEqualTo(64).startsWith("fkc_");
        assertThat(V99__fks_on_update_cascade.newName(fk("fk_a", "CASCADE", "RESTRICT"), Set.of())).isEqualTo("fkc_a");
        String semColisao = V99__fks_on_update_cascade.newName(fk("fk_a", "CASCADE", "RESTRICT"), Set.of("fkc_a"));
        assertThat(semColisao).startsWith("fkc_").isNotEqualTo("fkc_a").hasSize(20);
    }
}
