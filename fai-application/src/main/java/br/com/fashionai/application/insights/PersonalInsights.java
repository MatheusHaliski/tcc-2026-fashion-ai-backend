package br.com.fashionai.application.insights;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CopilotService;
import br.com.fashionai.application.service.LookbookService;
import br.com.fashionai.application.service.RoomService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.insights.Insight.CAPSULE;
import static br.com.fashionai.application.insights.Insight.HYPE_V2;
import static br.com.fashionai.application.insights.Insight.INVENTORY_COMBOS;
import static br.com.fashionai.application.insights.Insight.STYLE_DNA;
import static br.com.fashionai.application.insights.Insight.Tone.ATTENTION;
import static br.com.fashionai.application.insights.Insight.Tone.NEUTRAL;
import static br.com.fashionai.application.insights.Insight.Tone.POSITIVE;
import static br.com.fashionai.application.insights.Insight.WARDROBE_USAGE;
import static br.com.fashionai.application.insights.InsightMath.action;
import static br.com.fashionai.application.insights.InsightMath.args;
import static br.com.fashionai.application.insights.InsightMath.fmt0;
import static br.com.fashionai.application.insights.InsightMath.fmt1;
import static br.com.fashionai.application.insights.InsightMath.insight;
import static br.com.fashionai.application.insights.InsightMath.metric;
import static br.com.fashionai.application.insights.InsightMath.round;
import static br.com.fashionai.application.insights.InsightMath.round1;

/**
 * Insights pessoais (Cápsula, Copilot, Autopiloto, Histórico, Guarda-roupa e Looks). Regras do produto, sempre:
 * o Hype aparece AO LADO da compatibilidade com o DNA e/ou do uso real (nunca sozinho, nunca como critério único);
 * redescoberta do que está parado (a régua única {@link RoomService#FORGOTTEN_DAYS}) vem antes de qualquer compra; a
 * sugestão de compra é genérica (subcategoria + cor, nunca marca) e só entra no fim; texto descritivo, sem juízo de valor.
 */
final class PersonalInsights {
    /** Uma peça "dentro do DNA": compatibilidade a partir de 60%. */
    static final int ALIGNED = 60;
    static final String SOCIAL = "SOCIAL";

    private final HypeScoreConfig config;
    private final HypeQueryService hype;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final StyleDnaRepository dnas;
    private final UserPreferencesRepository preferences;
    private final LookbookService lookbook;
    private final WardrobeService wardrobe;

    PersonalInsights(HypeScoreConfig config, HypeQueryService hype, WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                     StyleDnaRepository dnas, UserPreferencesRepository preferences, LookbookService lookbook, WardrobeService wardrobe) {
        this.config = config;
        this.hype = hype;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.preferences = preferences;
        this.lookbook = lookbook;
        this.wardrobe = wardrobe;
    }

    /** O que a pessoa tem, com o Hype v2 de cada peça e o DNA (lido uma vez por pedido). */
    record Personal(CurrentUser user, LocalDate today, List<WardrobeItem> pieces, List<WardrobeItem> available, Map<UUID, WardrobeItem> byId,
                    Map<UUID, HypeScoreCurrent> hype, StyleCompatibility.Profile dna) {

        /** Hype calculado e disponível (sem "dados insuficientes"). */
        HypeScoreCurrent scored(UUID id) {
            HypeScoreCurrent c = hype.get(id);
            return c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null ? c : null;
        }

        Integer compat(WardrobeItem w) {
            if (dna == null) {
                return null;
            }
            Map<String, Object> m = StyleCompatibility.score(dna, HypeQueryService.profileOf(w));
            return m == null ? null : ((Number) m.get("score")).intValue();
        }

        /** "Esquecida": a régua única do app (60+ dias desde o último uso ou, se nunca usada, desde o cadastro). */
        boolean idle(WardrobeItem w) {
            return RoomService.forgotten(w, w.getLastWornDate(), today) && HypeQueryService.idleDays(w, today) >= RoomService.FORGOTTEN_DAYS;
        }
    }

