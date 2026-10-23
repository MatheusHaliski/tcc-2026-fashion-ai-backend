package br.com.fashionai.application.view;

import br.com.fashionai.domain.model.AuditableEntity;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.WardrobeItem;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The manually maintained reference schema must remain compatible with the entity mappings. */
class PieceReferenceSchemaTest {
    @Test
    void catalogsShareTipoLookAuditAndColumnConventions() throws Exception {
        assertCatalog(EstadoConservacao.class, "EstadoConservacao");
        assertCatalog(TipoLavagem.class, "TipoLavagem");
    }

    @Test
    void wardrobeReferencesUseTheExistingNullableForeignKeyColumns() throws Exception {
        assertAssociation("estadoConservacao", "estado_de_conservacao", EstadoConservacao.class);
        assertAssociation("tipoLavagem", "tipo_lavagem_id", TipoLavagem.class);
        assertThat(WardrobeItem.class.getDeclaredField("condition").getAnnotation(Column.class).name()).isEqualTo("item_condition");
        assertThat(WardrobeItem.class.getDeclaredField("careInstructions").getAnnotation(Column.class).name()).isEqualTo("care_instructions");
    }

    private static void assertCatalog(Class<?> type, String table) throws Exception {
        assertThat(type.getSuperclass()).isEqualTo(AuditableEntity.class);
        assertThat(type.getAnnotation(Table.class).name().replace("`", "")).isEqualTo(table);
        Column code = type.getDeclaredField("codigo").getAnnotation(Column.class);
        assertThat(code.length()).isEqualTo(30);
        assertThat(code.nullable()).isFalse();
        assertThat(code.unique()).isTrue();
        Column name = type.getDeclaredField("nome").getAnnotation(Column.class);
        assertThat(name.length()).isEqualTo(80);
        assertThat(name.nullable()).isFalse();
        assertThat(AuditableEntity.class.getDeclaredField("id").getAnnotation(Column.class).length()).isEqualTo(36);
    }

    private static void assertAssociation(String property, String column, Class<?> target) throws Exception {
        var field = WardrobeItem.class.getDeclaredField(property);
        assertThat(field.getType()).isEqualTo(target);
        assertThat(field.getAnnotation(JoinColumn.class).name()).isEqualTo(column);
        assertThat(field.getAnnotation(JoinColumn.class).nullable()).isTrue();
        assertThat(field.getAnnotation(ManyToOne.class).fetch()).isEqualTo(FetchType.LAZY);
    }
}
