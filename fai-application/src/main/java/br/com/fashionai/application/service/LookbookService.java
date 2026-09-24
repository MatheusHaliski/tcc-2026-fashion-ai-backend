package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.AcervoGroup;
import br.com.fashionai.domain.model.DailyLook;
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
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.AcervoGroupRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF6 — Perfil Lookbook: abas Closet Digital, Looks Salvos (próprios + salvos de terceiros com origem), Look do Dia
 * (painel do Hype Score em 6 versões, continuidade na virada do dia, feedback HU19), Minha Cápsula & Versatilidade
 * (generalização do B4 do DNA), agrupamentos sugeridos do acervo (RF24.CA05) e agrupamentos editoriais (coleções,
 * eras, fases, temporadas, turnês) para perfis pessoais e institucionais.
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

    public LookbookService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, SavedItemRepository saved,
                           UserRepository users, AcervoGroupRepository acervoGroups, SchemeGroupingRepository groupings, WardrobeService wardrobe,
                           SchemeService schemeService, SocialService social, DailyLookService dailyLooks, HypeScoreService hype, AiEngine ai,
                           Guard guard) {
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
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("owner", Views.user(owner));
        out.put("self", self);
        out.put("visible", canSee);
        out.put("institutional", owner.getProfileType() != ProfileType.PESSOAL);
        // Peças e esquemas nunca dividem a mesma aba: Closet/Peças salvas (peças) × Looks/Looks salvos (esquemas).
        out.put("tabs", List.of(Map.of("id", "closet", "label", "Closet Digital", "count", all.size()),
                Map.of("id", "looks", "label", "Looks", "count", looks.size()),
                Map.of("id", "saved_looks", "label", "Looks salvos", "count", self ? saved.countByUserIdAndTargetType(ownerId, TargetType.SCHEME) : 0),
                Map.of("id", "saved_pieces", "label", "Peças salvas", "count", self ? saved.countByUserIdAndTargetType(ownerId, TargetType.PIECE) : 0),
                Map.of("id", "daily", "label", "Look do Dia", "count", self ? dailyLooks.today(ownerId).isPresent() ? 1 : 0 : 0),
                Map.of("id", "capsule", "label", "Minha Cápsula", "count", looks.isEmpty() ? 0 : basePieces(looks).size()),
                Map.of("id", "room", "label", "Meu Guarda-Roupa", "count", all.size())));
        out.put("emptyCloset", all.isEmpty() ? Map.of("message", "Seu Closet Digital está vazio.", "action", Map.of("label", "Adicionar nova peça", "href", "/add-piece")) : null);
        out.put("panelVersion", owner.getLookDoDiaPanelVersion() == null ? HypeScorePanelVersion.SPOTLIGHT_CLASSICO.name() : owner.getLookDoDiaPanelVersion().name());
        out.put("groupingSuggestionsAvailable", self && all.size() >= GROUPING_MIN_PIECES);
        return out;
    }

    // ================================================================== Looks Salvos (CA09–CA13)
    @Transactional
    public Views.Page<Map<String, Object>> savedLooks(CurrentUser user, String occasion, int page, int size) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            if (occasion != null && !occasion.isBlank() && !Json.csv(s.getOccasion()).contains(occasion)) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("origin", "PROPRIO");
            m.put("originLabel", "Seu look");
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
            m.put("originLabel", "Salvo de @" + s.getUser().getUsername());
            m.put("author", Views.user(s.getUser()));
            m.put("scheme", schemeService.view(user, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            m.put("favorite", si.isFavorite());
            m.put("canEdit", false);
            m.put("savedAt", si.getSavedAt());
            m.put("sortKey", si.getSavedAt());
            rows.add(m);
        }
        rows.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("sortKey"))).reversed());
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
            m.put("originLabel", own ? "Sua peça" : "Salva de @" + w.getUser().getUsername());
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
            throw ApiException.notFound("Look salvo");
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
            out.put("empty", Map.of("message", "Nenhum Look do Dia marcado ainda.", "actions", List.of(
                    Map.of("label", "Marcar um look salvo", "href", "/profile?tab=looks"), Map.of("label", "Usar o Autopiloto", "href", "/autopilot"),
                    Map.of("label", "Vista-me no espelho", "href", "/my-wardrobe/room"))));
        }
        out.put("history", dailyLooks.history(user));
        out.put("feedbackReminder", dailyLooks.pendingFeedback(user));
        out.put("feedbackOptions", List.of("ADOREI", "NAO_USEI", "NAO_GOSTEI"));
        return out;
    }

    public static List<Map<String, Object>> panelVersions() {
        return List.of(
                Map.of("code", "SPOTLIGHT_CLASSICO", "name", "Spotlight Clássico", "emphasis", "Equilíbrio", "hype", "barra horizontal + texto", "bestFor", "padrão geral"),
                Map.of("code", "PASSARELA", "name", "Passarela", "emphasis", "Celebração/drama", "hype", "termômetro vertical", "bestFor", "scores altos, compartilhamento"),
                Map.of("code", "RAIO_X_ESTILO", "name", "Raio-X do Estilo", "emphasis", "Transparência do cálculo", "hype", "número + breakdown expandido", "bestFor", "usuários avançados"),
                Map.of("code", "BENTO_DIA", "name", "Bento do Dia", "emphasis", "Priorização configurável", "hype", "bloco fixo grande", "bestFor", "usuários recorrentes"),
                Map.of("code", "EDITORIAL_MINIMAL", "name", "Editorial Minimal", "emphasis", "Minimalismo", "hype", "número discreto", "bestFor", "baixa tolerância a gamificação"),
                Map.of("code", "COACH_ESTILO", "name", "Coach de Estilo", "emphasis", "Orientação acionável", "hype", "secundário, abaixo da sugestão", "bestFor", "scores baixos/médios"));
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
            out.put("empty", Map.of("message", "A cápsula só faz sentido com ao menos 1 look montado.", "action", Map.of("label", "Criar meu primeiro look", "href", "/create-my-scheme")));
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
        out.put("note", "Não inclui itens salvos de terceiros — cápsula é sobre o que você possui.");
        return out;
    }

    // ================================================================== agrupamentos sugeridos do acervo (RF24.CA05)
    @Transactional
    public Map<String, Object> suggestGroups(CurrentUser user, HypeEntityType type) {
        List<Similarity.Signature> sigs;
        List<UUID> ids;
        List<String> labels;
        if (type == HypeEntityType.PIECE) {
            List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
            if (all.size() < GROUPING_MIN_PIECES) {
                throw new ApiException(422, "ACERVO_PEQUENO", "Os agrupamentos sugeridos aparecem a partir de " + GROUPING_MIN_PIECES + " peças (RF24.CA05).",
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
        AiOutcome<List<List<Integer>>> outcome = ai.local(user.id(), AiCapability.ACERVO_GROUPING, List.of("estilos, ocasiões, cores, marcas e tipos do próprio acervo"),
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
                    "count", cluster.size()));
        }
        return Map.of("groups", out, "type", type.name(), "explanation", outcome.explanation(), "note", "Sugestões sempre descartáveis (RF24.CA05).");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> groups(CurrentUser user, HypeEntityType type) {
        return acervoGroups.findByUserIdAndEntityTypeOrderByMemberCountDesc(user.id(), type).stream().map(g -> Map.<String, Object>of("id", g.getId(),
                "label", String.valueOf(g.getLabel()), "memberIds", Json.strings(g.getMemberIdsJson()), "count", g.getMemberCount(), "computedAt", g.getComputedAt())).toList();
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
            throw ApiException.badRequest("TIPO_INVALIDO", "Tipos permitidos para o seu perfil: " + allowed);
        }
        SchemeGrouping g = new SchemeGrouping();
        g.setOwner(owner);
        g.setType(f.type());
        g.setLabel(InputSanitizer.required("label", f.label(), 2, 80));
        g.setDescription(f.description() == null ? null : InputSanitizer.clean(f.description(), 300));
        g.setCoverUrl(f.coverUrl());
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
            throw ApiException.badRequest("PERIODO_INVALIDO", "O fim do período vem antes do início.");
        }
        if (f.accentColor() != null) {
            if (!f.accentColor().isBlank() && !f.accentColor().matches("#[0-9A-Fa-f]{6}")) {
                throw ApiException.badRequest("COR_INVALIDA", "Use a cor em hexadecimal (#RRGGBB).");
            }
            g.setAccentColor(f.accentColor().isBlank() ? null : f.accentColor().toUpperCase(java.util.Locale.ROOT));
        }
        if (f.sortOrder() != null) {
            g.setSortOrder(f.sortOrder());
        }
    }

    private static int year(int y) {
        if (y < 1900 || y > 2100) {
            throw ApiException.badRequest("PERIODO_INVALIDO", "Ano fora do intervalo 1900–2100.");
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
            g.setCoverUrl(f.coverUrl());
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
