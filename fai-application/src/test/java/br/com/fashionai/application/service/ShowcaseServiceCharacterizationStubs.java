package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

/** Comportamento dos mocks do {@link ShowcaseServiceCharacterizationFixture}: repositórios em memória, dono/guarda como no serviço real. */
final class ShowcaseServiceCharacterizationStubs {
    private ShowcaseServiceCharacterizationStubs() {
    }

    private static boolean owner(CurrentUser v, User u) {
        return v != null && u != null && v.id().equals(u.getId());
    }

    static void apply(ShowcaseServiceCharacterizationFixture f) {
        when(f.schemes.findById(any())).thenAnswer(a -> f.looks.stream().filter(s -> s.getId().equals(a.getArgument(0))).findFirst());
        when(f.schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(any(), any())).thenAnswer(a -> f.looks.stream()
                .filter(s -> s.getUser().getId().equals(a.getArgument(0)) && s.getStatus() != a.getArgument(1))
                .sorted((x, y) -> y.getCreatedAt().compareTo(x.getCreatedAt())).toList());
        when(f.schemeItems.findBySchemeIdOrderBySortOrder(any())).thenAnswer(a -> f.itemsByScheme.getOrDefault(a.<UUID>getArgument(0), List.of()));
        when(f.pieces.findById(any())).thenAnswer(a -> f.items.stream().filter(w -> w.getId().equals(a.getArgument(0))).findFirst());
        when(f.pieces.findByUserIdOrderByCreatedAtDesc(any())).thenAnswer(a -> f.items.stream().filter(w -> w.getUser().getId().equals(a.getArgument(0)))
                .sorted((x, y) -> y.getCreatedAt().compareTo(x.getCreatedAt())).toList());
        when(f.groupings.findById(any())).thenAnswer(a -> f.groups.stream().filter(g -> g.getId().equals(a.getArgument(0))).findFirst());
        when(f.groupings.findByOwnerIdOrderByCreatedAtDesc(any())).thenAnswer(a -> f.groups.stream().filter(g -> g.getOwner().getId().equals(a.getArgument(0)))
                .sorted((x, y) -> y.getCreatedAt().compareTo(x.getCreatedAt())).toList());
        when(f.dailyLooks.findByLookDateGreaterThanEqual(any())).thenAnswer(a -> f.daily.subList(0, 3));
        when(f.dailyLooks.findByLookDate(any())).thenAnswer(a -> List.copyOf(f.daily));
        when(f.dailyLooks.findByUserIdAndLookDate(any(), any())).thenAnswer(a -> f.daily.stream()
                .filter(d -> d.getUser().getId().equals(a.getArgument(0))).findFirst());
        UserPreferences prefs = new UserPreferences(f.me);
        prefs.setMannequinSex(MannequinSex.MASCULINO);
        prefs.setMannequinSkinTone("#C68642");
        prefs.setMannequinBuild(BodyBuild.ATHLETIC);
        prefs.setMannequinFaceJson("{\"jaw\":0.4}");
        UserPreferences empty = new UserPreferences(f.quiet);
        when(f.preferences.findByUserId(any())).thenAnswer(a -> f.me.getId().equals(a.getArgument(0)) ? Optional.of(prefs)
                : f.quiet.getId().equals(a.getArgument(0)) ? Optional.of(empty) : Optional.empty());
        CelebrityProfile cp = new CelebrityProfile();
        cp.setOwner(f.celeb);
        cp.setAvatarUrl("/oficial/estrela.jpg");
        when(f.celebrities.findByOwnerId(any())).thenAnswer(a -> f.celeb.getId().equals(a.getArgument(0)) ? Optional.of(cp) : Optional.empty());
        when(f.schemeService.canView(any(), any())).thenAnswer(a -> {
            Scheme s = a.getArgument(1);
            return s.getVisibility() == Visibility.PUBLIC || owner(a.getArgument(0), s.getUser());
        });
        when(f.schemeService.owned(any(), any())).thenAnswer(a -> {
            Scheme s = f.looks.stream().filter(x -> x.getId().equals(a.getArgument(1))).findFirst().orElseThrow(() -> ApiException.notFound("Esquema"));
            if (!owner(a.getArgument(0), s.getUser())) {
                throw ApiException.forbidden("Somente o dono");
            }
            return s;
        });
        when(f.schemeService.view(any(), any(), any())).thenAnswer(a -> SearchServiceCharacterizationFixture.view(a.getArgument(1)));
        when(f.institutional.institutionalUser(anyString())).thenAnswer(a -> f.people.stream().filter(u -> u.getUsername().equals(a.getArgument(0)))
                .findFirst().orElseThrow(() -> ApiException.notFound("Perfil")));
        when(f.model3d.request(any())).thenAnswer(a -> {
            WardrobeItem w = a.getArgument(0);
            if (w.getModel3dStatus() == Model3dStatus.FAILED) {
                throw ApiException.badRequest("SEM_RECORTE", "Sem recorte");
            }
            return Map.of("id", w.getId());
        });
        doAnswer(a -> {
            if (!owner(a.getArgument(0), f.people.stream().filter(u -> u.getId().equals(a.getArgument(1))).findFirst().orElse(null))) {
                throw ApiException.forbidden("Somente o dono");
            }
            return null;
        }).when(f.guard).requireOwner(any(), any(), anyString());
        doAnswer(a -> {
            if (a.getArgument(2) == Visibility.PRIVATE && !(a.getArgument(0) instanceof CurrentUser v && v.id().equals(a.getArgument(1)))) {
                throw ApiException.notFound("Recurso");
            }
            return null;
        }).when(f.guard).requireView(any(), any(), any(), anyString());
        when(f.guard.canView(any(), any(), any())).thenAnswer(a -> a.getArgument(2) == Visibility.PUBLIC
                || a.getArgument(0) instanceof CurrentUser v && v.id().equals(a.getArgument(1)));
        when(f.avatars3d.forMannequin(any(), any())).thenAnswer(a -> f.celeb.getId().equals(a.getArgument(0)) || f.me.getId().equals(a.getArgument(1))
                && f.me.getId().equals(a.getArgument(0)) ? Optional.of(Map.of("glbUrl", "/avatar/" + a.getArgument(0) + ".glb")) : Optional.empty());
        when(f.users.findById(any())).thenAnswer(a -> f.people.stream().filter(u -> u.getId().equals(a.getArgument(0))).findFirst());
        when(f.media.put(anyString(), any(), anyString())).thenAnswer(a -> {
            String key = a.<String>getArgument(0).replaceAll("-\\d{13}\\.jpg$", "-<ms>.jpg");
            f.stored.add(key + " " + br.com.fashionai.application.testkit.Portrait.sha(a.getArgument(1)) + " " + a.getArgument(2));
            return new MediaStoragePort.StoredObject(key, "/media/" + key, 10, a.getArgument(2));
        });
        when(f.follows.findByFollowerIdAndStatus(eq(f.me.getId()), eq(FollowStatus.ACEITO))).thenReturn(List.of(new Follow(f.me, f.ana, FollowStatus.ACEITO)));
        when(f.hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return f.rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
    }
}
