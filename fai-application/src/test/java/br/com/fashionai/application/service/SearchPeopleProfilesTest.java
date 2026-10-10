package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchPeopleProfilesTest {
    UserRepository users;
    FollowRepository follows;
    SchemeRepository schemes;
    WardrobeItemRepository pieces;
    SearchService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        users = mock(UserRepository.class);
        follows = mock(FollowRepository.class);
        schemes = mock(SchemeRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        service = new SearchService(schemes, mock(SchemeItemRepository.class), pieces, users, mock(BrandProfileRepository.class),
                mock(CelebrityProfileRepository.class), follows, mock(ShareRepository.class), mock(SealBondRepository.class),
                mock(StyleDnaRepository.class), (ObjectProvider<SearchIndexPort>) mock(ObjectProvider.class),
                (ObjectProvider<TimelineProjectionPort>) mock(ObjectProvider.class), mock(SchemeService.class), mock(ChallengeService.class),
                mock(Guard.class), mock(BrandRepository.class), mock(HypeScoreCurrentRepository.class), HypeScoreConfig.defaults());
    }

    private User person(String username, Visibility visibility) {
        User u = new User(username, "Nome " + username, "secret@example.com", "secret-hash", "password-hash", ProfileType.PESSOAL);
        u.assignId(UUID.randomUUID());
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(visibility);
        u.setPrivateAccount(visibility != Visibility.PUBLIC);
        return u;
    }

    @Test
    void exposesPublicHeaderFieldsAndAggregatesWithoutAccountSecretsOrPrivateContent() {
        User u = person("ana", Visibility.PUBLIC);
        u.setAvatarUrl("/photos/ana.jpg");
        u.setCoverUrl("/photos/cover.jpg");
        u.setBio("Designer de moda\nAteliê independente");
        u.setPronouns("ela/dela");
        u.setCountry("BR");
        u.setVerified(true);
        u.setPhone("secret-phone");
        u.setBirthDate("secret-birthday");
        u.setLinksJson("[{\"title\":\"Portfólio\",\"url\":\"https://atelier.example\"}]");
        when(follows.countFollowersByIds(anyCollection(), eq(FollowStatus.ACEITO))).thenReturn(List.<Object[]>of(new Object[]{u.getId(), 123L}));
        when(follows.countFollowingByIds(anyCollection(), eq(FollowStatus.ACEITO))).thenReturn(List.<Object[]>of(new Object[]{u.getId(), 4L}));
        when(pieces.countByUserIdsAndAvailabilityStatusNot(anyCollection(), eq(AvailabilityStatus.ARCHIVED))).thenReturn(List.<Object[]>of(new Object[]{u.getId(), 8L}));
        when(schemes.countByUserIdsAndStatusNot(anyCollection(), eq(SchemeStatus.ARCHIVED))).thenReturn(List.<Object[]>of(new Object[]{u.getId(), 12L}));

        var profile = service.personProfiles(null, List.of(u)).getFirst();

        assertThat(profile.bio()).isEqualTo(u.getBio());
        assertThat(profile.coverUrl()).isEqualTo(u.getCoverUrl());
        assertThat(profile.pronouns()).isEqualTo("ela/dela");
        assertThat(profile.links()).containsExactly(Map.of("title", "Portfólio", "url", "https://atelier.example"));
        assertThat(profile.verified()).isTrue();
        assertThat(profile.contentVisible()).isTrue();
        assertThat(profile.counters()).containsExactlyInAnyOrderEntriesOf(Map.of("followers", 123L, "following", 4L, "pieces", 8L, "schemes", 12L));
        assertThat(Json.write(profile)).doesNotContain("secret", "password", "email", "phone", "birthDate", "schemes\": [", "wardrobeItem");
        verify(schemes, never()).findByUserIdOrderByCreatedAtDesc(any());
        verify(pieces, never()).findByUserIdOrderByCreatedAtDesc(any());
    }

    @Test
    void privateProfilesExposeOnlyTheirPublicHeaderAndMarkPostsRestricted() {
        User u = person("privada", Visibility.PRIVATE);
        u.setBio("Bio pública do cabeçalho");
        var profile = service.personProfiles(null, List.of(u)).getFirst();
        assertThat(profile.visibility()).isEqualTo("PRIVATE");
        assertThat(profile.contentVisible()).isFalse();
        assertThat(profile.bio()).isEqualTo(u.getBio());
        assertThat(profile.counters().values()).containsOnly(0L);
        verify(follows, never()).findByFollowerIdAndFollowingIdIn(any(), anyCollection());
    }

    @Test
    void followerAccessRequiresAcceptedRelationshipAndPrivateProfilesRemainRestricted() {
        User viewer = person("viewer", Visibility.PUBLIC);
        User accepted = person("accepted", Visibility.FOLLOWERS);
        User pending = person("pending", Visibility.FOLLOWERS);
        User privateUser = person("private", Visibility.PRIVATE);
        when(follows.findByFollowerIdAndFollowingIdIn(eq(viewer.getId()), anyCollection())).thenReturn(List.of(
                new Follow(viewer, accepted, FollowStatus.ACEITO), new Follow(viewer, pending, FollowStatus.PENDENTE),
                new Follow(viewer, privateUser, FollowStatus.ACEITO)));
        var profiles = service.personProfiles(CurrentUser.of(viewer, "127.0.0.1", "test"), List.of(accepted, pending, privateUser, viewer));
        assertThat(profiles).extracting(SearchService.PersonProfile::contentVisible).containsExactly(true, false, false, true);
        assertThat(profiles).extracting(SearchService.PersonProfile::relation).containsExactly("ACEITO", "PENDENTE", "ACEITO", "SELF");
    }

    @Test
    void batchesCountsForTheCurrentPageOnlyAndKeepsCursorWithoutDuplicates() {
        List<User> candidates = IntStream.range(0, 7).mapToObj(i -> person("pessoa" + i, Visibility.PUBLIC)).toList();
        when(users.searchPersonalProfiles(anyString(), anyBoolean(), anyCollection(), any())).thenReturn(candidates);
        var out = service.search(null, "pessoa", "PESSOAS", null, 3, SearchService.encodeOffset(3));
        @SuppressWarnings("unchecked") var profiles = (List<SearchService.PersonProfile>) out.get("results");
        assertThat(profiles).extracting(SearchService.PersonProfile::id).containsExactly(candidates.get(3).getId(), candidates.get(4).getId(), candidates.get(5).getId());
        assertThat(out.get("nextCursor")).isEqualTo(SearchService.encodeOffset(6));
        List<UUID> pageIds = profiles.stream().map(SearchService.PersonProfile::id).toList();
        verify(follows, times(1)).countFollowersByIds(pageIds, FollowStatus.ACEITO);
        verify(follows, times(1)).countFollowingByIds(pageIds, FollowStatus.ACEITO);
        verify(pieces, times(1)).countByUserIdsAndAvailabilityStatusNot(pageIds, AvailabilityStatus.ARCHIVED);
        verify(schemes, times(1)).countByUserIdsAndStatusNot(pageIds, SchemeStatus.ARCHIVED);
        verify(follows, never()).countByFollowingIdAndStatus(any(), any());
        verify(follows, never()).countByFollowerIdAndStatus(any(), any());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(users).searchPersonalProfiles(eq("pessoa"), eq(false), anyCollection(), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(7);
    }

    @Test
    void passesBlocksInBothDirectionsIntoTheSearchBeforePagination() {
        User viewer = person("viewer", Visibility.PUBLIC);
        User first = person("blockedByViewer", Visibility.PUBLIC);
        User second = person("blockedViewer", Visibility.PUBLIC);
        when(follows.findByFollowerIdAndStatus(viewer.getId(), FollowStatus.BLOQUEADO)).thenReturn(List.of(new Follow(viewer, first, FollowStatus.BLOQUEADO)));
        when(follows.findByFollowingIdAndStatus(viewer.getId(), FollowStatus.BLOQUEADO)).thenReturn(List.of(new Follow(second, viewer, FollowStatus.BLOQUEADO)));
        when(users.searchPersonalProfiles(anyString(), anyBoolean(), anyCollection(), any())).thenReturn(List.of(person("normal", Visibility.PUBLIC)));
        service.search(CurrentUser.of(viewer, "127.0.0.1", "test"), "", "PESSOAS", null, 24);
        verify(users).searchPersonalProfiles(eq(""), eq(false), argThat(ids -> ids.size() == 2 && ids.containsAll(List.of(first.getId(), second.getId()))), any());
    }

    @Test
    void demoAccountsAreVisibleOnlyInTestSessionsAndEmptyPagesDoNotCount() {
        User viewer = person("demo_viewer", Visibility.PUBLIC);
        when(users.searchPersonalProfiles(anyString(), anyBoolean(), anyCollection(), any())).thenReturn(List.of());
        service.search(CurrentUser.of(viewer, "127.0.0.1", "test"), "", "PESSOAS", null, 24);
        verify(users).searchPersonalProfiles(eq(""), eq(true), anyCollection(), any());
        verify(follows, never()).countFollowersByIds(anyCollection(), any());
        verify(pieces, never()).countByUserIdsAndAvailabilityStatusNot(anyCollection(), any());
    }
}
