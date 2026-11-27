package br.com.fashionai.application.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.UserRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Convites da rede FAI nas Partidas FLAIR: limite, a si mesma, bloqueio (sem revelar), antispam e o link do aviso. */
class FlairInviteServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final NotificationRepository repo = mock(NotificationRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final Guard guard = mock(Guard.class);
    private final FlairInviteService service = new FlairInviteService(users, repo, notifications, guard);
    private User ana;
    private User bia;
    private User caio;
    private CurrentUser me;

    @BeforeEach
    void setUp() {
        ana = Kit.user("ana");
        bia = Kit.user("bia");
        caio = Kit.user("caio");
        me = Kit.as(ana);
        when(users.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase("ana")).thenReturn(Optional.of(ana));
        when(users.findByUsernameIgnoreCase("bia")).thenReturn(Optional.of(bia));
        when(users.findByUsernameIgnoreCase("caio")).thenReturn(Optional.of(caio));
    }

    @Test
    @SuppressWarnings("unchecked")
    void convidaComLinkDoModoERivalEPulaQuemNaoPode() {
        when(guard.blocked(ana.getId(), caio.getId())).thenReturn(true);
        Map<String, Object> out = service.invite(me, "battle", List.of("@bia", "BIA", "ana", "caio", "ninguem"), null);
        assertThat(out.get("mode")).isEqualTo("BATTLE");
        assertThat((List<String>) out.get("invited")).containsExactly("bia");
        assertThat((List<Map<String, String>>) out.get("skipped")).extracting(m -> m.get("reason"))
                .containsExactly("VOCE_MESMA", "INDISPONIVEL", "NAO_ENCONTRADO");
        verify(notifications).notify(eq(bia.getId()), eq(ana.getId()), eq(NotificationType.CHALLENGE_INVITE), eq("FLAIR_INVITE"), eq(null),
                anyString(), anyString(), eq(Map.of("href", "/flair/partidas?mode=BATTLE&rival=" + ana.getUsername(), "mode", "BATTLE")));
        verify(notifications, never()).notify(eq(caio.getId()), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void desafioDePlacarLevaOAlvoEAntispamSegura() {
        assertThat(FlairInviteService.href("CHESS", "ana", 87)).isEqualTo("/flair/partidas?mode=CHESS&rival=ana&alvo=87");
        when(repo.existsByRecipientIdAndActorIdAndResourceTypeAndCreatedAtAfter(eq(bia.getId()), eq(ana.getId()), eq("FLAIR_INVITE"), any())).thenReturn(true);
        Map<String, Object> out = service.invite(me, "CHESS", List.of("bia"), 87);
        assertThat(out.get("invited")).isEqualTo(List.of());
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void validaModoEQuantidade() {
        assertThat(FlairInviteService.MODES).contains("DUEL", "ARENA", "TEAM", "BATTLE", "ULTIMATE").hasSize(18);
        assertThatThrownBy(() -> service.invite(me, "XADREZ", List.of("bia"), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.invite(me, "BATTLE", List.of(), null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.invite(me, "BATTLE", List.of("a", "b", "c", "d", "e", "f"), null)).isInstanceOf(ApiException.class);
    }
}
