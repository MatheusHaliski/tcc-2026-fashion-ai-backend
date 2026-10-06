package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF19.CA13 · Remixar peça: leva ao criador de looks com a peça; a dona remixa a própria peça mesmo indisponível. */
class PieceRemixTest {
    private final UUID ownerId = UUID.randomUUID();
    private final CurrentUser owner = new CurrentUser(ownerId, "dona", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final CurrentUser other = new CurrentUser(UUID.randomUUID(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private WardrobeItem piece;
    private SocialService social;
    private WardrobeService wardrobe;

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
        wardrobe = mock(WardrobeService.class);
        social = new SocialService(null, null, null, null, null, pieces, null, null, null, null, wardrobe, mock(NotificationService.class),
                mock(CounterStorePort.class), null, new Guard(e -> {
                }, follows), mock(ApplicationEventPublisher.class));
    }

    @Test
    void remixDePecaAlheiaImportaAPecaEAbreOCriadorComACopia() {
        UUID copyId = UUID.randomUUID();
        Views.PieceView copy = mock(Views.PieceView.class);
        when(copy.id()).thenReturn(copyId);
        when(wardrobe.eligible(other.id())).thenReturn(List.of());
        when(wardrobe.addToWardrobe(other, piece.getId())).thenReturn(copy);
        Map<String, Object> r = social.remix(other, TargetType.PIECE, piece.getId());
        // o scheme-builder só seleciona ids do acervo de quem compõe: a rota leva a cópia, não a peça de origem
        assertThat(r.get("next")).isEqualTo("/schemes/new?pieces=" + copyId);
        verify(wardrobe).addToWardrobe(other, piece.getId());
    }

    @Test
    void remixRepetidoReaproveitaACopiaJaImportada() {
        WardrobeItem existing = new WardrobeItem();
        existing.assignId(UUID.randomUUID());
        existing.setRemixedFromPieceId(piece.getId());
        when(wardrobe.eligible(other.id())).thenReturn(List.of(existing));
        assertThat(social.remix(other, TargetType.PIECE, piece.getId()).get("next")).isEqualTo("/schemes/new?pieces=" + existing.getId());
        verify(wardrobe, never()).addToWardrobe(any(), any());
    }

    @Test
    void remixDaPropriaPecaNaoImporta() {
        assertThat(social.remix(owner, TargetType.PIECE, piece.getId()).get("next")).isEqualTo("/schemes/new?pieces=" + piece.getId());
        verify(wardrobe, never()).addToWardrobe(any(), any());
    }

    @Test
    void donaRemixaAPropriaPecaMesmoIndisponivel() {
        piece.markAvailable(false);
        assertThat(social.remix(owner, TargetType.PIECE, piece.getId()).get("next")).isEqualTo("/schemes/new?pieces=" + piece.getId());
        assertThatThrownBy(() -> social.remix(other, TargetType.PIECE, piece.getId()))
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(409));
    }
}
