package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminViewsUserRowTest {
    @Test
    void linhaDaContaTrazOPapelEOEstadoParaATelaSaberQuemEstaSuspenso() {
        User u = mock(User.class);
        UUID id = UUID.randomUUID();
        when(u.getId()).thenReturn(id);
        when(u.getUsername()).thenReturn("duda.demo");
        when(u.getProfileType()).thenReturn(ProfileType.PESSOAL);
        when(u.getRole()).thenReturn("USER");
        when(u.getStatus()).thenReturn(AccountStatus.SUSPENDED);

        assertThat(AdminViews.userRow(u))
                .containsEntry("id", id)
                .containsEntry("username", "duda.demo")
                .containsEntry("profileType", "PESSOAL")
                .containsEntry("role", "USER")
                .containsEntry("status", "SUSPENDED");
    }
}
