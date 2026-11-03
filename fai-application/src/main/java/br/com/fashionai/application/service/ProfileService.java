package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
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
    private LevelProgressService levelProgress;
    @org.springframework.beans.factory.annotation.Autowired
    public void setLevelProgress(LevelProgressService progress) { this.levelProgress = progress; }

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
    /** Seguir, pedidos, conexões e bloqueio (colaborador package-private; este serviço é a fachada). */
    private final ProfileConnections connections;

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
        this.connections = new ProfileConnections(users, follows, notifications, guard);
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
        return connections.relation(viewer, target);
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
        out.put("visibility", u.getProfileVisibility().name());
        out.put("contentVisible", canSee);
        if (self) {
            out.put("pendingFollowRequests", follows.countByFollowingIdAndStatus(u.getId(), FollowStatus.PENDENTE));
        }
        if (!canSee) {
            // sem acesso, os contadores de peças e looks ficam de fora: contariam itens privados e rascunhos
            out.put("counters", Map.of("followers", follows.countByFollowingIdAndStatus(u.getId(), FollowStatus.ACEITO),
                    "following", follows.countByFollowerIdAndStatus(u.getId(), FollowStatus.ACEITO), "published", 0L));
            out.put("invite", Map.of("message", u.getProfileVisibility() == Visibility.FOLLOWERS
                    ? Msg.t("profile.este_perfil_mostra_as_publicacoes") : Msg.t("profile.perfil_privado"), "action", "SEGUIR"));
            out.put("schemes", List.of());
            out.put("pieces", List.of());
            return out;
        }
        if (levelProgress != null) out.put("levelProgress", levelProgress.progress(u.getId()));
        String order = LookbookService.lookSort(sort);
        List<Scheme> looks = publishedLooks(viewer, u, self, published, order);
        out.put("schemes", looks.stream().limit(60)
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        out.put("sort", order);
        List<WardrobeItem> visiblePieces = pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> self || guard.canView(viewer, u.getId(), SchemeService.moreRestrictive(w.getVisibility(), u.getProfileVisibility())))
                .toList();
        out.put("pieces", visiblePieces.stream().limit(60).map(w -> Views.piece(w, null, null)).toList());
        // o dono vê tudo o que tem (inclusive rascunhos); quem visita conta só o que consegue abrir
        out.put("counters", self ? counters(u.getId(), published.size())
                : Map.of("followers", follows.countByFollowingIdAndStatus(u.getId(), FollowStatus.ACEITO),
                "following", follows.countByFollowerIdAndStatus(u.getId(), FollowStatus.ACEITO), "published", (long) looks.size(),
                "pieces", (long) visiblePieces.size(), "schemes", (long) looks.size()));
        return out;
    }

    /**
     * Todos os looks publicados que quem vê pode ver, na ordem pedida (o perfil mostra os 60 primeiros e conta todos). Pelo Hype: o dono usa o próprio Hype pessoal;
     * terceiros, só o público elegível. Sem Hype = por último (nunca 0); empate segue a ordem recente.
     */
    List<Scheme> publishedLooks(CurrentUser viewer, User owner, boolean self, List<Scheme> published, String order) {
        List<Scheme> visible = published.stream()
                .filter(s -> self || guard.canView(viewer, owner.getId(), SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility())))
                .toList();
        if ("recent".equals(order)) {
            return visible;
        }
        Map<UUID, HypeScoreCurrent> h = LookbookService.rankable(LookbookService.hypeV2Of(hypeV2, hypeV2Config, HypeEntityType.SCHEME,
                visible.stream().map(Scheme::getId).toList()), viewer == null ? null : viewer.id());
        // a lista chega da mais recente para a mais antiga: o sort estável mantém essa ordem nos empates
        return visible.stream().sorted(LookbookService.<Scheme>hypeOrder(order, s -> h.get(s.getId()))).toList();
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
        return connections.follow(viewer, targetId);
    }

    /** CA04 — deixar de seguir: remove o vínculo; nenhuma notificação. */
    @Transactional
    public Map<String, Object> unfollow(CurrentUser viewer, UUID targetId) {
        return connections.unfollow(viewer, targetId);
    }

    Map<String, Object> state(UUID viewerId, UUID targetId) {
        return connections.state(viewerId, targetId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requests(CurrentUser user) {
        return connections.requests(user);
    }

    @Transactional
    public Map<String, Object> respond(CurrentUser user, UUID followId, boolean accept) {
        return connections.respond(user, followId, accept);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> connections(CurrentUser viewer, UUID userId) {
        return connections.connections(viewer, userId);
    }

    /** Bloquear: o bloqueado não vê o perfil nem pode seguir; vínculos anteriores são desfeitos. */
    @Transactional
    public Map<String, Object> block(CurrentUser user, UUID targetId, boolean block) {
        return connections.block(user, targetId, block);
    }
}
