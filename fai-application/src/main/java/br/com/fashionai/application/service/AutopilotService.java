package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.WeekPlan;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * HU17 — Autopiloto de Looks e HU18 — Semana Planejada (autopiloto-architecture.md). Mesmo motor do Copilot e do
 * Vista-me (RF24, "um motor, três portas"): candidatas geradas localmente só com peças disponíveis, filtro climático,
 * pontuação (ocasião 0,35 · clima 0,25 · preferências aprendidas 0,25 · diversidade 0,15), escolha/justificativa pela
 * IA entre candidatas já validadas (sem alucinação possível) e fallback local.
 */
@Service
public class AutopilotService {
    public static final int MIN_PIECES = 3;
    static final double W_OCCASION = 0.35, W_CLIMATE = 0.25, W_PREFERENCE = 0.25, W_DIVERSITY = 0.15;

    public record DailyRequest(List<String> occasion, String mood, String city, Double latitude, Double longitude, List<String> excludeKeys) {
    }

    public record DayRequest(LocalDate date, String event, String occasion) {
    }

    public record WeekRequest(LocalDate weekStart, List<DayRequest> days, String city, Double latitude, Double longitude) {
    }

    record Candidate(List<WardrobeItem> pieces, String key, double score, Map<String, Double> criteria, LocalSchemeComposer.Composition composition) {
    }

    private final WardrobeService wardrobe;
    private final WardrobeItemRepository pieces;
    private final SchemeService schemeService;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final DailyLookService dailyLooks;
    private final WeekPlanRepository weekPlans;
    private final WeekPlanDayRepository weekDays;
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final PreferenceModel preferenceModel;
    private final WeatherService weather;
    private final AiEngine ai;
    private final Guard guard;

    public AutopilotService(WardrobeService wardrobe, WardrobeItemRepository pieces, SchemeService schemeService, SchemeRepository schemes,
                            SchemeItemRepository schemeItems, DailyLookService dailyLooks, WeekPlanRepository weekPlans, WeekPlanDayRepository weekDays,
                            UserRepository users, UserPreferencesRepository preferences, PreferenceModel preferenceModel, WeatherService weather,
                            AiEngine ai, Guard guard) {
        this.wardrobe = wardrobe;
        this.pieces = pieces;
        this.schemeService = schemeService;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.weekPlans = weekPlans;
        this.weekDays = weekDays;
        this.users = users;
        this.preferences = preferences;
        this.preferenceModel = preferenceModel;
        this.weather = weather;
        this.ai = ai;
        this.guard = guard;
    }

    // ================================================================== pontuação (OutfitRankingService)
    static double occasionFit(List<WardrobeItem> look, List<String> occasions) {
        if (occasions == null || occasions.isEmpty()) {
            return 0.6;
        }
        long hits = look.stream().filter(w -> Json.csv(w.getOccasionTags()).stream().anyMatch(occasions::contains)).count();
        return (double) hits / look.size();
    }

    static double climateFit(List<WardrobeItem> look, WeatherService.Context ctx) {
        if (ctx == null || !ctx.available()) {
            return 0.5;
        }
        long bad = look.stream().filter(w -> WeatherService.unsuitable(w.getSubcategory(), ctx.band())).count();
        double base = 1.0 - (double) bad / look.size();
        boolean hasLayer = look.stream().anyMatch(w -> WeatherService.isLayer(w.getSubcategory()));
        if ((ctx.band().equals("CAMADAS") || ctx.band().equals("INVERNO_PESADO")) && !hasLayer) {
            base -= 0.3;
        }
        if (ctx.band().equals("VERAO_LEVE") && hasLayer) {
            base -= 0.2;
        }
        return Math.max(0, base);
    }

    /** Diversidade: favorece peças pouco usadas (evitar deixar peças paradas) e penaliza as já usadas no plano. */
    static double diversity(List<WardrobeItem> look, Map<UUID, Integer> alreadyUsed) {
        double s = 0;
        for (WardrobeItem w : look) {
            double wear = Math.min(1, w.getWearCount() / 20.0);
            s += (1 - wear) - 0.35 * alreadyUsed.getOrDefault(w.getId(), 0);
        }
        return Math.max(0, Math.min(1, s / look.size()));
    }

