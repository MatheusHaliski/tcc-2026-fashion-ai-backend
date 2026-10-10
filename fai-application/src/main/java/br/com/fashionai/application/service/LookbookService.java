package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.AcervoGroup;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.SavedItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.AcervoGroupRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF6 — Perfil Lookbook: abas Closet Digital, Looks Salvos (próprios + salvos de terceiros com origem), Look do Dia
 * (painel do Hype Score em 6 versões, continuidade na virada do dia, feedback HU19), Minha Cápsula & Versatilidade
 * (generalização do B4 do DNA), agrupamentos sugeridos do acervo (RF24.CA05) e agrupamentos editoriais (coleções,
 * eras, fases, temporadas, turnês) para perfis pessoais e institucionais.
 * <p>
 * HypeScore v2 (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote 4): o painel do Look do Dia mostra o v2 (HypeScoreService.panel);
 * Looks salvos ordenam por Hype (P3-03) — o dono vê o Hype pessoal dos próprios looks; looks de terceiros entram na
 * ordem só com o Hype público elegível; sem Hype = por último, nunca 0. Os "HypeGroups" do acervo são agrupamentos por
 * SIMILARIDADE (P3-04): o nome legado fica só nas rotas antigas, e a lista traz à parte o Hype médio v2 dos membros.
 */
@Service
public class LookbookService {
    public static final int GROUPING_MIN_PIECES = 20;

    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final SavedItemRepository saved;
    private final UserRepository users;
    private final AcervoGroupRepository acervoGroups;
    private final SchemeGroupingRepository groupings;
    private final WardrobeService wardrobe;
    private final SchemeService schemeService;
    private final SocialService social;
    private final DailyLookService dailyLooks;
    private final HypeScoreService hype;
    private final AiEngine ai;
    private final Guard guard;
    private final OwnMedia ownMedia;
    /** HypeScore v2 (estado gravado pelo job; aqui só leitura). Opcional nos testes que montam o serviço à mão. */
    private HypeScoreCurrentRepository hypeV2;
    private HypeScoreConfig hypeV2Config;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setHypeV2(HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config) {
        this.hypeV2 = hypeV2;
        this.hypeV2Config = hypeV2Config;
    }

