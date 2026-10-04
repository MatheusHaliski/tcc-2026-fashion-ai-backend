package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Acesso direto por id respeita a mesma regra das listagens: visibilidade do conteúdo × privacidade do perfil do dono,
 * moderação e bloqueio (em qualquer direção) — no detalhe da peça, no retrato de peça arquivada, no "adicionar ao meu
 * guarda-roupa", nas interações/contadores e nos agrupamentos do perfil.
 */
class VisibilityRulesTest {
    private final UUID ownerId = UUID.randomUUID();
    private final UUID viewerId = UUID.randomUUID();
    private final CurrentUser viewer = new CurrentUser(viewerId, "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private User owner;
    private WardrobeItem piece;
    private FollowRepository follows;
    private WardrobeItemRepository pieces;
    private SchemeItemRepository schemeItems;
    private NotificationService notifications;
    private WardrobeService wardrobe;
    private SocialService social;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.assignId(ownerId);
        owner.setUsername("dona");
        owner.setProfileType(ProfileType.PESSOAL);
        owner.setStatus(AccountStatus.ACTIVE);
        owner.setProfileVisibility(Visibility.PUBLIC);
        piece = new WardrobeItem();
        piece.assignId(UUID.randomUUID());
        piece.setUser(owner);
        piece.setName("Jaqueta");
        piece.setVisibility(Visibility.PUBLIC);
        piece.setModerationStatus(ModerationStatus.APPROVED);

        follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        Guard guard = new Guard(e -> {
        }, follows);
        pieces = mock(WardrobeItemRepository.class);
        when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece));
        schemeItems = mock(SchemeItemRepository.class);
        notifications = mock(NotificationService.class);
        wardrobe = new WardrobeService(pieces, mock(UserRepository.class), null, null, null, null, null, schemeItems, null, null,
                null, null, null, null, null, null, null, notifications, null, null, null, guard, null, null, null, null, null, null, null, null);
        social = new SocialService(null, null, null, null, null, pieces, null, null, null, null, notifications, null, null, guard, null);
    }

    private void blockedByOwner() {
        Follow f = new Follow();
        f.setStatus(FollowStatus.BLOQUEADO);
        when(follows.findByFollowerIdAndFollowingId(ownerId, viewerId)).thenReturn(Optional.of(f));
    }

    private static int status(Throwable e) {
        return ((ApiException) e).status();
    }

    @Test
    void pecaEmModeracaoNaoAbreParaOutros() {
        piece.setModerationStatus(ModerationStatus.PENDING);
        assertThatThrownBy(() -> wardrobe.detail(null, piece.getId(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(404));
        assertThatThrownBy(() -> wardrobe.detail(viewer, piece.getId(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(404));
    }

    @Test
    void retratoDePecaArquivadaRespeitaOPerfilPrivado() {
        piece.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        owner.setProfileVisibility(Visibility.PRIVATE);
        assertThatThrownBy(() -> wardrobe.detail(null, piece.getId(), UUID.randomUUID())).satisfies(e -> assertThat(status(e)).isEqualTo(403));
    }

    @Test
    void retratoDePecaArquivadaSoSaiDeLookVisivel() {
        piece.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        Scheme look = new Scheme();
        look.assignId(UUID.randomUUID());
        look.setUser(owner);
        look.setVisibility(Visibility.PRIVATE);
        SchemeItem si = new SchemeItem();
        si.setScheme(look);
        si.setWardrobeItem(piece);
        si.setSnapshotJson(Json.write(Map.of("name", "Retrato do look")));
        when(schemeItems.findBySchemeIdOrderBySortOrder(look.getId())).thenReturn(List.of(si));

        Map<String, Object> hidden = wardrobe.detail(null, piece.getId(), look.getId());
        assertThat(((Map<?, ?>) hidden.get("snapshot")).get("name")).isEqualTo("Jaqueta");   // look privado: sem o retrato dele

        look.setVisibility(Visibility.PUBLIC);
        Map<String, Object> shown = wardrobe.detail(null, piece.getId(), look.getId());
        assertThat(((Map<?, ?>) shown.get("snapshot")).get("name")).isEqualTo("Retrato do look");
    }

    @Test
    void bloqueadoNaoAbrePecaPublicaPeloId() {
        blockedByOwner();
        assertThatThrownBy(() -> wardrobe.detail(viewer, piece.getId(), null)).satisfies(e -> assertThat(status(e)).isEqualTo(403));
        verify(pieces, never()).touchView(any(), org.mockito.ArgumentMatchers.anyLong(), any());
    }

    @Test
    void copiarPecaRespeitaAPrivacidadeDoPerfilDoDono() {
        owner.setProfileVisibility(Visibility.PRIVATE);                       // a peça é "pública", o perfil não
        assertThatThrownBy(() -> wardrobe.addToWardrobe(viewer, piece.getId())).satisfies(e -> assertThat(status(e)).isEqualTo(403));
        owner.setProfileVisibility(Visibility.PUBLIC);
        piece.setModerationStatus(ModerationStatus.REJECTED_POLICY);
        assertThatThrownBy(() -> wardrobe.addToWardrobe(viewer, piece.getId())).satisfies(e -> assertThat(status(e)).isEqualTo(404));
    }

    @Test
    void contadoresEInteracoesSeguemAVisibilidadeDoConteudo() {
        owner.setProfileVisibility(Visibility.PRIVATE);
        assertThatThrownBy(() -> social.counters(null, TargetType.PIECE, piece.getId())).satisfies(e -> assertThat(status(e)).isEqualTo(403));
    }

    @Test
    void bloqueadoNaoComentaNemNotificaQuemBloqueou() {
        blockedByOwner();
        assertThatThrownBy(() -> social.comment(viewer, TargetType.PIECE, piece.getId(), "oi", null))
                .satisfies(e -> assertThat(status(e)).isEqualTo(403));
        verifyNoInteractions(notifications);
    }

    @Test
    void agrupamentosDePerfilPrivadoNaoExpoemNomes() {
        owner.setProfileVisibility(Visibility.PRIVATE);
        UserRepository users = mock(UserRepository.class);
        when(users.findById(ownerId)).thenReturn(Optional.of(owner));
        SchemeRepository schemes = mock(SchemeRepository.class);
        SchemeGroupingRepository groupings = mock(SchemeGroupingRepository.class);
        SchemeGrouping g = new SchemeGrouping();
        g.assignId(UUID.randomUUID());
        g.setOwner(owner);
        g.setType(GroupingType.COLLECTION);
        g.setLabel("Coleção secreta");
        when(groupings.findByOwnerIdOrderByCreatedAtDesc(ownerId)).thenReturn(List.of(g));
        Guard guard = new Guard(e -> {
        }, follows);
        LookbookService lookbook = new LookbookService(schemes, null, null, null, users, null, groupings, null, null, null, null, null, null,
                guard, null);

        assertThat(lookbook.groupingsOf(null, ownerId)).isEmpty();
        assertThat(lookbook.groupingsOf(viewer, ownerId)).isEmpty();
        CurrentUser self = new CurrentUser(ownerId, "dona", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        assertThat(lookbook.groupingsOf(self, ownerId)).extracting(m -> m.get("label")).containsExactly("Coleção secreta");
    }
}