    Personal load(CurrentUser user) {
        LocalDate today = LocalDate.now(RoomService.ZONE);
        List<WardrobeItem> all = Optional.ofNullable(pieces.findByUserIdOrderByCreatedAtDesc(user.id())).orElse(List.of()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        List<WardrobeItem> available = all.stream().filter(w -> w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE).toList();
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Map<UUID, HypeScoreCurrent> h = byId.isEmpty() ? Map.of() : Optional.ofNullable(hype.currentOf(HypeEntityType.PIECE, byId.keySet())).orElse(Map.of());
        StyleCompatibility.Profile dna = dnas.findByUserId(user.id()).map(HypeQueryService::profileOf).filter(p -> !p.empty()).orElse(null);
        return new Personal(user, today, all, available, byId, h, dna);
    }

    List<Insight> build(InsightContext ctx, CurrentUser user) {
        return build(ctx, user, List.of());
    }

    /** @param selected peças escolhidas no editor de look (LOOK_EDITOR); só as da própria pessoa contam */
    List<Insight> build(InsightContext ctx, CurrentUser user, List<UUID> selected) {
        Personal p = load(user);
        List<Insight> out = new ArrayList<>();
        switch (ctx) {
            case LOOK_EDITOR -> lookEditor(p, selected == null ? List.of() : selected, out);
            case CAPSULE -> capsule(p, out);
            case COPILOT -> copilot(p, out);
            case AUTOPILOT -> autopilot(p, out);
            case HISTORY -> history(p, out);
            case CLOSET -> closet(p, out);
            case LOOKS -> looks(p, out);
            default -> {
            }
        }
        return out;
    }

    // ================================================================== contextos
    void capsule(Personal p, List<Insight> out) {
        Map<String, Object> cap = lookbook.capsule(p.user(), null);
        if (cap == null || cap.get("empty") != null || intOf(cap.get("looks")) == 0) {
            out.add(insight("CAPSULE_START", NEUTRAL, 0.95, "insights.capsule_start.text", args(),
                    null, action("insights.action.criar_look", "/schemes/new"), CAPSULE));
        } else {
            int base = intOf(cap.get("basePieces"));
            int looks = intOf(cap.get("looks"));
            double factor = cap.get("factor") instanceof Number n ? n.doubleValue() : (double) looks / Math.max(1, base);
            out.add(insight("CAPSULE_VERSATILITY", factor >= 1.5 ? POSITIVE : NEUTRAL, 0.95, "insights.capsule_versatility.text",
                    args(base, looks, fmt1(factor)), metric("insights.metric.fator", round1(factor), null), null, CAPSULE));
            List<Map.Entry<WardrobeItem, Integer>> cards = capsuleCards(p, cap);
            if (!cards.isEmpty()) {
                out.add(capsuleBasePiece(p, cards.get(0).getKey(), cards.get(0).getValue(), looks));
            }
            cards.stream().filter(e -> p.scored(e.getKey().getId()) != null && InsightMath.trend(p.scored(e.getKey().getId())) >= 60)
                    .max(Comparator.comparingDouble((Map.Entry<WardrobeItem, Integer> e) -> InsightMath.trend(p.scored(e.getKey().getId())))
                            .thenComparing(e -> e.getKey().getId().toString(), Comparator.reverseOrder()))
                    .ifPresent(e -> out.add(insight("CAPSULE_BASE_RISING", POSITIVE, 0.8, "insights.capsule_base_rising.text",
                            args(name(e.getKey()), e.getValue(), fmt0(InsightMath.trend(p.scored(e.getKey().getId())))),
                            metric("insights.metric.trend", round(InsightMath.trend(p.scored(e.getKey().getId()))), "pts"),
                            action("insights.action.experimentar", "/mirror?piece=" + e.getKey().getId()), CAPSULE, HYPE_V2, WARDROBE_USAGE)));
            // sustentabilidade: mais um uso da peça-base pouco usada é o que mais dilui o custo por uso (preço ÷ usos)
            cards.stream().map(Map.Entry::getKey)
                    .filter(w -> w.getPrice() != null && w.getPrice().compareTo(BigDecimal.ZERO) > 0 && w.getWearCount() >= 1)
                    .min(Comparator.comparingInt(WardrobeItem::getWearCount).thenComparing(w -> w.getId().toString()))
                    .ifPresent(w -> {
                        double cut = 100.0 / (w.getWearCount() + 1);
                        out.add(insight("CAPSULE_COST_PER_WEAR", POSITIVE, 0.7, "insights.capsule_cost_per_wear.text",
                                args(name(w), fmt0(cut), w.getWearCount()),
                                metric("insights.metric.custo_por_uso", round(cut), "%"),
                                action("insights.action.criar_look", "/schemes/new?pieces=" + w.getId()), CAPSULE, WARDROBE_USAGE));
                    });
        }
        Optional<Insight> rediscovery = rediscovery(p, rediscoveries(p), "CAPSULE_IDLE_REDISCOVERY", 0.9, CAPSULE);
        rediscovery.ifPresent(out::add);
        if (rediscovery.isEmpty()) {
            idlePieces(p, "CAPSULE_IDLE_PIECES", 0.75, CAPSULE).ifPresent(out::add);
        }
        activeShare(p, 0.55).ifPresent(out::add);
        gap(p, "CAPSULE_GAP_COMBOS").ifPresent(out::add);
    }

    void copilot(Personal p, List<Insight> out) {
        hypeAndStyle(p, 0.85).ifPresent(out::add);
        styleOverHype(p, 0.8).ifPresent(out::add);
        Optional<Insight> rediscovery = rediscovery(p, rediscoveries(p), "IDLE_REDISCOVERY", 0.9);
        rediscovery.ifPresent(out::add);
        if (rediscovery.isEmpty()) {
            idlePieces(p, "IDLE_PIECES", 0.75).ifPresent(out::add);
        }
        movingPiece(p, false, 0.6).ifPresent(out::add);
        if (p.dna() == null) {
            dnaStatus(p, 0.7, false).ifPresent(out::add);
        }
        gap(p, "GAP_COMBOS").ifPresent(out::add);
    }

    void autopilot(Personal p, List<Insight> out) {
        rediscovery(p, rediscoveries(p), "IDLE_REDISCOVERY", 0.9).ifPresent(out::add);
        idlePieces(p, "IDLE_PIECES", 0.8).ifPresent(out::add);
        dnaStatus(p, p.dna() == null ? 0.85 : 0.75, true).ifPresent(out::add);
        activeShare(p, 0.7).ifPresent(out::add);
        hypeAndStyle(p, 0.6).ifPresent(out::add);
    }

    @SuppressWarnings("unchecked")
    void history(Personal p, List<Insight> out) {
        Map<String, Object> movers = hype.movers(p.user(), 90);
        Map<String, Object> m = movers == null ? Map.of() : movers;
        firstPiece(m.get("risers")).flatMap(card -> moving(p, card.id(), card.value(), true, 0.85)).ifPresent(out::add);
        firstPiece(m.get("fallers")).flatMap(card -> moving(p, card.id(), card.value(), false, 0.7)).ifPresent(out::add);
        rediscovery(p, m.get("rediscoveries") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of(), "IDLE_REDISCOVERY", 0.9).ifPresent(out::add);
        Looks looks = looks(p);
        List<UUID> emerging = m.get("emergingLooks") instanceof List<?> l ? l.stream().map(PersonalInsights::idOf).filter(Objects::nonNull).toList() : List.of();
        emerging.stream().map(id -> looks.byId().get(id)).filter(Objects::nonNull).findFirst()
                .flatMap(s -> lookEmerging(looks, s, 0.8)).ifPresent(out::add);
        activeShare(p, 0.6).ifPresent(out::add);
    }

    void closet(Personal p, List<Insight> out) {
        hypeAndStyle(p, 0.85).ifPresent(out::add);
        movingPiece(p, true, 0.8).ifPresent(out::add);
        rarePiece(p, 0.7).ifPresent(out::add);
        Optional<Insight> rediscovery = rediscovery(p, rediscoveries(p), "IDLE_REDISCOVERY", 0.9);
        rediscovery.ifPresent(out::add);
        if (rediscovery.isEmpty()) {
            idlePieces(p, "IDLE_PIECES", 0.75).ifPresent(out::add);
        }
        activeShare(p, 0.65).ifPresent(out::add);
    }

    void looks(Personal p, List<Insight> out) {
        Looks d = looks(p);
        d.looks().stream().filter(s -> {
                    HypeScoreCurrent c = d.scored(s.getId());
                    return c != null && (c.getMomentum() == HypeMomentum.EMERGING || c.getMomentum() == HypeMomentum.RISING);
                })
                .max(Comparator.comparingDouble((Scheme s) -> InsightMath.trend(d.scored(s.getId()))).thenComparing(s -> s.getId().toString(), Comparator.reverseOrder()))
                .flatMap(s -> lookEmerging(d, s, 0.9)).ifPresent(out::add);
        d.looks().stream().filter(s -> s.getLookDoDiaCount() > 0)
                .max(Comparator.comparingInt(Scheme::getLookDoDiaCount).thenComparing(s -> s.getId().toString(), Comparator.reverseOrder()))
                .ifPresent(s -> {
                    Integer compat = lookCompat(p, s);
                    out.add(compat == null
                            ? insight("LOOK_MOST_WORN", NEUTRAL, 0.85, "insights.look_most_worn.text_no_dna", args(title(s), s.getLookDoDiaCount()),
                            metric("insights.metric.vezes", s.getLookDoDiaCount(), null), action("insights.action.ver_look", "/schemes/" + s.getId()), WARDROBE_USAGE)
                            : insight("LOOK_MOST_WORN", NEUTRAL, 0.85, "insights.look_most_worn.text", args(title(s), s.getLookDoDiaCount(), compat),
                            metric("insights.metric.vezes", s.getLookDoDiaCount(), null), action("insights.action.ver_look", "/schemes/" + s.getId()),
                            WARDROBE_USAGE, STYLE_DNA));
                });
        long unworn = d.looks().stream().filter(s -> s.getLookDoDiaCount() == 0).count();
        if (d.looks().size() >= 2 && unworn > 0) {
            out.add(insight("LOOKS_UNWORN", unworn * 2 > d.looks().size() ? ATTENTION : NEUTRAL, 0.75, "insights.looks_unworn.text",
                    args(unworn, d.looks().size()), metric("insights.metric.looks", unworn, "looks"),
                    action("insights.action.ver_looks", "/looks"), WARDROBE_USAGE));
        }
        d.looks().stream().filter(s -> s.getRemixCount() > 0)
                .max(Comparator.comparingLong(Scheme::getRemixCount).thenComparing(s -> s.getId().toString(), Comparator.reverseOrder()))
                .ifPresent(s -> out.add(insight("LOOK_REMIXED", POSITIVE, 0.7, "insights.look_remixed.text", args(title(s), s.getRemixCount()),
                        metric("insights.metric.remixes", s.getRemixCount(), null), action("insights.action.ver_look", "/schemes/" + s.getId()), SOCIAL)));
        d.looks().stream().filter(s -> {
                    HypeScoreCurrent c = d.scored(s.getId());
                    return c != null && "DOWN".equals(c.getDirection()) && c.getDeltaPoints() != null;
                })
                .min(Comparator.comparing((Scheme s) -> d.scored(s.getId()).getDeltaPoints()).thenComparing(s -> s.getId().toString()))
                .ifPresent(s -> out.add(insight("LOOK_COOLING", NEUTRAL, 0.6, "insights.look_cooling.text",
                        args(title(s), fmt1(Math.abs(d.scored(s.getId()).getDeltaPoints().doubleValue())), config.deltaWindowDays(), s.getLookDoDiaCount()),
                        metric("insights.metric.variacao", round1(d.scored(s.getId()).getDeltaPoints().doubleValue()), "pts"),
                        action("insights.action.ver_look", "/schemes/" + s.getId()), HYPE_V2, WARDROBE_USAGE)));
    }

    /**
     * Editor de look (Lote A5 · P3-15): primeiro a leitura das peças escolhidas — Hype médio (pessoal: são as peças da
     * própria pessoa) SEMPRE ao lado da compatibilidade com o DNA e do uso real, com o aviso de que o Hype do look nasce
     * dos sinais do próprio look —; depois a redescoberta (peça parada cujas semelhantes cresceram), o estilo acima do
     * Hype e a peça de maior Hype com o estilo ao lado. Nada aqui grava nem emite sinal de Hype.
     */
    void lookEditor(Personal p, List<UUID> selected, List<Insight> out) {
        List<WardrobeItem> chosen = selected.stream().filter(Objects::nonNull).distinct().map(p.byId()::get).filter(Objects::nonNull).toList();
        if (!chosen.isEmpty()) {
            out.add(selection(p, chosen));
        }
        Optional<Insight> rediscovery = rediscovery(p, rediscoveries(p), "IDLE_REDISCOVERY", 0.9);
        rediscovery.ifPresent(out::add);
        styleOverHype(p, 0.8).ifPresent(out::add);
        hypeAndStyle(p, 0.7).ifPresent(out::add);
        if (p.dna() == null) {
            dnaStatus(p, 0.65, false).ifPresent(out::add);
        }
        if (rediscovery.isEmpty()) {
            idlePieces(p, "IDLE_PIECES", 0.6).ifPresent(out::add);
        }
    }

    /** As peças escolhidas: Hype médio (só as com Hype calculado; sem nenhuma, o texto diz "sem Hype", nunca 0), DNA e uso. */
    Insight selection(Personal p, List<WardrobeItem> chosen) {
        List<HypeScoreCurrent> scored = chosen.stream().map(w -> p.scored(w.getId())).filter(Objects::nonNull).toList();
        Double hypeAvg = scored.isEmpty() ? null : scored.stream().mapToDouble(c -> c.getScore().doubleValue()).average().orElse(0);
        List<Integer> compats = chosen.stream().map(p::compat).filter(Objects::nonNull).toList();
        Integer compat = compats.isEmpty() ? null : (int) Math.round(compats.stream().mapToInt(Integer::intValue).average().orElse(0));
        long uses = chosen.stream().mapToLong(WardrobeItem::getWearCount).sum();
        int n = chosen.size();
        if (hypeAvg != null && compat != null) {
            return insight("LOOK_EDITOR_SELECTION", NEUTRAL, 0.95, "insights.look_editor_selection.text_full", args(n, fmt0(hypeAvg), scored.size(), compat, uses),
                    metric("insights.metric.hype_medio", round(hypeAvg), "pts"), null, HYPE_V2, STYLE_DNA, WARDROBE_USAGE);
        }
        if (hypeAvg != null) {
            return insight("LOOK_EDITOR_SELECTION", NEUTRAL, 0.95, "insights.look_editor_selection.text_hype", args(n, fmt0(hypeAvg), scored.size(), uses),
                    metric("insights.metric.hype_medio", round(hypeAvg), "pts"), action("insights.action.definir_dna", "/dna"), HYPE_V2, WARDROBE_USAGE);
        }
        if (compat != null) {
            return insight("LOOK_EDITOR_SELECTION", NEUTRAL, 0.95, "insights.look_editor_selection.text_dna", args(n, compat, uses),
                    metric("insights.metric.compatibilidade", compat, "%"), null, STYLE_DNA, WARDROBE_USAGE);
        }
        return insight("LOOK_EDITOR_SELECTION", NEUTRAL, 0.95, "insights.look_editor_selection.text", args(n, uses),
                metric("insights.metric.pecas", n, "peças"), null, WARDROBE_USAGE);
    }

    // ================================================================== geradores de peça
    /** A peça com maior Hype — sempre com a compatibilidade com o DNA (quando há DNA) e o uso real ao lado. */
    Optional<Insight> hypeAndStyle(Personal p, double rel) {
        return p.available().stream().filter(w -> p.scored(w.getId()) != null)
                .max(Comparator.comparing((WardrobeItem w) -> p.scored(w.getId()).getScore()).thenComparing(w -> w.getId().toString(), Comparator.reverseOrder()))
                .map(w -> {
                    double score = p.scored(w.getId()).getScore().doubleValue();
                    Integer compat = p.compat(w);
                    Insight.Metric metric = metric("insights.metric.hype", round(score), "pts");
                    Insight.Action action = action("insights.action.experimentar", "/mirror?piece=" + w.getId());
                    return compat == null
                            ? insight("PIECE_HYPE_AND_STYLE", NEUTRAL, rel, "insights.piece_hype_and_style.text_no_dna", args(name(w), fmt0(score), w.getWearCount()),
                            metric, action, HYPE_V2, WARDROBE_USAGE)
                            : insight("PIECE_HYPE_AND_STYLE", NEUTRAL, rel, "insights.piece_hype_and_style.text", args(name(w), fmt0(score), compat, w.getWearCount()),
                            metric, action, HYPE_V2, STYLE_DNA, WARDROBE_USAGE);
                });
    }

    /** Muito alinhada ao DNA e com Hype baixo: o estilo pessoal vale mais que a relevância do momento. */
    Optional<Insight> styleOverHype(Personal p, double rel) {
        if (p.dna() == null) {
            return Optional.empty();
        }
        return p.available().stream().filter(w -> p.scored(w.getId()) != null && p.scored(w.getId()).getScore().doubleValue() < 40)
                .filter(w -> p.compat(w) != null && p.compat(w) >= 70)
                .max(Comparator.comparingInt((WardrobeItem w) -> p.compat(w)).thenComparing(w -> -p.scored(w.getId()).getScore().doubleValue())
                        .thenComparing(w -> w.getId().toString(), Comparator.reverseOrder()))
                .map(w -> insight("STYLE_OVER_HYPE", POSITIVE, rel, "insights.style_over_hype.text",
                        args(name(w), p.compat(w), fmt0(p.scored(w.getId()).getScore().doubleValue()), w.getWearCount()),
                        metric("insights.metric.compatibilidade", p.compat(w), "%"),
                        action("insights.action.criar_look", "/schemes/new?pieces=" + w.getId()), STYLE_DNA, HYPE_V2, WARDROBE_USAGE));
    }

    /** Peça que subiu (up) ou esfriou (down) de verdade — direção calculada, fora da faixa "estável". */
    Optional<Insight> movingPiece(Personal p, boolean up, double rel) {
        String dir = up ? "UP" : "DOWN";
        Comparator<WardrobeItem> byDelta = Comparator.comparing((WardrobeItem w) -> p.scored(w.getId()).getDeltaPoints());
        return p.available().stream().filter(w -> {
                    HypeScoreCurrent c = p.scored(w.getId());
                    return c != null && dir.equals(c.getDirection()) && c.getDeltaPoints() != null;
                })
                .sorted((up ? byDelta.reversed() : byDelta).thenComparing(w -> w.getId().toString())).findFirst()
                .flatMap(w -> moving(p, w.getId(), p.scored(w.getId()).getDeltaPoints().doubleValue(), up, rel));
    }

    Optional<Insight> moving(Personal p, UUID id, Double delta, boolean up, double rel) {
        WardrobeItem w = id == null ? null : p.byId().get(id);
        if (w == null || delta == null || p.scored(id) == null) {
            return Optional.empty();
        }
        Insight.Metric metric = metric("insights.metric.variacao", round1(delta), "pts");
        Insight.Action action = action("insights.action.experimentar", "/mirror?piece=" + w.getId());
        if (!up) {
            return Optional.of(insight("PIECE_COOLING", NEUTRAL, rel, "insights.piece_cooling.text",
                    args(name(w), fmt1(Math.abs(delta)), config.deltaWindowDays(), w.getWearCount()), metric, action, HYPE_V2, WARDROBE_USAGE));
        }
        Integer compat = p.compat(w);
        return Optional.of(compat == null
                ? insight("PIECE_RISING", POSITIVE, rel, "insights.piece_rising.text_no_dna",
                args(name(w), fmt1(Math.abs(delta)), config.deltaWindowDays(), w.getWearCount()), metric, action, HYPE_V2, WARDROBE_USAGE)
                : insight("PIECE_RISING", POSITIVE, rel, "insights.piece_rising.text",
                args(name(w), fmt1(Math.abs(delta)), config.deltaWindowDays(), w.getWearCount(), compat), metric, action, HYPE_V2, STYLE_DNA, WARDROBE_USAGE));
    }

    /** Raridade = frequência do modelo entre guarda-roupas (nunca "poucas curtidas"), com o uso ao lado. */
    Optional<Insight> rarePiece(Personal p, double rel) {
        return p.available().stream().filter(w -> p.hype().get(w.getId()) != null && InsightMath.dims(p.hype().get(w.getId())).getRarity() != null
                        && InsightMath.dims(p.hype().get(w.getId())).getRarity().doubleValue() >= 50)
                .max(Comparator.comparing((WardrobeItem w) -> InsightMath.dims(p.hype().get(w.getId())).getRarity()).thenComparing(w -> w.getId().toString(),
                        Comparator.reverseOrder()))
                .map(w -> {
                    double r = InsightMath.dims(p.hype().get(w.getId())).getRarity().doubleValue();
                    return insight("RARE_PIECE", NEUTRAL, rel, "insights.rare_piece.text", args(name(w), fmt0(r), w.getWearCount()),
                            metric("insights.metric.raridade", round(r), "pts"), action("insights.action.experimentar", "/mirror?piece=" + w.getId()),
                            HYPE_V2, WARDROBE_USAGE);
                });
    }

    /** Redescobertas do painel do Hype (wardrobe().rediscoveries), conferidas de novo contra a régua de 60 dias. */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rediscoveries(Personal p) {
        Map<String, Object> w = hype.wardrobe(p.user());
        return w != null && w.get("rediscoveries") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }

    Optional<Insight> rediscovery(Personal p, List<Map<String, Object>> recs, String code, double rel, String... extraBasis) {
        for (Map<String, Object> rec : recs) {
            UUID id = idOf(rec);
            WardrobeItem w = id == null ? null : p.byId().get(id);
            if (w == null || !p.idle(w)) {
                continue;   // nunca chama de "parada" a peça usada há menos de 60 dias
            }
            long idle = HypeQueryService.idleDays(w, p.today());
            Number similar = rec.get("similarGrowthPercent") instanceof Number n ? n : null;
            Number trend = rec.get("trend") instanceof Number n ? n : p.scored(id) == null ? null : InsightMath.trend(p.scored(id));
            String key;
            Object[] a;
            if (similar != null && similar.doubleValue() >= 15) {
                key = "insights.idle_rediscovery.text_similar";
                a = args(name(w), idle, fmt0(similar.doubleValue()));
            } else if (trend != null && trend.doubleValue() >= 60) {
                key = "insights.idle_rediscovery.text_trend";
                a = args(name(w), idle, fmt0(trend.doubleValue()));
            } else {
                continue;
            }
            List<String> basis = new ArrayList<>(List.of(extraBasis));
            basis.add(HYPE_V2);
            basis.add(WARDROBE_USAGE);
            return Optional.of(insight(code, POSITIVE, rel, key, a, metric("insights.metric.dias_sem_uso", idle, "dias"),
                    action("insights.action.experimentar", "/mirror?piece=" + w.getId()), basis.toArray(String[]::new)));
        }
        return Optional.empty();
    }

    Optional<Insight> idlePieces(Personal p, String code, double rel, String... extraBasis) {
        long n = p.available().stream().filter(p::idle).count();
        if (n == 0) {
            return Optional.empty();
        }
        List<String> basis = new ArrayList<>(List.of(extraBasis));
        basis.add(WARDROBE_USAGE);
        return Optional.of(insight(code, ATTENTION, rel, "insights.idle_pieces.text", args(n, RoomService.FORGOTTEN_DAYS),
                metric("insights.metric.pecas", n, "peças"), action("insights.action.ver_paradas", "/closet?sort=idle"), basis.toArray(String[]::new)));
    }

    /** Parte do guarda-roupa disponível usada nos últimos 60 dias (uso real, sem Hype). */
    Optional<Insight> activeShare(Personal p, double rel) {
        int total = p.available().size();
        if (total < 3) {
            return Optional.empty();
        }
        long active = p.available().stream().filter(w -> w.getLastWornDate() != null
                && ChronoUnit.DAYS.between(w.getLastWornDate(), p.today()) < RoomService.FORGOTTEN_DAYS).count();
        double pct = 100.0 * active / total;
        Insight.Tone tone = pct >= 60 ? POSITIVE : pct < 30 ? ATTENTION : NEUTRAL;
        return Optional.of(insight("WARDROBE_ACTIVE_SHARE", tone, rel, "insights.wardrobe_active_share.text",
                args(fmt0(pct), RoomService.FORGOTTEN_DAYS, active, total), metric("insights.metric.usadas", round(pct), "%"), null, WARDROBE_USAGE));
    }

    Optional<Insight> dnaStatus(Personal p, double rel, boolean alignment) {
        if (p.dna() == null) {
            return Optional.of(insight("DNA_MISSING", ATTENTION, rel, "insights.dna_missing.text", args(),
                    null, action("insights.action.definir_dna", "/dna"), STYLE_DNA));
        }
        int total = p.available().size();
        if (!alignment || total < 3) {
            return Optional.empty();
        }
        long aligned = p.available().stream().filter(w -> p.compat(w) != null && p.compat(w) >= ALIGNED).count();
        double pct = 100.0 * aligned / total;
        return Optional.of(insight("DNA_ALIGNMENT", NEUTRAL, rel, "insights.dna_alignment.text", args(fmt0(pct), ALIGNED, aligned, total),
                metric("insights.metric.alinhadas", round(pct), "%"), null, STYLE_DNA));
    }

    /**
     * Lacuna que destrava combinações — genérica (subcategoria + cor, nunca marca), respeitando o opt-out e SEMPRE no fim,
     * depois dos insights de reuso (a ordenação final garante a posição).
     */
    Optional<Insight> gap(Personal p, String code) {
        boolean enabled = preferences.findByUserId(p.user().id()).map(UserPreferences::isPurchaseSuggestionsEnabled).orElse(true);
        if (!enabled) {
            return Optional.empty();
        }
        List<WardrobeItem> eligible = Optional.ofNullable(wardrobe.eligible(p.user().id())).orElse(List.of());
        if (eligible.size() < 3) {
            return Optional.empty();
        }
        return CopilotService.purchaseSuggestions(eligible).stream().findFirst().map(s -> {
            long gain = s.get("gain") instanceof Number n ? n.longValue() : 0;
            return insight(code, NEUTRAL, 0, "insights.gap_combos.text",
                    args(Taxonomy.label(String.valueOf(s.get("subcategory"))), Taxonomy.label(String.valueOf(s.get("color"))), gain),
                    metric("insights.metric.combinacoes", gain, null), action("insights.action.cadastrar", "/pieces/new"), INVENTORY_COMBOS);
        });
    }

    private Insight capsuleBasePiece(Personal p, WardrobeItem w, int inLooks, int looks) {
        HypeScoreCurrent c = p.scored(w.getId());
        Integer compat = p.compat(w);
        Insight.Metric metric = metric("insights.metric.looks", inLooks, "looks");
        Insight.Action action = action("insights.action.criar_look", "/schemes/new?pieces=" + w.getId());
        if (c != null && compat != null) {
            return insight("CAPSULE_BASE_PIECE", POSITIVE, 0.85, "insights.capsule_base_piece.text_full",
                    args(name(w), inLooks, looks, fmt0(c.getScore().doubleValue()), compat), metric, action, CAPSULE, WARDROBE_USAGE, HYPE_V2, STYLE_DNA);
        }
        if (c != null) {
            return insight("CAPSULE_BASE_PIECE", POSITIVE, 0.85, "insights.capsule_base_piece.text_hype",
                    args(name(w), inLooks, looks, fmt0(c.getScore().doubleValue())), metric, action, CAPSULE, WARDROBE_USAGE, HYPE_V2);
        }
        if (compat != null) {
            return insight("CAPSULE_BASE_PIECE", POSITIVE, 0.85, "insights.capsule_base_piece.text_dna",
                    args(name(w), inLooks, looks, compat), metric, action, CAPSULE, WARDROBE_USAGE, STYLE_DNA);
        }
        return insight("CAPSULE_BASE_PIECE", POSITIVE, 0.85, "insights.capsule_base_piece.text", args(name(w), inLooks, looks),
                metric, action, CAPSULE, WARDROBE_USAGE);
    }

    /** Peças-base da cápsula (LookbookService.capsule), na ordem dela (mais looks primeiro), só as que a pessoa ainda tem. */
    @SuppressWarnings("unchecked")
    private static List<Map.Entry<WardrobeItem, Integer>> capsuleCards(Personal p, Map<String, Object> cap) {
        List<Map.Entry<WardrobeItem, Integer>> out = new ArrayList<>();
        if (!(cap.get("cards") instanceof List<?> cards)) {
            return out;
        }
        for (Object o : cards) {
            if (!(o instanceof Map<?, ?> card)) {
                continue;
            }
            UUID id = idOf(card.get("piece"));
            WardrobeItem w = id == null ? null : p.byId().get(id);
            if (w != null) {
                out.add(Map.entry(w, intOf(card.get("looks"))));
            }
        }
        return out;
    }

    // ================================================================== looks
    record Looks(List<Scheme> looks, Map<UUID, Scheme> byId, Map<UUID, HypeScoreCurrent> hype) {
        HypeScoreCurrent scored(UUID id) {
            HypeScoreCurrent c = hype.get(id);
            return c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null ? c : null;
        }
    }

    Looks looks(Personal p) {
        List<Scheme> list = Optional.ofNullable(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(p.user().id(), SchemeStatus.ARCHIVED)).orElse(List.of());
        Map<UUID, Scheme> byId = list.stream().collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Map<UUID, HypeScoreCurrent> h = byId.isEmpty() ? Map.of() : Optional.ofNullable(hype.currentOf(HypeEntityType.SCHEME, byId.keySet())).orElse(Map.of());
        return new Looks(list, byId, h);
    }

    Optional<Insight> lookEmerging(Looks d, Scheme s, double rel) {
        HypeScoreCurrent c = d.scored(s.getId());
        if (c == null) {
            return Optional.empty();
        }
        double trend = InsightMath.trend(c);
        double velocity = InsightMath.dim(InsightMath.dims(c).getTrendVelocity(), 50);
        return Optional.of(insight("LOOK_EMERGING", POSITIVE, rel, "insights.look_emerging.text",
                args(title(s), fmt0(trend), fmt0(velocity), s.getLookDoDiaCount()),
                metric("insights.metric.trend", round(trend), "pts"), action("insights.action.ver_look", "/schemes/" + s.getId()), HYPE_V2, WARDROBE_USAGE));
    }

    private Integer lookCompat(Personal p, Scheme s) {
        if (p.dna() == null) {
            return null;
        }
        var items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        if (items == null || items.isEmpty()) {
            return null;
        }
        Map<String, Object> m = StyleCompatibility.score(p.dna(), HypeQueryService.profileOf(s, items));
        return m == null ? null : ((Number) m.get("score")).intValue();
    }

    // ================================================================== utilidades
    record Card(UUID id, Double value) {
    }

    /** Primeiro card de PEÇA de uma lista do painel do Hype (risers/fallers). */
    private static Optional<Card> firstPiece(Object list) {
        if (!(list instanceof List<?> l)) {
            return Optional.empty();
        }
        for (Object o : l) {
            if (o instanceof Map<?, ?> m && HypeEntityType.PIECE.name().equals(String.valueOf(m.get("type")))) {
                UUID id = idOf(m);
                if (id != null) {
                    return Optional.of(new Card(id, m.get("value") instanceof Number n ? n.doubleValue() : null));
                }
            }
        }
        return Optional.empty();
    }

    /** Id de um card (Map com "id") ou de uma view de peça. */
    static UUID idOf(Object o) {
        Object raw = o instanceof Map<?, ?> m ? m.get("id") : o instanceof Views.PieceView v ? v.id() : null;
        if (raw instanceof UUID u) {
            return u;
        }
        try {
            return raw == null ? null : UUID.fromString(String.valueOf(raw));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static int intOf(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    static String name(WardrobeItem w) {
        return w.getName() == null || w.getName().isBlank() ? Taxonomy.label(String.valueOf(w.getSubcategory())) : w.getName();
    }

    static String title(Scheme s) {
        return s.getTitle() == null || s.getTitle().isBlank() ? Msg.t("insights.look_sem_titulo") : s.getTitle();
    }
}
