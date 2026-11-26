package br.com.fashionai.application.scheme;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.ports.CounterStorePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeQueries {
    private final WardrobeService wardrobe;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final CounterStorePort counters;
    private final ApplicationEventPublisher events;
    private final ReactionRepository reactions;
    private final SavedItemRepository saved;
    private final SealService seals;
    private final SchemeAccess access;
    private final SchemeHype hype;
    private final HypeScoreConfig hypeConfig;

    public SchemeQueries(WardrobeService wardrobe, WardrobeItemRepository pieces, UserRepository users, SchemeRepository
                         schemes, SchemeItemRepository schemeItems, CounterStorePort counters, ApplicationEventPublisher
                         events, ReactionRepository reactions, SavedItemRepository saved, SealService seals, SchemeAccess
                         access, SchemeHype hype, HypeScoreConfig hypeConfig) {
        this.wardrobe = wardrobe;
        this.pieces = pieces;
        this.users = users;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.counters = counters;
        this.events = events;
        this.reactions = reactions;
        this.saved = saved;
        this.seals = seals;
        this.access = access;
        this.hype = hype;
        this.hypeConfig = hypeConfig;
    }

    /** RF5.CA01/CA02/CA07b — listas por parte do corpo espelhando o guarda-roupa real (só disponíveis). */
    public Map<String, Object> builder(CurrentUser user) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        return SchemeBuilderView.of(eligible, pieces.countByUserId(user.id()), users.findById(user.id()).orElseThrow());
    }

    public Map<String, Object> get(CurrentUser viewer, UUID id) {
        Scheme s = schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        access.requireView(viewer, s);
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

    private List<Object> sealsOf(Scheme s) {
        return new ArrayList<>(Json.strings(s.getSealIdsJson()));
    }

    public Views.SchemeView view(CurrentUser viewer, Scheme s, List<SchemeItem> items) {
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
    public Views.Page<Views.SchemeView> mine(CurrentUser user, String occasion, String state, String kind, String sort, String hypeLevel,
                                             int page, int size) {
        String st = state == null ? "" : state.trim().toLowerCase(Locale.ROOT);
        boolean archived = st.equals("arquivados") || st.equals("archived");
        List<Scheme> source = archived ? schemes.findByUserIdOrderByCreatedAtDesc(user.id())
                : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        List<Scheme> all = source.stream()
                .filter(s -> occasion == null || occasion.isBlank() || Json.csv(s.getOccasion()).contains(occasion))
                .filter(s -> SchemeListing.stateMatches(s, st))
                .filter(s -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(SchemeListing.kindOf(s)) || "todos".equalsIgnoreCase(kind))
                .toList();
        String order = SchemeListing.lookSort(sort);
        Integer minimum = SchemeListing.hypeMinimum(hypeLevel, hypeConfig == null ? null : hypeConfig.levelThresholds());
        if (SchemeListing.LOOK_HYPE_SORTS.contains(order) || minimum != null) {
            all = SchemeListing.byHype(all, order, minimum, hype.currentHype(HypeEntityType.SCHEME, all.stream().map(Scheme::getId).toList()));
        }
        int sz = Math.max(1, Math.min(60, size <= 0 ? 20 : size));
        int from = Math.min(all.size(), Math.max(0, page) * sz);
        int to = Math.min(all.size(), from + sz);
        List<Views.SchemeView> items = all.subList(from, to).stream()
                .map(s -> view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
        return new Views.Page<>(items, page, sz, all.size(), to < all.size());
    }

    /**
     * RF20.CA01 — sugestão de vínculo não bloqueante, chamada fora da transação do salvamento (o esquema já está
     * gravado). {@code seals.suggest} abre a própria transação; se falhar, devolve a mensagem sem afetar o esquema.
     */
    public Map<String, Object> suggestSealsAfterSave(CurrentUser user, UUID schemeId) {
        try {
            return seals.suggest(user, schemeId);
        } catch (RuntimeException ex) {
            return Map.of("suggestions", List.of(), "message", Msg.t("scheme.sugestao_de_vinculo_indisponivel_agora"));
        }
    }
}
