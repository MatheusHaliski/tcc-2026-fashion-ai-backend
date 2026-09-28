package br.com.fashionai.application.security;

import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bloqueio vale para acesso direto por id (RNF1) e comércio exige perfil institucional aprovado. */
class GuardTest {
    private final UUID owner = UUID.randomUUID();
    private final UUID visitor = UUID.randomUUID();
    private final List<AuditEvent> audited = new ArrayList<>();
    private FollowRepository follows;
    private Guard guard;

    @BeforeEach
    void setUp() {
        follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        guard = new Guard(audited::add, follows);
    }

    private static CurrentUser user(UUID id, ProfileType type, AccountStatus status) {
        return new CurrentUser(id, "u", "USER", type, true, status, "127.0.0.1", "test");
    }

    private void relation(UUID follower, UUID following, FollowStatus status) {
        Follow f = new Follow();
        f.setStatus(status);
        when(follows.findByFollowerIdAndFollowingId(follower, following)).thenReturn(Optional.of(f));
    }

    @Test
    void conteudoPublicoSomeParaQuemFoiBloqueado() {
        CurrentUser v = user(visitor, ProfileType.PESSOAL, AccountStatus.ACTIVE);
        assertThat(guard.canView(v, owner, Visibility.PUBLIC)).isTrue();

        relation(owner, visitor, FollowStatus.BLOQUEADO);                   // o dono bloqueou o visitante
        assertThat(guard.canView(v, owner, Visibility.PUBLIC)).isFalse();
        assertThatThrownBy(() -> guard.requireView(v, owner, Visibility.PUBLIC, "scheme:x"))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThat(audited).hasSize(1);
        assertThat(guard.canView(null, owner, Visibility.PUBLIC)).isTrue();  // visitante anônimo segue vendo o público
        assertThat(guard.canView(user(owner, ProfileType.PESSOAL, AccountStatus.ACTIVE), owner, Visibility.PRIVATE)).isTrue();
    }

    @Test
    void bloqueioValeNasDuasDirecoes() {
        relation(visitor, owner, FollowStatus.BLOQUEADO);                   // o visitante bloqueou o dono
        assertThat(guard.blocked(owner, visitor)).isTrue();
        assertThat(guard.canView(user(visitor, ProfileType.PESSOAL, AccountStatus.ACTIVE), owner, Visibility.PUBLIC)).isFalse();
        assertThat(guard.blocked(owner, owner)).isFalse();
        assertThat(guard.blocked(null, owner)).isFalse();
    }

    @Test
    void seguidorAceitoContinuaVendoConteudoDeSeguidores() {
        relation(visitor, owner, FollowStatus.ACEITO);
        assertThat(guard.canView(user(visitor, ProfileType.PESSOAL, AccountStatus.ACTIVE), owner, Visibility.FOLLOWERS)).isTrue();
    }

    @Test
    void comercioExigePerfilInstitucionalAprovadoEAtivo() {
        assertThatCode(() -> guard.requireApprovedInstitutional(user(owner, ProfileType.MARCA, AccountStatus.ACTIVE), "coupons", "x"))
                .doesNotThrowAnyException();
        assertThatCode(() -> guard.requireApprovedInstitutional(user(owner, ProfileType.CELEBRIDADE, AccountStatus.ACTIVE), "coupons", "x"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.requireApprovedInstitutional(user(owner, ProfileType.MARCA, AccountStatus.PENDING_VALIDATION), "coupons", "x"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("PERFIL_EM_VALIDACAO");
        assertThatThrownBy(() -> guard.requireApprovedInstitutional(user(owner, ProfileType.PESSOAL, AccountStatus.ACTIVE), "coupons", "x"))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThatThrownBy(() -> guard.requireApprovedInstitutional(user(owner, ProfileType.MARCA, AccountStatus.SUSPENDED), "coupons", "x"))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThatThrownBy(() -> guard.requireApprovedInstitutional(null, "coupons", "x"))
                .isInstanceOf(ApiException.class).extracting("status").isEqualTo(401);
    }
}