    List<Candidate> candidates(UUID userId, List<WardrobeItem> eligible, List<String> occasions, String mood, WeatherService.Context ctx,
                               Set<String> exclude, Map<UUID, Integer> alreadyUsed, int limit) {
        return candidates(userId, eligible, occasions, mood, ctx, exclude, alreadyUsed, limit, Set.of());
    }

    List<Candidate> candidates(UUID userId, List<WardrobeItem> eligible, List<String> occasions, String mood, WeatherService.Context ctx,
                               Set<String> exclude, Map<UUID, Integer> alreadyUsed, int limit, Set<UUID> requiredPieceIds) {
        List<WardrobeItem> usable = eligible.stream().filter(w -> ctx == null || !ctx.available() || !WeatherService.unsuitable(w.getSubcategory(), ctx.band())).toList();
        if (usable.size() < 2) {
            usable = eligible;
        }
        String season = ctx != null && ctx.available() ? ctx.season() : null;
        PreferenceModel.Model prefs = preferenceModel.of(userId);
        List<Candidate> out = new ArrayList<>();
        for (LocalSchemeComposer.Composition c : LocalSchemeComposer.compose(usable, occasions, List.of(), season, mood, 60)) {
            Map<UUID, WardrobeItem> byId = usable.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a));
            List<WardrobeItem> look = c.items().stream().map(p -> byId.get(p.wardrobeItemId())).filter(Objects::nonNull).toList();
            if (look.size() < 2) {
                continue;
            }
            if (requiredPieceIds != null && !look.stream().map(WardrobeItem::getId).collect(Collectors.toSet()).containsAll(requiredPieceIds)) {
                continue;
            }
            String key = SchemeService.combinationKey(look.stream().map(WardrobeItem::getId).toList());
            if (exclude.contains(key)) {
                continue;
            }
            Map<String, Double> crit = new LinkedHashMap<>();
            crit.put("ocasiao", occasionFit(look, occasions));
            crit.put("clima", climateFit(look, ctx));
            crit.put("preferencias", prefs.pieceScore(look));
            crit.put("diversidade", diversity(look, alreadyUsed));
            double score = W_OCCASION * crit.get("ocasiao") + W_CLIMATE * crit.get("clima") + W_PREFERENCE * crit.get("preferencias")
                    + W_DIVERSITY * crit.get("diversidade");
            out.add(new Candidate(look, key, score, crit, c));
        }
        out.sort(Comparator.comparingDouble(Candidate::score).reversed());
        return out.stream().limit(limit).toList();
    }

    /** Layout no manequim (RF18/HU09): camada e âncora de cada peça sobre o corpo escolhido. */
    Map<String, Object> mannequin(UUID userId, List<WardrobeItem> look) {
        MannequinSex sex = preferences.findByUserId(userId).map(p -> p.getMannequinSex()).orElse(null);
        if (sex == null) {
            long fem = look.stream().filter(w -> "FEMININO".equals(w.getSex())).count();
            sex = fem > look.size() / 2 ? MannequinSex.FEMININO : MannequinSex.MASCULINO;
        }
        String skin = preferences.findByUserId(userId).map(p -> p.getMannequinSkinTone()).orElse(null);
        var build = preferences.findByUserId(userId).map(p -> p.getMannequinBuild()).orElse(null);
        List<Map<String, Object>> layers = look.stream().map(w -> {
            var slot = LocalSchemeComposer.slotOf(w);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pieceId", w.getId());
            m.put("imageUrl", w.getImageUrl());
            m.put("slot", slot.name());
            m.put("layer", MannequinGeometry.layerOf(slot).name());
            m.put("anchor", MannequinGeometry.anchorOf(slot, w.getSubcategory()));
            return m;
        }).sorted(Comparator.comparingInt(m -> List.of("BASE", "INTERMEDIATE", "OUTER", "ACCESSORY").indexOf(String.valueOf(m.get("layer"))))).toList();
        Map<String, Object> out = new LinkedHashMap<>(MannequinGeometry.describe(sex, build, skin));
        out.put("layers", layers);
        return out;
    }

    Map<String, Object> suggestionView(UUID userId, Candidate c, String rationale, int index) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", c.key());
        m.put("title", Msg.t("autopilot.look_do_dia", index, c.composition().title()));
        m.put("pieceIds", c.pieces().stream().map(WardrobeItem::getId).toList());
        m.put("pieces", c.pieces().stream().map(w -> Views.piece(w, null, null)).toList());
        m.put("occasion", c.composition().occasions());
        m.put("style", c.composition().styles());
        m.put("mood", c.composition().mood());
        m.put("score", Math.round(c.score() * 100) / 100.0);
        m.put("criteria", c.criteria());
        m.put("rationale", rationale);
        m.put("mannequin", mannequin(userId, c.pieces()));
        return m;
    }

    /** A IA escolhe e justifica 3 entre as candidatas validadas; ids fora da lista são descartados. */
    List<Map<String, Object>> pickWithAi(CurrentUser user, List<Candidate> ranked, List<String> occasions, String mood, WeatherService.Context ctx,
                                         AiOutcome<?>[] holder) {
        List<Candidate> pool = ranked.stream().limit(10).toList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < pool.size(); i++) {
            Candidate c = pool.get(i);
            list.add(Map.of("ref", "c" + (i + 1), "pieces", c.pieces().stream().map(w -> w.getName() + " (" + w.getSubcategory() + ", " + w.getColor() + ")").toList(),
                    "score", Math.round(c.score() * 100) / 100.0));
        }
        java.util.function.Supplier<List<Map<String, Object>>> local = () -> {
            List<Map<String, Object>> out = new ArrayList<>();
            for (int i = 0; i < Math.min(3, pool.size()); i++) {
                Candidate c = pool.get(i);
                out.add(suggestionView(user.id(), c, localRationale(c, occasions, ctx), i + 1));
            }
            return out;
        };
        AiOutcome<List<Map<String, Object>>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                "Você é o Autopiloto de Looks do Fashion AI. Escolha EXATAMENTE 3 candidatas distintas (refs c1..c10) e justifique cada uma em até "
                        + "2 frases em " + Msg.languageName() + ", citando ocasião, humor e clima quando houver. Responda SOMENTE com JSON "
                        + "{\"picks\":[{\"ref\":\"c1\",\"rationale\":\"...\"}]}.",
                Msg.t("autopilot.ocasiao_humor_clima_candidatas", occasions, mood, (ctx != null && ctx.available() ? ctx.note() : Msg.t("autopilot.nao_informado")), Json.write(list)), List.of(), 600,
                List.of(Msg.t("autopilot.candidatas_ja_validadas_do_proprio"), Msg.t("autopilot.ocasiao_humor"), ctx != null && ctx.available() ? "clima local" : "sem clima"),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (!(m.get("picks") instanceof List<?> picks)) {
                        return null;
                    }
                    List<Map<String, Object>> out = new ArrayList<>();
                    Set<String> seen = new HashSet<>();
                    for (Object o : picks) {
                        if (!(o instanceof Map<?, ?> p)) {
                            continue;
                        }
                        String ref = String.valueOf(p.get("ref"));
                        if (!ref.startsWith("c")) {
                            continue;
                        }
                        int idx;
                        try {
                            idx = Integer.parseInt(ref.substring(1)) - 1;
                        } catch (NumberFormatException ex) {
                            continue;
                        }
                        if (idx < 0 || idx >= pool.size() || !seen.add(ref)) {
                            continue;
                        }
                        Candidate c = pool.get(idx);
                        String why = p.get("rationale") == null ? localRationale(c, occasions, ctx) : InputSanitizer.clean(String.valueOf(p.get("rationale")), 280);
                        out.add(suggestionView(user.id(), c, why, out.size() + 1));
                        if (out.size() == 3) {
                            break;
                        }
                    }
                    return out.size() < Math.min(3, pool.size()) ? null : out;
                }, local, null));
        holder[0] = outcome;
        return outcome.value() == null ? local.get() : outcome.value();
    }

    static String localRationale(Candidate c, List<String> occasions, WeatherService.Context ctx) {
        StringBuilder sb = new StringBuilder();
        sb.append(c.composition().rationale());
        if (ctx != null && ctx.available()) {
            sb.append(Msg.t("autopilot.pensado_para")).append(ctx.note()).append('.');
        }
        return InputSanitizer.clean(sb.toString(), 280);
    }

    // ================================================================== HU17 — Autopiloto diário
    @Transactional
    public Map<String, Object> daily(CurrentUser user, DailyRequest req) {
        return daily(user, req, Set.of());
    }

    @Transactional
    public Map<String, Object> daily(CurrentUser user, DailyRequest req, Set<UUID> requiredPieceIds) {
        return daily(user, req, requiredPieceIds, null);
    }

    /**
     * weatherBand: faixa de clima dita no pedido ("está frio", "32 graus"); quando presente vale sobre a previsão
     * resolvida, para o filtro e a pontuação de clima (o Copilot a extrai do texto).
     */
    @Transactional
    public Map<String, Object> daily(CurrentUser user, DailyRequest req, Set<UUID> requiredPieceIds, String weatherBand) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        long total = pieces.countByUserId(user.id());
        if (eligible.size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("autopilot.o_autopiloto_precisa_de_ao", MIN_PIECES, eligible.size()), Map.of("href", "/pieces/new", "pieces", total));
        }
        WeatherService.Context ctx = WeatherService.withBand(weather.resolve(req.latitude(), req.longitude(), req.city()), weatherBand);
        List<String> occasions = req.occasion() == null ? List.of() : req.occasion().stream().filter(Taxonomy.OCCASIONS::contains).limit(3).toList();
        Set<String> exclude = new HashSet<>(req.excludeKeys() == null ? List.of() : req.excludeKeys());
        List<Candidate> ranked = candidates(user.id(), eligible, occasions, req.mood(), ctx, exclude, Map.of(), 30,
                requiredPieceIds == null ? Set.of() : requiredPieceIds);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("weather", WeatherService.view(ctx));
        if (ranked.isEmpty()) {
            out.put("suggestions", List.of());
            out.put("message", Msg.t("autopilot.nao_ha_combinacoes_novas_diferentes"));
            return out;
        }
        AiOutcome<?>[] holder = new AiOutcome<?>[1];
        List<Map<String, Object>> picks = pickWithAi(user, ranked, occasions, req.mood(), ctx, holder);
        out.put("suggestions", picks);
        List<String> nextExclude = new ArrayList<>(exclude);
        picks.forEach(p -> nextExclude.add(String.valueOf(p.get("key"))));
        out.put("excludeKeys", nextExclude);
        out.put("fallbackUsed", holder[0] != null && holder[0].fallbackUsed());
        out.put("explanation", holder[0] == null ? null : holder[0].explanation());
        out.put("quota", holder[0] == null ? null : holder[0].quota());
        out.put("message", holder[0] == null ? null : holder[0].userMessage());
        if (!ctx.available()) {
            out.put("weatherNotice", ctx.note());
        }
        if (picks.size() < 3) {
            out.put("notice", Msg.t("autopilot.seu_acervo_permitiu_combinacao_oes", picks.size()));
        }
        return out;
    }

    /** HU17 C5 — o look aprovado vira esquema e é registrado como Look do Dia (source = AUTOPILOTO). */
    @Transactional
    public Map<String, Object> confirmDaily(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion, String mood) {
        Scheme s = createScheme(user, pieceIds, title == null ? Msg.t("autopilot.look_do_dia_autopiloto") : title, occasion, SchemeOrigin.AUTOPILOTO);
        DailyLook dl = dailyLooks.register(user, s, DailyLookSource.AUTOPILOTO, LocalDate.now(FaiPointsService.ZONE));
        return Map.of("schemeId", s.getId(), "dailyLook", dailyLooks.view(dl));
    }

    Scheme createScheme(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion, SchemeOrigin origin) {
        return createScheme(user, pieceIds, title, occasion, origin, null, null, null, null, null);
    }

    Scheme createScheme(CurrentUser user, List<UUID> pieceIds, String title, List<String> occasion, SchemeOrigin origin,
                        List<String> style, String mood, String season, String description, Map<String, Object> background) {
        if (pieceIds == null || pieceIds.size() < 2) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("autopilot.selecione_um_look_com_ao"));
        }
        Map<UUID, WardrobeItem> own = new HashMap<>();
        for (WardrobeItem w : pieces.findByIdIn(pieceIds)) {
            guard.requireOwner(user, w.getUser().getId(), "piece:" + w.getId());
            own.put(w.getId(), w);
        }
        if (style == null && mood == null && season == null && description == null && background == null) {
            String key = SchemeService.combinationKey(pieceIds);
            for (Scheme existing : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
                List<UUID> ids = schemeItems.findBySchemeIdOrderBySortOrder(existing.getId()).stream().map(si -> si.getWardrobeItem().getId()).toList();
                if (ids.size() == pieceIds.size() && SchemeService.combinationKey(ids).equals(key)) {
                    return existing;
                }
            }
        }
        List<SchemeService.ItemForm> items = new ArrayList<>();
        int i = 0;
        for (UUID id : pieceIds) {
            WardrobeItem w = own.get(id);
            if (w == null) {
                throw ApiException.notFound(Msg.t("common.peca"));
            }
            items.add(new SchemeService.ItemForm(id, LocalSchemeComposer.slotOf(w), i, i, null, null, null, null, null, null));
            i++;
        }
        List<WardrobeItem> look = pieceIds.stream().map(own::get).toList();
        LocalSchemeComposer.Composition c = LocalSchemeComposer.toComposition(look, occasion == null ? List.of() : occasion, List.of(), null, 0);
        List<String> validStyles = style == null || style.isEmpty() ? c.styles() : style.stream().filter(Taxonomy.STYLES::contains).distinct().limit(3).toList();
        Season seasonValue = enumValue(Season.class, season);
        Mood moodValue = enumValue(Mood.class, mood);
        SchemeService.SchemeForm form = new SchemeService.SchemeForm(InputSanitizer.clean(title, 120),
                description == null ? null : InputSanitizer.clean(description, 2048), c.occasions(), validStyles, seasonValue, moodValue, null,
                null, items, CreationMode.AI_ASSISTED, origin, null, background, background == null, null, null, null, null, Boolean.FALSE, null);
        Views.SchemeView view = (Views.SchemeView) schemeService.create(user, form).get("scheme");
        return schemes.findById(view.id()).orElseThrow();
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String value) {
        if (value == null) return null;
        try { return Enum.valueOf(type, value.toUpperCase(java.util.Locale.ROOT)); }
        catch (IllegalArgumentException ex) { return null; }
    }

    // ================================================================== HU18 — Semana Planejada
    @Transactional
    public Map<String, Object> planWeek(CurrentUser user, WeekRequest req) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        if (eligible.size() < MIN_PIECES) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE", Msg.t("autopilot.cadastre_ao_menos_pecas_disponiveis", MIN_PIECES),
                    Map.of("href", "/pieces/new"));
        }
        LocalDate start = (req.weekStart() == null ? LocalDate.now(FaiPointsService.ZONE) : req.weekStart()).with(DayOfWeek.MONDAY);
        List<DayRequest> days = new ArrayList<>();
        Map<LocalDate, DayRequest> byDate = new HashMap<>();
        if (req.days() != null) {
            req.days().forEach(d -> {
                if (d.date() != null) {
                    byDate.put(d.date(), d);
                }
            });
        }
        for (int i = 0; i < 7; i++) {
            LocalDate d = start.plusDays(i);
            DayRequest dr = byDate.getOrDefault(d, new DayRequest(d, null, null));
            days.add(new DayRequest(d, dr.event(), dr.occasion() != null && Taxonomy.OCCASIONS.contains(dr.occasion()) ? dr.occasion() : inferOccasion(dr.event())));
        }
        weekPlans.findFirstByUserIdAndStatusOrderByWeekStartDesc(user.id(), WeekPlanStatus.ACTIVE).ifPresent(old -> {
            old.setStatus(WeekPlanStatus.DISCARDED);
            weekPlans.save(old);
        });
        User owner = users.findById(user.id()).orElseThrow();
        WeekPlan plan = new WeekPlan();
        plan.setUser(owner);
        plan.setWeekStart(start);
        plan.setStatus(WeekPlanStatus.ACTIVE);
        weekPlans.save(plan);
        WeatherService.Context ctx = weather.resolve(req.latitude(), req.longitude(), req.city());
        Set<String> used = new HashSet<>();
        Map<UUID, Integer> usage = new HashMap<>();
        List<Map<String, Object>> gaps = new ArrayList<>();
        for (DayRequest d : days) {
            List<String> occ = d.occasion() == null ? List.of() : List.of(d.occasion());
            List<Candidate> ranked = candidates(user.id(), eligible, occ, null, ctx, used, usage, 5);
            WeekPlanDay day = new WeekPlanDay();
            day.setWeekPlan(plan);
            day.setDayDate(d.date());
            day.setEventLabel(d.event() == null ? null : InputSanitizer.clean(d.event(), 80));
            day.setOccasion(d.occasion());
            if (ranked.isEmpty()) {
                day.setRationale(Msg.t("autopilot.lacuna_nao_ha_combinacao_nova"));
                gaps.add(gap(d, eligible, ctx));
            } else {
                Candidate c = ranked.get(0);
                used.add(c.key());
                c.pieces().forEach(w -> usage.merge(w.getId(), 1, Integer::sum));
                day.setPieceIdsJson(Json.write(c.pieces().stream().map(w -> w.getId().toString()).toList()));
                day.setCombinationKey(c.key());
                day.setRationale(localRationale(c, occ, ctx));
            }
            weekDays.save(day);
        }
        plan.setGapsJson(Json.write(gaps));
        weekPlans.save(plan);
        return planView(user, plan);
    }

    static String inferOccasion(String event) {
        if (event == null) {
            return null;
        }
        String e = event.toLowerCase();
        for (Map.Entry<String, List<String>> k : MirrorService.KEYWORDS.entrySet()) {
            if (e.contains(k.getKey())) {
                return k.getValue().get(0);
            }
        }
        return "casual";
    }

    /** HU18 C2 — lacuna com sugestões de peças do catálogo de marcas (perfis de marca, peças públicas). */
    Map<String, Object> gap(DayRequest d, List<WardrobeItem> eligible, WeatherService.Context ctx) {
        List<LocalAdvisors.PieceSuggestion> generic = LocalAdvisors.wardrobeGaps(eligible, ctx.available() ? ctx.temperatureC() : null);
        Set<String> wanted = generic.stream().map(LocalAdvisors.PieceSuggestion::subcategory).collect(Collectors.toCollection(LinkedHashSet::new));
        List<Map<String, Object>> catalog = pieces.findAllPublic(Pageable.ofSize(300)).stream()
                .filter(w -> w.getUser().getProfileType() == ProfileType.MARCA)
                .filter(w -> wanted.contains(w.getSubcategory()) || (d.occasion() != null && Json.csv(w.getOccasionTags()).contains(d.occasion())))
                .limit(4).map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "brand", String.valueOf(w.getBrandName()),
                        "imageUrl", String.valueOf(w.getImageUrl()), "external", true)).toList();
        return Map.of("date", d.date(), "occasion", String.valueOf(d.occasion()), "suggestions", generic.stream()
                .map(g -> Map.of("subcategory", g.subcategory(), "color", g.color(), "reason", g.reason())).toList(), "brandCatalog", catalog,
                "note", Msg.t("autopilot.sugestoes_externas_so_entram_no"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> currentWeek(CurrentUser user) {
        return weekPlans.findFirstByUserIdAndStatusOrderByWeekStartDesc(user.id(), WeekPlanStatus.ACTIVE).map(p -> planView(user, p))
                .orElseGet(() -> Map.of("active", false, "message", Msg.t("autopilot.nenhuma_semana_planejada_ativa")));
    }

    Map<String, Object> planView(CurrentUser user, WeekPlan plan) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        List<Map<String, Object>> days = new ArrayList<>();
        for (WeekPlanDay d : weekDays.findByWeekPlanIdOrderByDayDate(plan.getId())) {
            List<UUID> ids = Json.strings(d.getPieceIdsJson()).stream().map(UUID::fromString).toList();
            Map<UUID, WardrobeItem> byId = ids.isEmpty() ? Map.of() : pieces.findByIdIn(ids).stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("date", d.getDayDate());
            m.put("today", d.getDayDate().equals(today));
            m.put("event", d.getEventLabel());
            m.put("occasion", d.getOccasion());
            m.put("pieces", ids.stream().map(byId::get).filter(Objects::nonNull).map(w -> Views.piece(w, null, null)).toList());
            m.put("gap", ids.isEmpty());
            m.put("rationale", d.getRationale());
            m.put("editedManually", d.isEditedManually());
            m.put("schemeId", d.getScheme() == null ? null : d.getScheme().getId());
            days.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active", plan.getStatus() == WeekPlanStatus.ACTIVE);
        out.put("id", plan.getId());
        out.put("weekStart", plan.getWeekStart());
        out.put("days", days);
        out.put("gaps", Json.list(plan.getGapsJson()));
        out.put("distinctLooks", days.stream().filter(m -> !Boolean.TRUE.equals(m.get("gap"))).count());
        return out;
    }

    /** HU18 C3 — edita só o dia escolhido e revalida que não há repetição de combinação. */
    @Transactional
    public Map<String, Object> editDay(CurrentUser user, UUID dayId, List<UUID> pieceIds) {
        WeekPlanDay day = weekDays.findById(dayId).orElseThrow(() -> ApiException.notFound(Msg.t("autopilot.dia_do_plano")));
        guard.requireOwner(user, day.getWeekPlan().getUser().getId(), "week-plan:" + day.getWeekPlan().getId());
        if (pieceIds == null || pieceIds.size() < 2) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("autopilot.o_look_do_dia_precisa"));
        }
        for (WardrobeItem w : pieces.findByIdIn(pieceIds)) {
            guard.requireOwner(user, w.getUser().getId(), "piece:" + w.getId());
        }
        String key = SchemeService.combinationKey(pieceIds);
        for (WeekPlanDay other : weekDays.findByWeekPlanIdOrderByDayDate(day.getWeekPlan().getId())) {
            if (!other.getId().equals(dayId) && key.equals(other.getCombinationKey())) {
                throw new ApiException(409, "COMBINACAO_REPETIDA", Msg.t("autopilot.essa_combinacao_ja_esta_planejada", other.getDayDate()));
            }
        }
        day.setPieceIdsJson(Json.write(pieceIds.stream().map(UUID::toString).toList()));
        day.setCombinationKey(key);
        day.setEditedManually(true);
        day.setRationale(Msg.t("autopilot.editado_por_voce"));
        day.setScheme(null);
        weekDays.save(day);
        return planView(user, day.getWeekPlan());
    }

    /** HU18 C5 — descarta o plano sem afetar esquemas já salvos. */
    @Transactional
    public Map<String, Object> discardWeek(CurrentUser user) {
        WeekPlan plan = weekPlans.findFirstByUserIdAndStatusOrderByWeekStartDesc(user.id(), WeekPlanStatus.ACTIVE)
                .orElseThrow(() -> ApiException.notFound(Msg.t("autopilot.semana_planejada")));
        weekDays.deleteAll(weekDays.findByWeekPlanIdOrderByDayDate(plan.getId()));
        plan.setStatus(WeekPlanStatus.DISCARDED);
        weekPlans.save(plan);
        return Map.of("discarded", true, "note", Msg.t("autopilot.esquemas_ja_salvos_continuam_no"));
    }

    /** Usa o look planejado do dia: cria o esquema (se preciso) e registra o Look do Dia vinculado ao dia do plano. */
    @Transactional
    public Map<String, Object> useDay(CurrentUser user, UUID dayId) {
        WeekPlanDay day = weekDays.findById(dayId).orElseThrow(() -> ApiException.notFound(Msg.t("autopilot.dia_do_plano")));
        guard.requireOwner(user, day.getWeekPlan().getUser().getId(), "week-plan:" + day.getWeekPlan().getId());
        List<UUID> ids = Json.strings(day.getPieceIdsJson()).stream().map(UUID::fromString).toList();
        if (ids.isEmpty()) {
            throw new ApiException(409, "DIA_SEM_LOOK", Msg.t("autopilot.este_dia_e_uma_lacuna"));
        }
        Scheme s = day.getScheme() != null ? day.getScheme() : createScheme(user, ids, Msg.t("autopilot.semana_planejada_2", day.getDayDate()),
                day.getOccasion() == null ? List.of() : List.of(day.getOccasion()), SchemeOrigin.AUTOPILOTO);
        day.setScheme(s);
        weekDays.save(day);
        DailyLook dl = dailyLooks.register(user, s, DailyLookSource.AUTOPILOTO, day.getDayDate());
        dl.setWeekPlanDayId(day.getId());
        return Map.of("schemeId", s.getId(), "dailyLook", dailyLooks.view(dl));
    }
}
