package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Domínio Looks (RF53): origem do look (ia, manual, remix) e estados que a tela envia — antes publicados/rascunhos/arquivados eram ignorados. */
class SchemeFiltersTest {
    static Scheme scheme(SchemeOrigin origin, CreationMode mode, SchemeStatus status) {
        Scheme s = new Scheme();
        s.setOrigin(origin);
        s.setCreationMode(mode);
        s.setStatus(status);
        return s;
    }

    @Test
    void kindSeparatesAiManualAndRemix() {
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("manual");
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.PROVADOR, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("manual");
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.AI_ASSISTED, SchemeStatus.DRAFT))).isEqualTo("ia");
        for (SchemeOrigin o : new SchemeOrigin[]{SchemeOrigin.COPILOT, SchemeOrigin.AUTOPILOTO, SchemeOrigin.VISTA_ME, SchemeOrigin.SMART_MIRROR}) {
            assertThat(SchemeService.kindOf(scheme(o, CreationMode.MANUAL, SchemeStatus.DRAFT))).as(o.name()).isEqualTo("ia");
        }
        assertThat(SchemeService.kindOf(scheme(SchemeOrigin.REMIX, CreationMode.MANUAL, SchemeStatus.DRAFT))).isEqualTo("remix");
        Scheme derived = scheme(SchemeOrigin.COPILOT, CreationMode.AI_ASSISTED, SchemeStatus.DRAFT);
        derived.setOriginalScheme(new Scheme());
        assertThat(SchemeService.kindOf(derived)).as("derivado de outro look é remix, mesmo vindo do Copilot").isEqualTo("remix");
    }

    @Test
    void statesSentByTheScreenActuallyFilter() {
        Scheme published = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.PUBLISHED);
        Scheme draft = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.DRAFT);
        Scheme archived = scheme(SchemeOrigin.CRIAR_LOOK, CreationMode.MANUAL, SchemeStatus.ARCHIVED);
        assertThat(SchemeService.stateMatches(published, "publicados")).isTrue();
        assertThat(SchemeService.stateMatches(draft, "publicados")).isFalse();
        assertThat(SchemeService.stateMatches(draft, "rascunhos")).isTrue();
        assertThat(SchemeService.stateMatches(published, "rascunhos")).isFalse();
        assertThat(SchemeService.stateMatches(archived, "arquivados")).isTrue();
        assertThat(SchemeService.stateMatches(draft, "arquivados")).isFalse();
        draft.setFavorite(true);
        assertThat(SchemeService.stateMatches(draft, "favoritos")).isTrue();
        assertThat(SchemeService.stateMatches(published, "")).isTrue();
        assertThat(SchemeService.stateMatches(published, "todos")).isTrue();
    }
}