    public LookbookService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, SavedItemRepository saved,
                           UserRepository users, AcervoGroupRepository acervoGroups, SchemeGroupingRepository groupings, WardrobeService wardrobe,
                           SchemeService schemeService, SocialService social, DailyLookService dailyLooks, HypeScoreService hype, AiEngine ai,
                           Guard guard, OwnMedia ownMedia) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.saved = saved;
        this.users = users;
        this.acervoGroups = acervoGroups;
        this.groupings = groupings;
        this.wardrobe = wardrobe;
        this.schemeService = schemeService;
        this.social = social;
        this.dailyLooks = dailyLooks;
        this.hype = hype;
        this.ai = ai;
        this.guard = guard;
        this.ownMedia = ownMedia;
    }

    // ================================================================== visão geral (CA01/CA08)
    @Transactional
    public Map<String, Object> overview(CurrentUser viewer, UUID ownerId) {
        User owner = users.findById(ownerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        boolean self = viewer != null && viewer.id().equals(ownerId);
        boolean canSee = self || guard.canView(viewer, ownerId, owner.getProfileVisibility());
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(ownerId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<Scheme> looks = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED);
        if (!self) {
            all = all.stream().filter(w -> guard.canView(viewer, ownerId, WardrobeService.effectiveVisibility(w))).toList();
            looks = looks.stream().filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && guard.canView(viewer, ownerId, SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility()))).toList();
        }
        long publicationsCount = canSee ? publicationRows(viewer, owner).size() : 0;
        long favoritesCount = canSee ? all.stream().filter(WardrobeItem::isFavorite).count() + looks.stream().filter(Scheme::isFavorite).count() : 0;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("owner", Views.user(owner));
        out.put("self", self);
        out.put("visible", canSee);
        out.put("institutional", owner.getProfileType() != ProfileType.PESSOAL);
        // Peças e esquemas nunca dividem a mesma aba: Closet/Peças salvas (peças) × Looks/Looks salvos (esquemas).
        out.put("tabs", List.of(Map.of("id", "closet", "label", Msg.t("lookbook.closet_digital"), "count", all.size()),
                Map.of("id", "looks", "label", "Looks", "count", looks.size()),
                Map.of("id", "saved_looks", "label", Msg.t("lookbook.looks_salvos"), "count", self ? saved.countByUserIdAndTargetType(ownerId, TargetType.SCHEME) : 0),
                Map.of("id", "saved_pieces", "label", Msg.t("lookbook.pecas_salvas"), "count", self ? saved.countByUserIdAndTargetType(ownerId, TargetType.PIECE) : 0),
                Map.of("id", "daily", "label", Msg.t("lookbook.look_do_dia"), "count", self ? dailyLooks.today(ownerId).isPresent() ? 1 : 0 : 0),
                Map.of("id", "capsule", "label", Msg.t("lookbook.minha_capsula"), "count", looks.isEmpty() ? 0 : basePieces(looks).size()),
                Map.of("id", "room", "label", Msg.t("lookbook.meu_guarda_roupa"), "count", all.size()),
                Map.of("id", "publications", "label", Msg.t("lookbook.publicacoes"), "count", publicationsCount),
                Map.of("id", "favorites", "label", Msg.t("lookbook.favoritos"), "count", favoritesCount)));
        out.put("emptyCloset", all.isEmpty() ? Map.of("message", Msg.t("lookbook.seu_closet_digital_esta_vazio"), "action", Map.of("label", Msg.t("common.adicionar_nova_peca"), "href", "/pieces/new")) : null);
        out.put("panelVersion", owner.getLookDoDiaPanelVersion() == null ? HypeScorePanelVersion.SPOTLIGHT_CLASSICO.name() : owner.getLookDoDiaPanelVersion().name());
        out.put("groupingSuggestionsAvailable", self && all.size() >= GROUPING_MIN_PIECES);
        return out;
    }

    // ================================================================== Publicações e Favoritos (RF6 + RF53, Lookbook social)
    /**
     * Publicações: o que o perfil mostra ao mundo, em ordem cronológica — looks publicados e peças que não são privadas,
     * nunca rascunhos nem itens em moderação. Para o dono é a mesma lista que os outros veem (o Lookbook é a vitrine);
     * a gestão completa dos looks fica em /looks.
     */
    @Transactional
    public Views.Page<Map<String, Object>> publications(CurrentUser viewer, UUID ownerId, int page, int size) {
        User owner = users.findById(ownerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        boolean self = viewer != null && viewer.id().equals(ownerId);
        if (!self && !guard.canView(viewer, ownerId, owner.getProfileVisibility())) {
            return new Views.Page<>(List.of(), page, Math.max(1, size), 0, false);
        }
        List<Object[]> rows = publicationRows(viewer, owner);
        int sz = Math.max(1, Math.min(60, size <= 0 ? 24 : size));
        int from = Math.min(rows.size(), Math.max(0, page) * sz);
        int to = Math.min(rows.size(), from + sz);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Object[] r : rows.subList(from, to)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("at", r[0].toString());
            if (r[1] instanceof Scheme s) {
                m.put("type", "LOOK");
                m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            } else if (r[1] instanceof WardrobeItem w) {
                m.put("type", "PIECE");
                m.put("piece", Views.piece(w, wardrobe.viewerState(viewer, w), null));
            }
            items.add(m);
        }
        return new Views.Page<>(items, page, sz, rows.size(), to < rows.size());
    }

    /** [instante, entidade] das publicações visíveis para quem vê, mais recentes primeiro. */
    List<Object[]> publicationRows(CurrentUser viewer, User owner) {
        UUID ownerId = owner.getId();
        List<Object[]> rows = new ArrayList<>();
        schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED)
                .filter(s -> s.getVisibility() != br.com.fashionai.domain.model.enums.Visibility.PRIVATE)
                .filter(s -> guard.canView(viewer, ownerId, SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility())))
                .forEach(s -> rows.add(new Object[]{s.getPublishedAt() != null ? s.getPublishedAt() : s.getCreatedAt(), s}));
        pieces.findByUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> w.getModerationStatus() == br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED)
                .filter(w -> WardrobeService.effectiveVisibility(w) != br.com.fashionai.domain.model.enums.Visibility.PRIVATE)
                .filter(w -> guard.canView(viewer, ownerId, WardrobeService.effectiveVisibility(w)))
                .forEach(w -> rows.add(new Object[]{w.getCreatedAt(), w}));
        rows.sort((a, b) -> ((java.time.Instant) b[0]).compareTo((java.time.Instant) a[0]));
        return rows;
    }

    /** Favoritos do perfil: peças e looks que o dono marcou como favoritos, com a mesma visibilidade do Lookbook. */
    @Transactional
    public Map<String, Object> favorites(CurrentUser viewer, UUID ownerId) {
        User owner = users.findById(ownerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        boolean self = viewer != null && viewer.id().equals(ownerId);
        Map<String, Object> out = new LinkedHashMap<>();
        if (!self && !guard.canView(viewer, ownerId, owner.getProfileVisibility())) {
            out.put("pieces", List.of());
            out.put("looks", List.of());
            return out;
        }
        out.put("pieces", pieces.findByUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(WardrobeItem::isFavorite)
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> self || (w.getModerationStatus() == br.com.fashionai.domain.model.enums.ModerationStatus.APPROVED
                        && guard.canView(viewer, ownerId, WardrobeService.effectiveVisibility(w))))
                .limit(60).map(w -> Views.piece(w, wardrobe.viewerState(viewer, w), null)).toList());
        out.put("looks", schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED).stream()
                .filter(Scheme::isFavorite)
                .filter(s -> self || (s.getStatus() == SchemeStatus.PUBLISHED
                        && guard.canView(viewer, ownerId, SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility()))))
                .limit(60).map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList());
        return out;
    }

    // ================================================================== Looks Salvos (CA09–CA13)
    @Transactional
    public Views.Page<Map<String, Object>> savedLooks(CurrentUser user, String occasion, int page, int size) {
        return savedLooks(user, occasion, null, page, size);
    }

    /**
     * Looks salvos (próprios + salvos de terceiros) com ordenação (P3-03): {@code recent} (padrão), {@code hype_desc},
     * {@code hype_asc} ou {@code growth}. Look próprio usa o Hype pessoal; look de terceiro, só o público elegível.
     * Sem Hype fica por último; empate segue a ordem recente.
     */
    @Transactional
    public Views.Page<Map<String, Object>> savedLooks(CurrentUser user, String occasion, String sort, int page, int size) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            if (occasion != null && !occasion.isBlank() && !Json.csv(s.getOccasion()).contains(occasion)) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("origin", "PROPRIO");
            m.put("originLabel", Msg.t("lookbook.seu_look"));
            m.put("scheme", schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            m.put("favorite", s.isFavorite());
            m.put("canEdit", true);
            m.put("sortKey", s.getUpdatedAt() == null ? s.getCreatedAt() : s.getUpdatedAt());
            rows.add(m);
        }
        for (SavedItem si : saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(user.id(), TargetType.SCHEME)) {
            Optional<Scheme> os = schemes.findById(si.getTargetId());
            if (os.isEmpty() || os.get().getUser().getId().equals(user.id()) || !schemeService.canView(user, os.get())) {
                continue;
            }
            Scheme s = os.get();
            if (occasion != null && !occasion.isBlank() && !Json.csv(s.getOccasion()).contains(occasion)) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("origin", "SALVO");
            m.put("originLabel", Msg.t("lookbook.salvo_de", s.getUser().getUsername()));
            m.put("author", Views.user(s.getUser()));
            m.put("scheme", schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            m.put("favorite", si.isFavorite());
            m.put("canEdit", false);
            m.put("savedAt", si.getSavedAt());
            m.put("sortKey", si.getSavedAt());
            rows.add(m);
        }
        Comparator<Map<String, Object>> recent = Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("sortKey"))).reversed();
        String order = lookSort(sort);
        if ("recent".equals(order)) {
            rows.sort(recent);
        } else {
            Function<Map<String, Object>, UUID> idOf = m -> ((Views.SchemeView) m.get("scheme")).id();
            Map<UUID, HypeScoreCurrent> h = rankable(hypeV2Of(HypeEntityType.SCHEME, rows.stream().map(idOf).toList()), user.id());
            rows.sort(hypeOrder(order, (Map<String, Object> m) -> h.get(idOf.apply(m))).thenComparing(recent));
        }
        int from = Math.max(0, page * size);
        List<Map<String, Object>> slice = from >= rows.size() ? List.of() : rows.subList(from, Math.min(rows.size(), from + size));
        return new Views.Page<>(slice, page, size, rows.size(), from + size < rows.size());
    }

    // ================================================================== Peças salvas (aba própria, separada dos looks)
    @Transactional(readOnly = true)
    public Views.Page<Map<String, Object>> savedPieces(CurrentUser user, String category, int page, int size) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (SavedItem si : saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(user.id(), TargetType.PIECE)) {
            Optional<WardrobeItem> ow = pieces.findById(si.getTargetId());
            if (ow.isEmpty()) {
                continue;
            }
            WardrobeItem w = ow.get();
            boolean own = w.getUser().getId().equals(user.id());
            if (!own && !guard.canView(user, w.getUser().getId(), WardrobeService.effectiveVisibility(w))) {
                continue;
            }
            if (category != null && !category.isBlank() && !category.equals(w.getCategory())) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("origin", own ? "PROPRIO" : "SALVO");
            m.put("originLabel", own ? Msg.t("lookbook.sua_peca") : Msg.t("lookbook.salva_de", w.getUser().getUsername()));
            m.put("author", Views.user(w.getUser()));
            m.put("piece", Views.piece(w, null, null));
            m.put("favorite", si.isFavorite());
            m.put("snapshot", w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED);
            m.put("savedAt", si.getSavedAt());
            rows.add(m);
        }
        int from = Math.max(0, page * size);
        List<Map<String, Object>> slice = from >= rows.size() ? List.of() : rows.subList(from, Math.min(rows.size(), from + size));
        return new Views.Page<>(slice, page, size, rows.size(), from + size < rows.size());
    }

    /** RF6.CA12 — favoritar look próprio ou salvo; refletido em todas as telas que exibem o card. */
    @Transactional
    public Map<String, Object> favorite(CurrentUser user, UUID schemeId, boolean favorite) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        if (s.getUser().getId().equals(user.id())) {
            return schemeService.toggles(user, schemeId, favorite, null);
        }
        return social.favoriteSaved(user, TargetType.SCHEME, schemeId, favorite);
    }

    /** RF6.CA13 — remover look salvo de terceiro sem afetar o original. */
    @Transactional
    public Map<String, Object> removeSaved(CurrentUser user, UUID schemeId) {
        if (saved.findByUserIdAndTargetTypeAndTargetId(user.id(), TargetType.SCHEME, schemeId).isEmpty()) {
            throw ApiException.notFound(Msg.t("common.look_salvo"));
        }
        return social.toggleSave(user, TargetType.SCHEME, schemeId);
    }

    // ================================================================== Look do Dia (RF6 §1, painel §6, HU19)
    @Transactional
    public Map<String, Object> dailyLookTab(CurrentUser user, boolean withAi) {
        User u = users.findById(user.id()).orElseThrow();
        Optional<DailyLook> today = dailyLooks.today(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        HypeScorePanelVersion version = u.getLookDoDiaPanelVersion() == null ? HypeScorePanelVersion.SPOTLIGHT_CLASSICO : u.getLookDoDiaPanelVersion();
        out.put("panelVersion", version.name());
        out.put("panelVersions", panelVersions());
        out.put("today", today.map(dailyLooks::view).orElse(null));
        if (today.isPresent()) {
            DailyLook dl = today.get();
            out.put("scheme", schemeService.view(user, dl.getScheme(), schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId())));
            out.put("panel", hype.panel(dl, withAi));
        } else {
            out.put("empty", Map.of("message", Msg.t("lookbook.nenhum_look_do_dia_marcado"), "actions", List.of(
                    Map.of("label", Msg.t("lookbook.marcar_um_look_salvo"), "href", "/u/" + u.getUsername() + "?tab=looks"), Map.of("label", Msg.t("lookbook.usar_o_autopiloto"), "href", "/autopilot"),
                    Map.of("label", Msg.t("lookbook.vista_me_no_espelho"), "href", "/mirror"))));
        }
        out.put("history", dailyLooks.history(user));
        out.put("feedbackReminder", dailyLooks.pendingFeedback(user));
        out.put("feedbackOptions", List.of("ADOREI", "NAO_USEI", "NAO_GOSTEI"));
        return out;
    }

    public static List<Map<String, Object>> panelVersions() {
        return List.of(
                Map.of("code", "SPOTLIGHT_CLASSICO", "name", Msg.t("lookbook.spotlight_classico"), "emphasis", Msg.t("lookbook.equilibrio"), "hype", Msg.t("lookbook.barra_horizontal_texto"), "bestFor", Msg.t("lookbook.padrao_geral")),
                Map.of("code", "PASSARELA", "name", "Passarela", "emphasis", Msg.t("lookbook.celebracao_drama"), "hype", Msg.t("lookbook.termometro_vertical"), "bestFor", Msg.t("lookbook.scores_altos_compartilhamento")),
                Map.of("code", "RAIO_X_ESTILO", "name", Msg.t("lookbook.raio_x_do_estilo"), "emphasis", Msg.t("lookbook.transparencia_do_calculo"), "hype", Msg.t("lookbook.numero_breakdown_expandido"), "bestFor", Msg.t("lookbook.usuarios_avancados")),
                Map.of("code", "BENTO_DIA", "name", Msg.t("lookbook.bento_do_dia"), "emphasis", Msg.t("lookbook.priorizacao_configuravel"), "hype", Msg.t("lookbook.bloco_fixo_grande"), "bestFor", Msg.t("lookbook.usuarios_recorrentes")),
                Map.of("code", "EDITORIAL_MINIMAL", "name", Msg.t("lookbook.editorial_minimal"), "emphasis", "Minimalismo", "hype", Msg.t("lookbook.numero_discreto"), "bestFor", Msg.t("lookbook.baixa_tolerancia_a_gamificacao")),
                Map.of("code", "COACH_ESTILO", "name", Msg.t("lookbook.coach_de_estilo"), "emphasis", Msg.t("lookbook.orientacao_acionavel"), "hype", Msg.t("lookbook.secundario_abaixo_da_sugestao"), "bestFor", Msg.t("lookbook.scores_baixos_medios")));
    }

    @Transactional
    public Map<String, Object> setPanelVersion(CurrentUser user, HypeScorePanelVersion version) {
        User u = users.findById(user.id()).orElseThrow();
        u.setLookDoDiaPanelVersion(version == null ? HypeScorePanelVersion.SPOTLIGHT_CLASSICO : version);
        users.save(u);
        return Map.of("panelVersion", u.getLookDoDiaPanelVersion().name());
    }

    /** Marca um esquema salvo como Look do Dia (registro datado, source = manual). */
    @Transactional
    public Map<String, Object> markDailyLook(CurrentUser user, UUID schemeId) {
        Scheme s = schemeService.owned(user, schemeId);
        DailyLook dl = dailyLooks.register(user, s, DailyLookSource.MANUAL, LocalDate.now(FaiPointsService.ZONE));
        return dailyLooks.view(dl);
    }

    // ================================================================== Minha Cápsula & Versatilidade (RF6, generaliza RF13 §B4)
    Map<UUID, Integer> basePieces(List<Scheme> looks) {
        Map<UUID, Integer> use = new LinkedHashMap<>();
        if (looks.isEmpty()) {
            return use;
        }
        for (SchemeItem si : schemeItems.findBySchemeIdIn(looks.stream().map(Scheme::getId).toList())) {
            use.merge(si.getWardrobeItem().getId(), 1, Integer::sum);
        }
        return use;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> capsule(CurrentUser user, String category) {
        List<Scheme> looks = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        Map<String, Object> out = new LinkedHashMap<>();
        if (looks.isEmpty()) {
            out.put("empty", Map.of("message", Msg.t("lookbook.a_capsula_so_faz_sentido"), "action", Map.of("label", Msg.t("lookbook.criar_meu_primeiro_look"), "href", "/schemes/new")));
            out.put("basePieces", 0);
            out.put("looks", 0);
            out.put("factor", 0);
            return out;
        }
        Map<UUID, Integer> use = basePieces(looks);
        Map<UUID, WardrobeItem> byId = pieces.findByIdIn(use.keySet()).stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Map<String, Object>> cards = use.entrySet().stream().map(e -> byId.get(e.getKey())).filter(Objects::nonNull)
                .filter(w -> category == null || category.isBlank() || category.equals(w.getCategory()))
                .sorted(Comparator.comparingInt((WardrobeItem w) -> use.get(w.getId())).reversed())
                .map(w -> Map.<String, Object>of("piece", Views.piece(w, null, null), "looks", use.get(w.getId()), "category", String.valueOf(w.getCategory()))).toList();
        out.put("basePieces", use.size());
        out.put("looks", looks.size());
        out.put("factor", Math.round(10.0 * looks.size() / Math.max(1, use.size())) / 10.0);
        out.put("filters", List.of("Tudo", "upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"));
        out.put("cards", cards);
        out.put("note", Msg.t("lookbook.nao_inclui_itens_salvos_de"));
        return out;
    }

    // ================================================================== agrupamentos sugeridos do acervo (RF24.CA05)
    /** Agrupamentos sugeridos por similaridade (≥ 0,70, grupos de 3+). Não usam Hype: o nome legado "HypeGroups" engana. */
    @Transactional
    public Map<String, Object> suggestGroups(CurrentUser user, HypeEntityType type) {
        List<Similarity.Signature> sigs;
        List<UUID> ids;
        List<String> labels;
        if (type == HypeEntityType.PIECE) {
            List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
            if (all.size() < GROUPING_MIN_PIECES) {
                throw new ApiException(422, "ACERVO_PEQUENO", Msg.t("lookbook.os_agrupamentos_sugeridos_aparecem_a", GROUPING_MIN_PIECES),
                        Map.of("pieces", all.size(), "missing", GROUPING_MIN_PIECES - all.size()));
            }
            sigs = all.stream().map(Similarity::of).toList();
            ids = all.stream().map(WardrobeItem::getId).toList();
            labels = all.stream().map(w -> String.valueOf(w.getName())).toList();
        } else {
            List<Scheme> looks = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
            Map<UUID, List<SchemeItem>> items = looks.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(looks.stream().map(Scheme::getId).toList()).stream()
                    .collect(Collectors.groupingBy(si -> si.getScheme().getId()));
            sigs = looks.stream().map(s -> Similarity.of(s, items.getOrDefault(s.getId(), List.of()))).toList();
            ids = looks.stream().map(Scheme::getId).toList();
            labels = looks.stream().map(s -> String.valueOf(s.getTitle())).toList();
        }
        final List<Similarity.Signature> fs = sigs;
        AiOutcome<List<List<Integer>>> outcome = ai.local(user.id(), AiCapability.ACERVO_GROUPING, List.of(Msg.t("lookbook.estilos_ocasioes_cores_marcas_e")),
                () -> HypeScoreService.cluster(fs));
        acervoGroups.deleteByUserIdAndEntityType(user.id(), type);
        List<Map<String, Object>> out = new ArrayList<>();
        for (List<Integer> cluster : outcome.value()) {
            Similarity.Signature sig = sigs.get(cluster.get(0));
            String label = (sig.styles().isEmpty() ? "" : String.join("/", sig.styles()) + " · ") + (sig.occasions().isEmpty() ? "grupo" : String.join("/", sig.occasions()));
            AcervoGroup g = new AcervoGroup();
            g.setUser(users.findById(user.id()).orElseThrow());
            g.setEntityType(type);
            g.setLabel(InputSanitizer.clean(label, 80));
            g.setMemberIdsJson(Json.write(cluster.stream().map(i -> ids.get(i).toString()).toList()));
            g.setCentroidJson(Json.write(Map.of("styles", sig.styles(), "occasions", sig.occasions(), "colors", sig.colors(), "brands", sig.brands())));
            g.setMemberCount(cluster.size());
            g.setComputedAt(java.time.Instant.now());
            acervoGroups.save(g);
            out.add(Map.of("id", g.getId(), "label", g.getLabel(), "members", cluster.stream().map(i -> Map.of("id", ids.get(i), "label", labels.get(i))).toList(),
                    "count", cluster.size(), "kind", "SIMILARITY"));
        }
        // P3-04: o agrupamento é por similaridade (o nome "HypeGroups" das rotas antigas é legado); o Hype médio vem em groups()
        return Map.of("groups", out, "type", type.name(), "kind", "SIMILARITY", "explanation", outcome.explanation(),
                "note", Msg.t("lookbook.sugestoes_sempre_descartaveis_rf24_ca05"), "basis", Msg.t("hypeLookbook.grupos_similaridade_base"));
    }

    /**
     * Agrupamentos sugeridos do acervo — por SIMILARIDADE (estilo, ocasião, cor, marca e tipo), não por Hype (P3-04).
     * {@code kind} = SIMILARITY deixa isso explícito; {@code hype} = Hype médio v2 dos membros, exibido ao lado (os itens
     * são do próprio dono: vale o Hype pessoal). Sem nenhum membro com Hype, {@code avgScore} é nulo — nunca 0.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> groups(CurrentUser user, HypeEntityType type) {
        List<AcervoGroup> list = acervoGroups.findByUserIdAndEntityTypeOrderByMemberCountDesc(user.id(), type);
        Set<UUID> members = new HashSet<>();
        list.forEach(g -> members.addAll(uuids(Json.strings(g.getMemberIdsJson()))));
        Map<UUID, HypeScoreCurrent> h = hypeV2Of(type, members);
        return list.stream().map(g -> {
            List<String> ids = Json.strings(g.getMemberIdsJson());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", g.getId());
            m.put("label", String.valueOf(g.getLabel()));
            m.put("kind", "SIMILARITY");
            m.put("memberIds", ids);
            m.put("count", g.getMemberCount());
            m.put("computedAt", g.getComputedAt());
            m.put("hype", averageHype(uuids(ids), h, hypeV2Config));
            return m;
        }).toList();
    }

    /** Hype médio v2 de um conjunto (só AVAILABLE): {@code {avgScore, level, items, members}}; sem base, {@code avgScore} nulo. */
    static Map<String, Object> averageHype(Collection<UUID> ids, Map<UUID, HypeScoreCurrent> rows, HypeScoreConfig cfg) {
        double[] scores = ids.stream().map(rows::get).filter(c -> c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null)
                .mapToDouble(c -> c.getScore().doubleValue()).toArray();
        Map<String, Object> m = new LinkedHashMap<>();
        Double avg = scores.length == 0 ? null : Math.round(java.util.Arrays.stream(scores).average().orElse(0) * 10) / 10.0;
        m.put("avgScore", avg);
        m.put("level", avg == null || cfg == null ? null : cfg.level(avg).name());
        m.put("items", scores.length);
        m.put("members", ids.size());
        return m;
    }

    private static List<UUID> uuids(List<String> raw) {
        List<UUID> out = new ArrayList<>();
        for (String r : raw) {
            try {
                out.add(UUID.fromString(r));
            } catch (IllegalArgumentException ignored) {
                // id malformado: fora da média
            }
        }
        return out;
    }

    // ================================================================== ordenação por HypeScore v2 (Looks e Salvos)
    /** Normaliza a ordenação de looks: recent (padrão) · hype_desc · hype_asc · growth (aceita os apelidos em pt). */
    public static String lookSort(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (s) {
            case "hype", "hype_desc", "maior_hype" -> "hype_desc";
            case "hype_asc", "menor_hype" -> "hype_asc";
            case "growth", "crescimento", "em_crescimento" -> "growth";
            default -> "recent";
        };
    }

    /**
     * Comparador pelo Hype v2 ({@link #lookSort}); "sem Hype" (sem linha, dados insuficientes) fica SEMPRE por último —
     * nunca é tratado como 0. {@code growth} = Δ pontos em 7 dias, depois a dimensão Trend. {@code recent} não ordena
     * (quem chama completa com a ordem recente).
     */
    static <T> Comparator<T> hypeOrder(String sort, Function<T, HypeScoreCurrent> rowOf) {
        Function<T, BigDecimal> score = x -> {
            HypeScoreCurrent c = rowOf.apply(x);
            return c == null || c.getStatus() != HypeStatus.AVAILABLE ? null : c.getScore();
        };
        Function<T, BigDecimal> delta = x -> {
            HypeScoreCurrent c = rowOf.apply(x);
            return c == null || c.getStatus() != HypeStatus.AVAILABLE ? null : c.getDeltaPoints();
        };
        Function<T, BigDecimal> trend = x -> {
            HypeScoreCurrent c = rowOf.apply(x);
            return c == null || c.getDimensions() == null ? null : c.getDimensions().getTrend();
        };
        return switch (sort) {
            case "hype_desc" -> Comparator.comparing(score, Comparator.nullsLast(Comparator.reverseOrder()));
            case "hype_asc" -> Comparator.comparing(score, Comparator.nullsLast(Comparator.naturalOrder()));
            case "growth" -> Comparator.comparing(delta, Comparator.nullsLast(Comparator.<BigDecimal>reverseOrder()))
                    .thenComparing(trend, Comparator.nullsLast(Comparator.reverseOrder()));
            default -> (a, b) -> 0;
        };
    }

    /**
     * Hype que pode ordenar para quem vê (§3.1 da auditoria): o dono vê o próprio Hype pessoal (inclusive de item
     * privado); para terceiros, só linha {@code publicEligible}. O resto some do mapa (= sem Hype, por último).
     */
    static Map<UUID, HypeScoreCurrent> rankable(Map<UUID, HypeScoreCurrent> rows, UUID viewerId) {
        Map<UUID, HypeScoreCurrent> out = new HashMap<>();
        rows.forEach((id, c) -> {
            if (c.isPublicEligible() || (viewerId != null && viewerId.equals(c.getOwnerId()))) {
                out.put(id, c);
            }
        });
        return out;
    }

    /** Estado v2 atual (uma consulta). Só lê o que o job gravou — GET nunca recalcula. */
    Map<UUID, HypeScoreCurrent> hypeV2Of(HypeEntityType type, Collection<UUID> ids) {
        return hypeV2Of(hypeV2, hypeV2Config, type, ids);
    }

    static Map<UUID, HypeScoreCurrent> hypeV2Of(HypeScoreCurrentRepository repo, HypeScoreConfig cfg, HypeEntityType type, Collection<UUID> ids) {
        if (repo == null || cfg == null || ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return repo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, new HashSet<>(ids), cfg.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, c -> c, (a, b) -> a));
    }

    @Transactional
    public void discardGroup(CurrentUser user, UUID groupId) {
        AcervoGroup g = acervoGroups.findById(groupId).orElseThrow(() -> ApiException.notFound("Agrupamento"));
        guard.requireOwner(user, g.getUser().getId(), "acervo-group:" + groupId);
        acervoGroups.delete(g);
    }

    // ================================================================== agrupamentos editoriais (coleções, eras, fases, temporadas, turnês)
    /**
     * @param periodFrom/periodTo período da era (anos) ou ano da coleção — filtro e ranking de insights (RF22)
     * @param accentColor         cor do palco 2D / mini loja 3D e do header da busca por era/coleção
     */
    public record GroupingForm(GroupingType type, String label, String description, String coverUrl, String atmospherePrompt,
                               Integer periodFrom, Integer periodTo, String accentColor, Integer sortOrder) {
    }

    static final Set<GroupingType> PERSONAL = Set.of(GroupingType.COLLECTION, GroupingType.EVOLUTION, GroupingType.STYLE_LINE, GroupingType.SEASON);
    static final Set<GroupingType> BRAND = Set.of(GroupingType.COLLECTION, GroupingType.PROMOTION, GroupingType.SIGNATURE_SERIES, GroupingType.SEASON, GroupingType.STYLE_LINE);
    static final Set<GroupingType> CELEBRITY = Set.of(GroupingType.ERA, GroupingType.PHASE, GroupingType.SEASON, GroupingType.TOUR, GroupingType.COLLECTION);

    @Transactional
    public Map<String, Object> createGrouping(CurrentUser user, GroupingForm f) {
        User owner = users.findById(user.id()).orElseThrow();
        Set<GroupingType> allowed = owner.getProfileType() == ProfileType.MARCA ? BRAND : owner.getProfileType() == ProfileType.CELEBRIDADE ? CELEBRITY : PERSONAL;
        if (f.type() == null || !allowed.contains(f.type())) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("lookbook.tipos_permitidos_para_o_seu", allowed));
        }
        SchemeGrouping g = new SchemeGrouping();
        g.setOwner(owner);
        g.setType(f.type());
        g.setLabel(InputSanitizer.required("label", f.label(), 2, 80));
        g.setDescription(f.description() == null ? null : InputSanitizer.clean(f.description(), 300));
        g.setCoverUrl(ownMedia.require(owner.getId(), f.coverUrl(), "coverUrl", true));
        g.setAtmospherePrompt(f.atmospherePrompt() == null ? null : InputSanitizer.clean(f.atmospherePrompt(), 300));
        applyPeriod(g, f);
        groupings.save(g);
        return groupingView(g);
    }

    private static void applyPeriod(SchemeGrouping g, GroupingForm f) {
        if (f.periodFrom() != null) {
            g.setPeriodFrom(year(f.periodFrom()));
        }
        if (f.periodTo() != null) {
            g.setPeriodTo(year(f.periodTo()));
        }
        if (g.getPeriodFrom() != null && g.getPeriodTo() != null && g.getPeriodTo() < g.getPeriodFrom()) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("lookbook.o_fim_do_periodo_vem"));
        }
        if (f.accentColor() != null) {
            if (!f.accentColor().isBlank() && !f.accentColor().matches("#[0-9A-Fa-f]{6}")) {
                throw ApiException.badRequest("COR_INVALIDA", Msg.t("lookbook.use_a_cor_em_hexadecimal"));
            }
            g.setAccentColor(f.accentColor().isBlank() ? null : f.accentColor().toUpperCase(java.util.Locale.ROOT));
        }
        if (f.sortOrder() != null) {
            g.setSortOrder(f.sortOrder());
        }
    }

    private static int year(int y) {
        if (y < 1900 || y > 2100) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("lookbook.ano_fora_do_intervalo_1900"));
        }
        return y;
    }

    @Transactional
    public Map<String, Object> updateGrouping(CurrentUser user, UUID id, GroupingForm f) {
        SchemeGrouping g = groupings.findById(id).orElseThrow(() -> ApiException.notFound("Agrupamento"));
        guard.requireOwner(user, g.getOwner().getId(), "grouping:" + id);
        if (f.label() != null) {
            g.setLabel(InputSanitizer.required("label", f.label(), 2, 80));
        }
        if (f.description() != null) {
            g.setDescription(InputSanitizer.clean(f.description(), 300));
        }
        if (f.coverUrl() != null) {
            // capa: imagem enviada pelo próprio dono (ou do catálogo do sistema); vazio remove a capa
            g.setCoverUrl(ownMedia.requireOrUnchanged(g.getOwner().getId(), f.coverUrl(), "coverUrl", true, g.getCoverUrl()));
        }
        if (f.atmospherePrompt() != null) {
            g.setAtmospherePrompt(InputSanitizer.clean(f.atmospherePrompt(), 300));
        }
        applyPeriod(g, f);
        groupings.save(g);
        return groupingView(g);
    }

    @Transactional
    public void deleteGrouping(CurrentUser user, UUID id) {
        SchemeGrouping g = groupings.findById(id).orElseThrow(() -> ApiException.notFound("Agrupamento"));
        guard.requireOwner(user, g.getOwner().getId(), "grouping:" + id);
        for (Scheme s : schemes.findByUserIdOrderByCreatedAtDesc(user.id())) {
            if (id.equals(s.getGroupingId())) {
                s.setGroupingId(null);
            }
        }
        for (WardrobeItem w : pieces.findByUserIdOrderByCreatedAtDesc(user.id())) {
            if (id.equals(w.getGroupingId())) {
                w.setGroupingId(null);
            }
        }
        groupings.delete(g);
    }

    @Transactional
    public Map<String, Object> assignToGrouping(CurrentUser user, UUID groupingId, List<UUID> schemeIds, List<UUID> pieceIds) {
        if (groupingId != null) {
            SchemeGrouping g = groupings.findById(groupingId).orElseThrow(() -> ApiException.notFound("Agrupamento"));
            guard.requireOwner(user, g.getOwner().getId(), "grouping:" + groupingId);
        }
        int n = 0;
        for (UUID id : schemeIds == null ? List.<UUID>of() : schemeIds) {
            Scheme s = schemeService.owned(user, id);
            s.setGroupingId(groupingId);
            n++;
        }
        for (UUID id : pieceIds == null ? List.<UUID>of() : pieceIds) {
            WardrobeItem w = wardrobe.owned(user, id);
            w.setGroupingId(groupingId);
            n++;
        }
        return Map.of("assigned", n, "groupingId", groupingId == null ? "" : groupingId.toString());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> groupingsOf(CurrentUser viewer, UUID ownerId) {
        User owner = users.findById(ownerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        boolean self = viewer != null && viewer.id().equals(ownerId);
        // mesma regra do perfil: perfil privado/restrito (ou bloqueio) não expõe nem os nomes dos agrupamentos
        if (!self && !guard.canView(viewer, ownerId, owner.getProfileVisibility())) {
            return List.of();
        }
        Map<UUID, Long> schemeCounts = new HashMap<>();
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED)) {
            boolean visible = self || (s.getStatus() == SchemeStatus.PUBLISHED && guard.canView(viewer, ownerId, SchemeService.moreRestrictive(s.getVisibility(), owner.getProfileVisibility())));
            if (s.getGroupingId() != null && visible) {
                schemeCounts.merge(s.getGroupingId(), 1L, Long::sum);
            }
        }
        return groupings.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream().map(g -> {
            Map<String, Object> m = groupingView(g);
            m.put("schemes", schemeCounts.getOrDefault(g.getId(), 0L));
            return m;
        }).toList();
    }

    Map<String, Object> groupingView(SchemeGrouping g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.getId());
        m.put("type", g.getType().name());
        m.put("label", g.getLabel());
        m.put("description", g.getDescription());
        m.put("coverUrl", g.getCoverUrl());
        m.put("atmospherePrompt", g.getAtmospherePrompt());
        m.put("periodFrom", g.getPeriodFrom());
        m.put("periodTo", g.getPeriodTo());
        m.put("accentColor", g.getAccentColor());
        m.put("sortOrder", g.getSortOrder());
        return m;
    }

    /** Esquemas visíveis de um agrupamento (eras/fases/temporadas do RF22, coleções do RF14). */
    @Transactional(readOnly = true)
    public List<Views.SchemeView> groupingSchemes(CurrentUser viewer, UUID groupingId) {
        SchemeGrouping g = groupings.findById(groupingId).orElseThrow(() -> ApiException.notFound("Agrupamento"));
        UUID ownerId = g.getOwner().getId();
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED).stream()
                .filter(s -> groupingId.equals(s.getGroupingId()))
                .filter(s -> (viewer != null && viewer.id().equals(ownerId)) || schemeService.canView(viewer, s))
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
    }
}
