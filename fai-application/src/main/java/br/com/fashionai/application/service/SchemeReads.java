package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Leitura dos looks: detalhe (contadores e sinal de Hype de quem visita), visibilidade efetiva (RF3.CA13, rascunho só
 * do dono), view com o estado de quem vê, Meus looks (estado, origem, Hype v2) e o look do dono.
 */
final class SchemeReads {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final ReactionRepository reactions;
    private final SavedItemRepository saved;
    private final WardrobeService wardrobe;
    private final SealService seals;
    private final CounterStorePort counters;
    private final ApplicationEventPublisher events;
    private final Guard guard;
    private final SchemeHype hypeState;
    private final HypeScoreConfig hypeConfig;

    SchemeReads(SchemeRepository schemes, SchemeItemRepository schemeItems, ReactionRepository reactions, SavedItemRepository saved,
                WardrobeService wardrobe, SealService seals, CounterStorePort counters, ApplicationEventPublisher events, Guard guard,
                SchemeHype hypeState, HypeScoreConfig hypeConfig) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.reactions = reactions;
        this.saved = saved;
        this.wardrobe = wardrobe;
        this.seals = seals;
        this.counters = counters;
        this.events = events;
        this.guard = guard;
        this.hypeState = hypeState;
        this.hypeConfig = hypeConfig;
    }

    Map<String, Object> get(CurrentUser viewer, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        requireView(viewer, s);
        boolean owner = viewer != null && viewer.id().equals(s.getUser().getId());
        if (!owner) {
            s.setViewCount(s.getViewCount() + 1);
            counters.increment("scheme", id, "views", 1);
            if (viewer != null) {
                events.publishEvent(new DomainEvents.HypeSignal(HypeSignalType.LOOK_VIEWED, HypeEntityType.SCHEME, id, viewer.id(), s.getUser().getId()));
            }
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", view(viewer, s, items));
        out.put("wearstyles", items.stream().collect(Collectors.toMap(si -> si.getWardrobeItem().getId().toString(),
                si -> Taxonomy.wearstylesOf(si.getWardrobeItem().getCategory(), Json.csv(si.getWardrobeItem().getOccasionTags())),
                (a, b) -> a, LinkedHashMap::new)));
        out.put("seals", sealsOf(s));
        out.put("sealBadges", seals.approvedBadges(s.getId()));
        out.put("remixedFrom", s.getOriginalScheme() == null ? null : Map.of("id", s.getOriginalScheme().getId(),
                "title", s.getOriginalScheme().getTitle(), "owner", Views.user(s.getOriginalScheme().getUser())));
        out.put("canEdit", owner);
        return out;
    }

    /** RF3.CA13 — a visibilidade do esquema prevalece sobre a do perfil quando for mais restritiva. */
    void requireView(CurrentUser viewer, Scheme s) {
        Visibility effective = moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility());
        if (onlyForOwner(viewer, s)) {
            throw ApiException.notFound(Msg.t("entity.esquema"));
        }
        guard.requireView(viewer, s.getUser().getId(), effective, "scheme:" + s.getId());
    }

    boolean canView(CurrentUser viewer, Scheme s) {
        if (onlyForOwner(viewer, s)) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    /**
     * Rascunho e arquivado são só do dono, qualquer que seja a visibilidade marcada: sem isso, um rascunho "público"
     * abria pelo link direto e aparecia na busca antes de ser publicado. Quem não é o dono recebe "não encontrado".
     */
    private static boolean onlyForOwner(CurrentUser viewer, Scheme s) {
        return s.getStatus() != SchemeStatus.PUBLISHED && (viewer == null || !viewer.id().equals(s.getUser().getId()));
    }

    static Visibility moreRestrictive(Visibility a, Visibility b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() < b.ordinal() ? a : b;
    }

    private List<Object> sealsOf(Scheme s) {
        return new ArrayList<>(Json.strings(s.getSealIdsJson()));
    }

    Views.SchemeView view(CurrentUser viewer, Scheme s, List<SchemeItem> items) {
        Views.ViewerState state = Views.ViewerState.NONE;
        if (viewer != null) {
            List<String> mine = reactions.findByActorIdAndTargetTypeAndTargetId(viewer.id(), TargetType.SCHEME, s.getId()).stream()
                    .map(r -> r.getReactionType().name()).toList();
            boolean isSaved = saved.findByUserIdAndTargetTypeAndTargetId(viewer.id(), TargetType.SCHEME, s.getId()).isPresent();
            state = new Views.ViewerState(mine.contains("LIKE"), mine.stream().filter(r -> !r.equals("LIKE")).toList(), isSaved,
                    viewer.id().equals(s.getUser().getId()), false);
        }
        return Views.scheme(s, items, state, wardrobe.reactionCounts(TargetType.SCHEME, s.getId()), seals.approvedBadges(s.getId()));
    }

    /**
     * Meus looks (domínio Looks e Lookbook). {@code state} restringe pelo estado (favoritos, disponível, indisponível,
     * publicados, rascunhos, arquivados) e {@code kind} pela origem (ia, manual, remix). Antes, publicados/rascunhos/
     * arquivados chegavam do frontend e eram ignorados; arquivados só aparecem quando pedidos.
     * <p>
     * RF53 (P1-07) — {@code sort}: recent (padrão), hype/hype_desc, hype_asc e growth (maior crescimento), do HypeScore
     * v2; {@code hypeLevel} é FILTRO (faixa mínima NICHE, RELEVANT, HOT, TRENDING, VIRAL), não aba. A lista é sempre do
     * próprio dono, então vale o Hype PESSOAL (look privado ou só para seguidores também tem score para quem o criou).
     * Look sem Hype (dados insuficientes ou ainda não calculado) vai para o fim, nunca vira 0.
     */
    Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, String sort, String hypeLevel,
                                      int page, int size) {
        String st = state == null ? "" : state.trim().toLowerCase(Locale.ROOT);
        boolean archived = st.equals("arquivados") || st.equals("archived");
        List<Scheme> source = archived ? schemes.findByUserIdOrderByCreatedAtDesc(user.id())
                : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        List<Scheme> all = source.stream()
                .filter(s -> occasion == null || occasion.isBlank() || Json.csv(s.getOccasion()).contains(occasion))
                .filter(s -> SchemeLookFilters.stateMatches(s, st))
                .filter(s -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(SchemeLookFilters.kindOf(s))
                        || "todos".equalsIgnoreCase(kind))
                .toList();
        String order = SchemeLookFilters.lookSort(sort);
        Integer minimum = SchemeLookFilters.hypeMinimum(hypeLevel, hypeConfig == null ? null : hypeConfig.levelThresholds());
        if (SchemeLookFilters.LOOK_HYPE_SORTS.contains(order) || minimum != null) {
            all = SchemeLookFilters.byHype(all, order, minimum,
                    hypeState.currentHype(HypeEntityType.SCHEME, all.stream().map(Scheme::getId).toList()));
        }
        int sz = Math.max(1, Math.min(60, size <= 0 ? 20 : size));
        int from = Math.min(all.size(), Math.max(0, page) * sz);
        int to = Math.min(all.size(), from + sz);
        List<Views.SchemeView> items = all.subList(from, to).stream()
                .map(s -> view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
        return new Views.Page<>(items, page, sz, all.size(), to < all.size());
    }

    Scheme owned(CurrentUser user, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
        return s;
    }
}
