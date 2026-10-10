package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF17 — perfil de terceiros: cabeçalho (avatar, @, bio, seguidores/seguindo, publicações), grade de publicações
 * conforme a visibilidade (CA02: "somente seguidores" mostra só o cabeçalho com convite), seguir/deixar de seguir com
 * contadores consistentes (CA03/CA04), pedidos de seguir para contas privadas e layout institucional para Marca e
 * Celebridade (CA06).
 * <p>
 * Lookbook › Looks com ordenação pelo HypeScore v2 (P3-02, {@link #publishedLooks}): o dono ordena pelo Hype pessoal;
 * quem visita, só pelo Hype público elegível (look privado ou só para seguidores fica "sem Hype", por último).
 */
@Service
public class ProfileService {
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final FollowRepository follows;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final SchemeService schemeService;
    private final NotificationService notifications;
    private final Guard guard;
    /** HypeScore v2 (estado gravado pelo job; aqui só leitura — GET nunca recalcula). */
    private final HypeScoreCurrentRepository hypeV2;
    private final HypeScoreConfig hypeV2Config;

    public ProfileService(UserRepository users, FollowRepository follows, SchemeRepository schemes, SchemeItemRepository schemeItems,
                          WardrobeItemRepository pieces, SchemeService schemeService, NotificationService notifications, Guard guard,
                          HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config,
                          BrandProfileRepository brands, CelebrityProfileRepository celebrities) {
        this.brands = brands;
        this.celebrities = celebrities;
        this.hypeV2 = hypeV2;
        this.hypeV2Config = hypeV2Config;
        this.users = users;
        this.follows = follows;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.schemeService = schemeService;
        this.notifications = notifications;
        this.guard = guard;
    }

    User resolve(String idOrUsername) {
        Optional<User> u;
        try {
            u = users.findById(UUID.fromString(idOrUsername));
        } catch (IllegalArgumentException ex) {
            u = users.findByUsernameIgnoreCase(idOrUsername.startsWith("@") ? idOrUsername.substring(1) : idOrUsername);
        }
        return u.filter(x -> x.getStatus() != AccountStatus.DELETED && x.getStatus() != AccountStatus.DELETION_SCHEDULED)
                .orElseThrow(() -> ApiException.notFound("Perfil"));
    }

    FollowStatus relation(UUID viewer, UUID target) {
        return follows.findByFollowerIdAndFollowingId(viewer, target).map(Follow::getStatus).orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> profile(CurrentUser viewer, String idOrUsername) {
        return profile(viewer, idOrUsername, null);
    }

    /**
     * Perfil com a grade de looks publicados ordenada ({@code sort}: recent (padrão) · hype_desc · hype_asc · growth —
     * {@link LookbookService#lookSort}). Sem {@code sort}, a resposta é a mesma de sempre (mais recentes primeiro).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> profile(CurrentUser viewer, String idOrUsername, String sort) {
        User u = resolve(idOrUsername);
        boolean self = viewer != null && viewer.id().equals(u.getId());
        if (!self && viewer != null && relation(u.getId(), viewer.id()) == FollowStatus.BLOQUEADO) {
            throw ApiException.notFound("Perfil");
        }
        FollowStatus rel = self || viewer == null ? null : relation(viewer.id(), u.getId());
        boolean canSee = self || guard.canView(viewer, u.getId(), u.getProfileVisibility());
        List<Scheme> published = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", Views.user(u));
        out.put("bio", u.getBio());
        out.put("pronouns", u.getPronouns());
        out.put("links", Json.list(u.getLinksJson()));
        out.put("coverUrl", u.getCoverUrl());
        out.put("layout", u.getProfileType() == ProfileType.PESSOAL ? "PESSOAL" : "INSTITUCIONAL");
        if (u.getProfileType() == ProfileType.MARCA) {
            out.put("institutionalSlug", brands.findByOwnerId(u.getId()).map(b -> b.getSlug()).orElse(u.getId().toString()));
        } else if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            out.put("institutionalSlug", celebrities.findByOwnerId(u.getId()).map(c -> c.getSlug()).orElse(u.getId().toString()));
        }
        out.put("self", self);
        out.put("relation", rel == null ? "NENHUMA" : rel.name());
        out.put("counters", counters(u.getId(), published.size()));
        out.put("visibility", u.getProfileVisibility().name());
        out.put("contentVisible", canSee);
        if (!canSee) {
            out.put("invite", Map.of("message", u.getProfileVisibility() == Visibility.FOLLOWERS
                    ? Msg.t("profile.este_perfil_mostra_as_publicacoes") : Msg.t("profile.perfil_privado"), "action", "SEGUIR"));
            out.put("schemes", List.of());
            out.put("pieces", List.of());
            return out;
        }
        String order = LookbookService.lookSort(sort);
        out.put("schemes", publishedLooks(viewer, u, self, published, order).stream()
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        out.put("sort", order);
        out.put("pieces", pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> self || guard.canView(viewer, u.getId(), SchemeService.moreRestrictive(w.getVisibility(), u.getProfileVisibility())))
                .limit(60).map(w -> Views.piece(w, null, null)).toList());
        return out;
    }

    /**
     * Looks publicados que quem vê pode ver (até 60), na ordem pedida. Pelo Hype: o dono usa o próprio Hype pessoal;
     * terceiros, só o público elegível. Sem Hype = por último (nunca 0); empate segue a ordem recente.
     */
    List<Scheme> publishedLooks(CurrentUser viewer, User owner, boolean self, List<Scheme> published, String order) {
        List<Scheme> visible = published.stream()
                .filter(s -> self || guard.canView(viewer, owner.getId(), SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility())))
                .toList();
        if ("recent".equals(order)) {
            return visible.stream().limit(60).toList();
        }
        Map<UUID, HypeScoreCurrent> h = LookbookService.rankable(LookbookService.hypeV2Of(hypeV2, hypeV2Config, HypeEntityType.SCHEME,
                visible.stream().map(Scheme::getId).toList()), viewer == null ? null : viewer.id());
        // a lista chega da mais recente para a mais antiga: o sort estável mantém essa ordem nos empates
        return visible.stream().sorted(LookbookService.<Scheme>hypeOrder(order, s -> h.get(s.getId()))).limit(60).toList();
    }

    /** Header do perfil (estilo Instagram, RF14/RF22): seguidores, seguindo, peças e esquemas criados. */
    public Map<String, Object> counters(UUID userId, long published) {
        return Map.of("followers", follows.countByFollowingIdAndStatus(userId, FollowStatus.ACEITO),
                "following", follows.countByFollowerIdAndStatus(userId, FollowStatus.ACEITO), "published", published,
                "pieces", pieces.countByUserIdAndAvailabilityStatusNot(userId, AvailabilityStatus.ARCHIVED),
                "schemes", schemes.countByUserIdAndStatusNot(userId, SchemeStatus.ARCHIVED));
    }

    /** CA03 — seguir: conta pública vira ACEITO na hora; privada/restrita vira pedido PENDENTE. */
    @Transactional
    public Map<String, Object> follow(CurrentUser viewer, UUID targetId) {
        if (viewer.id().equals(targetId)) {
            throw ApiException.badRequest("SEGUIR_A_SI", Msg.t("profile.voce_nao_pode_seguir_a"));
        }
        User target = users.findById(targetId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (relation(targetId, viewer.id()) == FollowStatus.BLOQUEADO) {
            throw ApiException.notFound("Perfil");
        }
        Follow f = follows.findByFollowerIdAndFollowingId(viewer.id(), targetId).orElseGet(() -> {
            Follow n = new Follow();
            n.setFollower(users.findById(viewer.id()).orElseThrow());
            n.setFollowing(target);
            return n;
        });
        if (f.getStatus() == FollowStatus.ACEITO && f.getId() != null) {
            return state(viewer.id(), targetId);
        }
        boolean needsApproval = target.isPrivateAccount() && target.getProfileVisibility() != Visibility.PUBLIC
                && target.getProfileType() == ProfileType.PESSOAL;
        f.setStatus(needsApproval ? FollowStatus.PENDENTE : FollowStatus.ACEITO);
        follows.save(f);
        notifications.notify(targetId, viewer.id(), needsApproval ? NotificationType.FOLLOW_REQUEST : NotificationType.NEW_FOLLOWER, "USER", viewer.id(),
                needsApproval ? Msg.k("profile.quer_seguir_voce", viewer.username()) : Msg.k("profile.comecou_a_seguir_voce", viewer.username()), null, Map.of());
        return state(viewer.id(), targetId);
    }

    /** CA04 — deixar de seguir: remove o vínculo; nenhuma notificação. */
    @Transactional
    public Map<String, Object> unfollow(CurrentUser viewer, UUID targetId) {
        follows.findByFollowerIdAndFollowingId(viewer.id(), targetId).filter(f -> f.getStatus() != FollowStatus.BLOQUEADO).ifPresent(follows::delete);
        return state(viewer.id(), targetId);
    }

    Map<String, Object> state(UUID viewerId, UUID targetId) {
        FollowStatus rel = relation(viewerId, targetId);
        return Map.of("relation", rel == null ? "NENHUMA" : rel.name(),
                "followers", follows.countByFollowingIdAndStatus(targetId, FollowStatus.ACEITO),
                "following", follows.countByFollowerIdAndStatus(targetId, FollowStatus.ACEITO));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requests(CurrentUser user) {
        return follows.findByFollowingIdAndStatus(user.id(), FollowStatus.PENDENTE).stream()
                .map(f -> Map.<String, Object>of("id", f.getId(), "user", Views.user(f.getFollower()), "at", f.getCreatedAt())).toList();
    }

    @Transactional
    public Map<String, Object> respond(CurrentUser user, UUID followId, boolean accept) {
        Follow f = follows.findById(followId).orElseThrow(() -> ApiException.notFound("Pedido"));
        guard.requireOwner(user, f.getFollowing().getId(), "follow:" + followId);
        if (f.getStatus() != FollowStatus.PENDENTE) {
            throw new ApiException(409, "PEDIDO_RESPONDIDO", Msg.t("profile.este_pedido_ja_foi_respondido"));
        }
        if (accept) {
            f.setStatus(FollowStatus.ACEITO);
            f.setRespondedAt(Instant.now());
            follows.save(f);
            notifications.notify(f.getFollower().getId(), user.id(), NotificationType.FOLLOW_ACCEPTED, "USER", user.id(),
                    Msg.k("profile.aceitou_seu_pedido", user.username()), null, Map.of());
        } else {
            follows.delete(f);
        }
        return Map.of("accepted", accept);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> connections(CurrentUser viewer, UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (!viewer.id().equals(userId) && !guard.canView(viewer, userId, u.getProfileVisibility())) {
            throw guard.deny(viewer, "connections:" + userId, Msg.t("profile.as_conexoes_deste_perfil_nao"));
        }
        return Map.of("followers", follows.findByFollowingIdAndStatus(userId, FollowStatus.ACEITO).stream().map(f -> Views.user(f.getFollower())).toList(),
                "following", follows.findByFollowerIdAndStatus(userId, FollowStatus.ACEITO).stream().map(f -> Views.user(f.getFollowing())).toList());
    }

    /** Bloquear: o bloqueado não vê o perfil nem pode seguir; vínculos anteriores são desfeitos. */
    @Transactional
    public Map<String, Object> block(CurrentUser user, UUID targetId, boolean block) {
        if (user.id().equals(targetId)) {
            throw ApiException.badRequest("BLOQUEIO_INVALIDO", Msg.t("profile.voce_nao_pode_bloquear_a"));
        }
        User target = users.findById(targetId).orElseThrow(() -> ApiException.notFound("Perfil"));
        follows.findByFollowerIdAndFollowingId(targetId, user.id()).ifPresent(follows::delete);
        Optional<Follow> mine = follows.findByFollowerIdAndFollowingId(user.id(), targetId);
        if (block) {
            Follow f = mine.orElseGet(() -> {
                Follow n = new Follow();
                n.setFollower(users.findById(user.id()).orElseThrow());
                n.setFollowing(target);
                return n;
            });
            f.setStatus(FollowStatus.BLOQUEADO);
            follows.save(f);
        } else {
            mine.filter(f -> f.getStatus() == FollowStatus.BLOQUEADO).ifPresent(follows::delete);
        }
        return Map.of("blocked", block);
    }
}
