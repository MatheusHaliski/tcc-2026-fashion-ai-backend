package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** RNF10 sino de notificações + RF3 (CA34–CA37): entrega, preferências por tipo, leitura e expurgo de 90 dias. */
class NotificationServiceTest {
    Kit kit;
    NotificationService service;
    NotificationProjectionPort projection;
    User ana;
    User bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        bia = kit.dep(UserRepository.class).save(Kit.user("bia"));
        projection = kit.dep(NotificationProjectionPort.class);
        service = kit.build(NotificationService.class);
    }

    UserPreferences prefs(User u, boolean master, String json) {
        UserPreferences p = new UserPreferences(u);
        p.setNotificationPushMaster(master);
        p.setNotificationPrefsJson(json);
        return kit.dep(UserPreferencesRepository.class).save(p);
    }

    @Test
    void entregaENotificaAProjecao() {
        Notification n = service.notify(ana.getId(), bia.getId(), NotificationType.NEW_LIKE, "SCHEME", UUID.randomUUID(), "Curtiu", "corpo",
                Map.of("k", 1));
        assertThat(n.isDelivered()).isTrue();
        assertThat(n.getActor()).isSameAs(bia);
        assertThat(n.getPayloadJson()).contains("\"k\":1");
        verify(projection).appendNotification(ana.getId(), n.getId());
    }

    @Test
    void naoNotificaASiMesmoNemQuemNaoExiste() {
        assertThat(service.notify(null, null, NotificationType.WELCOME, null, null, "t", null, null)).isNull();
        assertThat(service.notify(ana.getId(), ana.getId(), NotificationType.NEW_LIKE, null, null, "t", null, null)).isNull();
        assertThat(service.notify(UUID.randomUUID(), null, NotificationType.WELCOME, null, null, "t", null, null)).isNull();
        // a própria pessoa recebe aviso de sistema sobre si
        assertThat(service.notify(ana.getId(), ana.getId(), NotificationType.PIECE_CREATED, null, null, "t", null, null)).isNotNull();
    }

    @Test
    void textoLongoECortado() {
        Notification n = service.notify(ana.getId(), UUID.randomUUID(), NotificationType.WELCOME, null, null, "t".repeat(200), "b".repeat(600), null);
        assertThat(n.getTitle()).hasSize(178).endsWith("…");
        assertThat(n.getBody()).hasSize(498).endsWith("…");
        assertThat(n.getActor()).isNull();
        assertThat(n.getPayloadJson()).isNull();
        Notification curto = service.notify(ana.getId(), null, NotificationType.WELCOME, null, null, "oi", null, null);
        assertThat(curto.getBody()).isNull();
    }

    @Test
    void tipoDesligadoContaMasNaoEntrega() {
        prefs(ana, true, "{\"NEW_LIKE\":false}");
        Notification n = service.notify(ana.getId(), bia.getId(), NotificationType.NEW_LIKE, null, null, "t", null, null);
        assertThat(n.isDelivered()).isFalse();
        verify(projection, never()).appendNotification(any(), any());
        assertThat(service.enabled(ana.getId(), NotificationType.NEW_COMMENT)).isTrue();
        assertThat(service.enabled(ana.getId(), NotificationType.PASSWORD_RESET)).isTrue();
    }

    @Test
    void mestreDesligadoSoDeixaSeguranca() {
        prefs(ana, false, null);
        assertThat(service.enabled(ana.getId(), NotificationType.NEW_LIKE)).isFalse();
        assertThat(service.enabled(ana.getId(), NotificationType.PASSWORD_RESET)).isTrue();
    }

    @Test
    void projecaoForaDoArNaoDerrubaANotificacao() {
        doThrow(new IllegalStateException("redis")).when(projection).appendNotification(any(), any());
        assertThat(service.notify(ana.getId(), null, NotificationType.WELCOME, null, null, "t", null, null)).isNotNull();
    }

    @Test
    void caixaLeituraEContagem() {
        CurrentUser me = Kit.as(ana);
        service.notify(ana.getId(), bia.getId(), NotificationType.NEW_LIKE, null, null, "a", null, null);
        Notification n2 = service.notify(ana.getId(), bia.getId(), NotificationType.NEW_COMMENT, null, null, "b", null, null);
        Map<String, Object> inbox = service.inbox(me);
        assertThat(inbox).containsEntry("unread", 2L);
        assertThat((List<?>) inbox.get("items")).hasSize(2);
        service.markRead(me, List.of(n2.getId()));
        assertThat(n2.isRead()).isTrue();
        assertThat(service.unread(me)).isEqualTo(1);
        assertThat(service.markAllRead(me)).isEqualTo(1);
        assertThat(service.unread(me)).isZero();
        assertThatThrownBy(() -> service.markRead(Kit.as(bia), List.of(n2.getId()))).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(403));
    }

    @Test
    void preferenciasPorTipo() {
        CurrentUser me = Kit.as(ana);
        assertThatThrownBy(() -> service.updatePreferences(me, Map.of(), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        UserPreferences p = prefs(ana, true, null);
        List<Map<String, Object>> out = service.updatePreferences(me, Map.of("NEW_LIKE", false), false);
        assertThat(p.isNotificationPushMaster()).isFalse();
        assertThat(p.getNotificationPrefsJson()).contains("NEW_LIKE");
        assertThat(out).hasSize(NotificationType.values().length);
        assertThat(out.stream().filter(m -> "PASSWORD_RESET".equals(m.get("type"))).findFirst().orElseThrow())
                .containsEntry("optOutAllowed", false).containsEntry("enabled", true);
        service.updatePreferences(me, null, null);
        assertThat(p.isNotificationPushMaster()).isFalse();
        assertThatThrownBy(() -> service.updatePreferences(me, Map.of("XYZ", true), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("TIPO_INVALIDO"));
        assertThatThrownBy(() -> service.updatePreferences(me, Map.of("PASSWORD_RESET", false), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("TIPO_OBRIGATORIO"));
        service.updatePreferences(me, Map.of("PASSWORD_RESET", true), true);
        assertThat(service.preferences(me)).hasSize(NotificationType.values().length);
    }

    @Test
    void expurgoDe90Dias() {
        Notification velha = service.notify(ana.getId(), null, NotificationType.WELCOME, null, null, "v", null, null);
        velha.markCreatedAt(Instant.now().minus(NotificationService.RETENTION).minusSeconds(60));
        Notification nova = service.notify(ana.getId(), null, NotificationType.WELCOME, null, null, "n", null, null);
        nova.markCreatedAt(Instant.now());
        assertThat(service.purgeExpired()).isEqualTo(1);
        assertThat(MemoryRepository.<Notification>rows(kit.dep(NotificationRepository.class))).containsExactly(nova);
    }
}
