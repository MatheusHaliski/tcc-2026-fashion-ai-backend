package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF19.CA13 · Remixar peça: leva ao criador de looks com a peça; a dona remixa a própria peça mesmo indisponível. */
class PieceRemixTest {
    private final UUID ownerId = UUID.randomUUID();
    private final CurrentUser owner = new CurrentUser(ownerId, "dona", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final CurrentUser other = new CurrentUser(UUID.randomUUID(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private WardrobeItem piece;
    private SocialService social;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.assignId(ownerId);
        u.setUsername("dona");
        u.setProfileType(ProfileType.PESSOAL);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        piece = new WardrobeItem();
        piece.assignId(UUID.randomUUID());
        piece.setUser(u);
        piece.setName("Body multicolorido");
        piece.setVisibility(Visibility.PUBLIC);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        FollowRepository follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece));
        social = new SocialService(null, null, null, null, null, pieces, null, null, null, null, mock(NotificationService.class),
                mock(CounterStorePort.class), null, new Guard(e -> {
                }, follows), mock(ApplicationEventPublisher.class));
    }

    @Test
    void remixDePecaAbreOCriadorDeLooksComAPeca() {
        Map<String, Object> r = social.remix(other, TargetType.PIECE, piece.getId());
        assertThat(r.get("next")).isEqualTo("/schemes/new?pieces=" + piece.getId());   // rota que o scheme-builder lê
    }

    @Test
    void donaRemixaAPropriaPecaMesmoIndisponivel() {
        piece.markAvailable(false);
        assertThat(social.remix(owner, TargetType.PIECE, piece.getId()).get("next")).isEqualTo("/schemes/new?pieces=" + piece.getId());
        assertThatThrownBy(() -> social.remix(other, TargetType.PIECE, piece.getId()))
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(409));
    }
}
