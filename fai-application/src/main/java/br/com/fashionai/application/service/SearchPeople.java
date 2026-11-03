package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService.PersonProfile;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.PublicPersonHeader;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Aba Pessoas: cabeçalho público de cada perfil, a relação com quem vê e os contadores da página em lote. */
final class SearchPeople {
    private final FollowRepository follows;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;

    SearchPeople(FollowRepository follows, WardrobeItemRepository pieces, SchemeRepository schemes) {
        this.follows = follows;
        this.pieces = pieces;
        this.schemes = schemes;
    }

    /** Quatro consultas de contadores por página, em vez de quatro consultas para cada pessoa. */
    List<PersonProfile> personProfiles(CurrentUser viewer, List<PublicPersonHeader> page) {
        if (page.isEmpty()) return List.of();
        List<UUID> ids = page.stream().map(PublicPersonHeader::getId).toList();
        Map<UUID, Long> followers = groupedCounts(follows.countFollowersByIds(ids, FollowStatus.ACEITO));
        Map<UUID, Long> following = groupedCounts(follows.countFollowingByIds(ids, FollowStatus.ACEITO));
        Map<UUID, Long> wardrobe = groupedCounts(pieces.countByUserIdsAndAvailabilityStatusNot(ids, AvailabilityStatus.ARCHIVED));
        Map<UUID, Long> looks = groupedCounts(schemes.countByUserIdsAndStatusNot(ids, SchemeStatus.ARCHIVED));
        Map<UUID, FollowStatus> relations = viewer == null ? Map.of() : follows.findByFollowerIdAndFollowingIdIn(viewer.id(), ids).stream()
                .collect(Collectors.toMap(f -> f.getFollowing().getId(), f -> f.getStatus()));
        return page.stream().map(u -> {
            FollowStatus relation = relations.get(u.getId());
            boolean self = viewer != null && viewer.id().equals(u.getId());
            Visibility visibility = u.getProfileVisibility() == null ? Visibility.PRIVATE : u.getProfileVisibility();
            boolean contentVisible = self || visibility == Visibility.PUBLIC
                    || (visibility == Visibility.FOLLOWERS && relation == FollowStatus.ACEITO);
            return new PersonProfile(u.getId(), u.getUsername(), u.getDisplayName(), u.getAvatarUrl(), u.getProfileType().name(),
                    u.isVerified(), u.getCountry(), u.isPrivateAccount(), u.getCoverUrl(), u.getBio(), u.getPronouns(),
                    Json.list(u.getLinksJson()), visibility.name(), contentVisible, self ? "SELF" : relation == null ? "NENHUMA" : relation.name(),
                    Map.of("followers", followers.getOrDefault(u.getId(), 0L), "following", following.getOrDefault(u.getId(), 0L),
                            "pieces", wardrobe.getOrDefault(u.getId(), 0L), "schemes", looks.getOrDefault(u.getId(), 0L)));
        }).toList();
    }

    private static Map<UUID, Long> groupedCounts(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> ((Number) r[1]).longValue()));
    }
}
