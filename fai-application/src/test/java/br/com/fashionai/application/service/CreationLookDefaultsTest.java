package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CreationLookDefaultsTest {
    private final User owner = new User();
    private final LookTypePreferencesService preferences = mock(LookTypePreferencesService.class);
    private final PieceFormWriter writer = mock(PieceFormWriter.class);
    private final SchemeService.SchemeForm form = new SchemeService.SchemeForm(
            null, null, null, null, null, null, Visibility.PRIVATE, null, null, null, null,
            null, null, null, null, null, null, null, null, null);

    CreationLookDefaultsTest() {
        owner.assignId(UUID.randomUUID());
        doAnswer(call -> {
            ((br.com.fashionai.domain.model.WardrobeItem) call.getArgument(0)).setSex("FEMININO");
            return null;
        }).when(writer).apply(any(), any(), eq(true), any());
    }

    private TipoLook type(String code) {
        TipoLook type = new TipoLook();
        type.setCodigo(code);
        when(preferences.defaultType(owner.getId())).thenReturn(type);
        return type;
    }

    @Test
    void schemeInitializationPreservesDefaultsWhenNotConfigured() {
        var scheme = CreationLookDefaults.scheme(owner, form, preferences);
        assertThat(scheme.getUser()).isSameAs(owner);
        assertThat(scheme.getTipoLook()).isNull();
        assertThat(scheme.getCreationMode()).isEqualTo(CreationMode.MANUAL);
        assertThat(scheme.getOrigin()).isEqualTo(SchemeOrigin.CRIAR_LOOK);
        assertThat(scheme.getVisibility()).isEqualTo(Visibility.PRIVATE);
    }

    @Test
    void newSchemeUsesCatalogEntityAndKeepsItsTypeAfterPreferenceChanges() {
        TipoLook selected = type("MASCULINO");
        var scheme = CreationLookDefaults.scheme(owner, form, preferences);
        assertThat(scheme.getTipoLook()).isSameAs(selected);
        type("FEMININO");
        assertThat(scheme.getTipoLook()).isSameAs(selected);
    }

    @Test
    void newPieceUsesConfiguredTypeAndNormalizesUnisexTaxonomy() {
        type("MASCULINO");
        var piece = CreationLookDefaults.piece(owner, null, null, writer, preferences);
        assertThat(piece.getSex()).isEqualTo("MASCULINO");
        type("UNISEX");
        assertThat(CreationLookDefaults.piece(owner, null, null, writer, preferences).getSex()).isEqualTo("UNISSEX");
        assertThat(piece.getSex()).isEqualTo("MASCULINO");
    }

    @Test
    void disabledPreferenceKeepsPieceFormValue() {
        assertThat(CreationLookDefaults.piece(owner, null, null, writer, preferences).getSex()).isEqualTo("FEMININO");
    }
}
