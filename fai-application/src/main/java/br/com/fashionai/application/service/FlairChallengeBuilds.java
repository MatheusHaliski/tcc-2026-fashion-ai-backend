package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.CbcStory;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.service.FlairChallengeService.Window;
import br.com.fashionai.application.service.FlairChallengeService.BuildRequest;
import br.com.fashionai.application.service.FlairChallengeService.Build;
import br.com.fashionai.application.service.FlairChallengeService.Line;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairChallengeService.REDISCOVERY_BONUS;
import static br.com.fashionai.application.service.FlairChallengeValues.accepts;
import static br.com.fashionai.application.service.FlairChallengeValues.basePoints;
import static br.com.fashionai.application.service.FlairChallengeValues.interpretationOf;
import static br.com.fashionai.application.service.FlairChallengeValues.interpretations;
import static br.com.fashionai.application.service.FlairChallengeValues.position;
import static br.com.fashionai.application.service.FlairChallengeValues.strings;

/**
 * Montagem conferida pelo servidor: cartas nas vagas, contexto do Momento, cartas no formato do motor ({@link CbcRules}),
 * história ({@link CbcStory}), retrato das cartas entregues, visão da avaliação e linhas de pontos (S3, C1, C3).
 * Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeBuilds {
    private final FlairCardInstanceRepository cards;
    private final WardrobeItemRepository pieces;
    private final FlairChallengeWindows windows;
    private final FlairChallengeClock clock;

    FlairChallengeBuilds(FlairCardInstanceRepository cards, WardrobeItemRepository pieces, FlairChallengeWindows windows,
                         FlairChallengeClock clock) {
        this.cards = cards;
        this.pieces = pieces;
        this.windows = windows;
        this.clock = clock;
    }

    Build build(CurrentUser user, FlairChallenge c, BuildRequest req) {
        Moment m = windows.momentOf(c);
        Window w = windows.window(c, m, clock.now());
        List<Map<String, Object>> rawSlots = Json.list(c.getSlotsJson());
        List<CbcRules.Slot> slots = rawSlots.stream().map(s -> new CbcRules.Slot(String.valueOf(s.get("key")), position(s.get("position")), accepts(s))).toList();
        @SuppressWarnings("unchecked")
        List<CbcStory.SlotText> texts = rawSlots.stream().map(s -> new CbcStory.SlotText(String.valueOf(s.get("key")),
                s.get("story") instanceof Map<?, ?> st ? (Map<String, Object>) st : null)).toList();
        Set<String> keys = slots.stream().map(CbcRules.Slot::key).collect(Collectors.toSet());
        Map<String, UUID> asked = req == null || req.slots() == null ? Map.of() : req.slots();
        Map<String, FlairCardInstance> placed = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (Map.Entry<String, UUID> e : asked.entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            if (!keys.contains(e.getKey())) {
                throw ApiException.badRequest("VAGA_DESCONHECIDA", Msg.t("cbc.vaga_desconhecida"), Map.of("slot", e.getKey()));
            }
            if (!used.add(e.getValue())) {
                throw ApiException.badRequest("CARTA_REPETIDA", Msg.t("cbc.carta_repetida"), Map.of("cardId", e.getValue()));
            }
            FlairCardInstance card = cards.findById(e.getValue()).filter(x -> x.getOwnerId().equals(user.id()))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("cbc.carta")));
            if (!"AVAILABLE".equals(card.getState())) {
                throw ApiException.conflict("CARTA_ENTREGUE", Msg.t("cbc.carta_ja_entregue"));
            }
            placed.put(e.getKey(), card);
        }
        String interpretation = interpretationOf(req == null ? null : req.interpretation(), m);
        Map<UUID, CbcRules.Card> models = models(placed.values());
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        placed.forEach((k, v) -> board.put(k, models.get(v.getId())));
        CbcRules.Context ctx = context(c, m, interpretation);
        CbcRules.Evaluation ev = CbcRules.evaluate(slots, board, Json.list(c.getRequirementsJson()), ctx);
        Map<String, CbcStory.CardText> textCards = new LinkedHashMap<>();
        placed.forEach((k, v) -> textCards.put(k, new CbcStory.CardText(v.getName(), v.getBrandName(),
                models.get(v.getId()).colors().stream().findFirst().orElse(null))));
        List<Map<String, Object>> story = CbcStory.write(c.getScenario(), texts, textCards, ev, interpretation);
        return new Build(c, m, w, slots, texts, placed, ev, story, interpretation);
    }

    CbcRules.Context context(FlairChallenge c, Moment m, String chosen) {
        List<String> theme = Json.csv(c.getThemeTags());
        List<String> styles = new ArrayList<>(theme);
        List<String> colors = new ArrayList<>(theme);
        List<String> occasions = new ArrayList<>();
        if (m != null) {
            styles.addAll(Json.csv(m.getStyleTags()));
            colors.addAll(Json.csv(m.getColorTags()));
            occasions.addAll(Json.csv(m.getOccasionTags()));
        }
        Instant start = m != null ? m.getStartAt() : c.getStartAt();
        return new CbcRules.Context(m == null ? List.of() : interpretations(m), Set.copyOf(styles), Set.copyOf(colors), Set.copyOf(occasions),
                chosen, start, clock.today());
    }

    /** Cartas no formato do motor: tags do retrato da geração ou, em cartas antigas, da peça; datas da peça viva. */
    Map<UUID, CbcRules.Card> models(Collection<FlairCardInstance> list) {
        Set<UUID> pieceIds = list.stream().filter(c -> "PIECE".equals(c.getOriginType())).map(FlairCardInstance::getOriginId).collect(Collectors.toSet());
        Map<UUID, WardrobeItem> byId = pieces.findAllById(pieceIds).stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
        Map<UUID, CbcRules.Card> out = new LinkedHashMap<>();
        for (FlairCardInstance c : list) {
            WardrobeItem w = "PIECE".equals(c.getOriginType()) ? byId.get(c.getOriginId()) : null;
            Map<String, Object> tags = c.getTagsJson() != null ? Json.map(c.getTagsJson()) : FlairCollectionService.tagsOf(w);
            Map<String, Double> hype = new HashMap<>();
            if (c.getHypeJson() != null) {
                Json.map(c.getHypeJson()).forEach((k, v) -> {
                    if (v instanceof Number n) {
                        hype.put(k, n.doubleValue());
                    }
                });
            }
            Instant added = null;
            LocalDate lastWorn = null;
            if (w != null) {
                added = w.getCreatedAt();
                if (w.getPurchaseDate() != null) {
                    // comprada antes de entrar no app: vale a data da compra (C2 olha a compra, não o cadastro)
                    Instant bought = w.getPurchaseDate().atStartOfDay(ZoneOffset.UTC).toInstant();
                    added = added == null || bought.isBefore(added) ? bought : added;
                }
                lastWorn = w.getLastWornDate();
            }
            out.put(c.getId(), new CbcRules.Card(c.getId(), c.getPosition(), c.getTier(), c.getOvr(), c.getBrandName(), c.getOriginType(),
                    Set.copyOf(strings(tags.get("styles"))), Set.copyOf(strings(tags.get("colors"))), Set.copyOf(strings(tags.get("occasions"))),
                    Set.copyOf(strings(tags.get("materials"))), hype, added, lastWorn, c.getCategory(), c.getSubcategory()));
        }
        return out;
    }

    List<Map<String, Object>> snapshot(Build b) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, CbcRules.SlotResult> res = b.evaluation().slots().stream().collect(Collectors.toMap(CbcRules.SlotResult::slot, Function.identity()));
        for (CbcRules.Slot s : b.slots()) {
            FlairCardInstance c = b.placed().get(s.key());
            if (c == null) {
                continue;
            }
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("slot", s.key());
            v.put("cardId", c.getId());
            v.put("name", c.getName());
            v.put("brandName", c.getBrandName());
            v.put("tier", c.getTier());
            v.put("ovr", c.getOvr());
            v.put("rare", c.isRare());
            v.put("position", c.getPosition());
            v.put("imageUrl", c.getImageUrl());
            v.put("sintonia", res.get(s.key()) == null ? 0 : res.get(s.key()).sintonia());
            out.add(v);
        }
        return out;
    }

    Map<String, Object> evaluationView(Build b) {
        CbcRules.Evaluation ev = b.evaluation();
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("slots", ev.slots().stream().map(CbcRules.SlotResult::toMap).toList());
        e.put("requirements", ev.requirements().stream().map(CbcRules.RequirementResult::toMap).toList());
        e.put("sintonia", ev.sintonia());
        e.put("sintoniaMax", ev.sintoniaMax());
        e.put("filled", ev.filled());
        e.put("complete", ev.complete());
        e.put("ok", ev.ok());
        e.put("rediscovered", ev.rediscovered());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", b.window().status());
        out.put("interpretation", b.interpretation());
        out.put("evaluation", e);
        out.put("story", b.story());
        return out;
    }

    /** Linhas determinísticas: valor do desafio × multiplicador do Momento; +10 de redescoberta. Nada premia compra (C1). */
    List<Line> pointsLines(Build b, int attempt) {
        List<Line> out = new ArrayList<>();
        FlairChallenge c = b.challenge();
        int base = basePoints(c, b.moment(), b.window());
        String ref = c.getRepeatLimit() > 1 ? c.getId() + ":" + attempt : c.getId().toString();
        if (base > 0 && b.evaluation().ok()) {
            out.add(new Line("FLAIR_CBC", base, ref, "challenge"));
        }
        if (b.evaluation().ok() && !b.evaluation().rediscovered().isEmpty()) {
            out.add(new Line("FLAIR_CBC_REDISCOVERY", REDISCOVERY_BONUS, c.getId().toString(), "rediscovery"));
        }
        return out;
    }
}
