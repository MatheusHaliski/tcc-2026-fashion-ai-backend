package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairModeViews.overall;

/** Wardrobe Wars: compara o guarda-roupa inteiro (o do oponente só com peças e looks públicos) em 7 rodadas. */
final class FlairWardrobeWars {
    private final FlairModeLooks modeLooks;
    private final FlairMatchRecorder recorder;
    private final FlairService flair;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final Guard guard;

    FlairWardrobeWars(FlairModeLooks modeLooks, FlairMatchRecorder recorder, FlairService flair, WardrobeItemRepository pieces,
                      SchemeRepository schemes, SchemeItemRepository schemeItems, UserRepository users, Guard guard) {
        this.modeLooks = modeLooks;
        this.recorder = recorder;
        this.flair = flair;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.users = users;
        this.guard = guard;
    }

    FlairLooks.Wardrobe wardrobe(User u, boolean publicOnly) {
        List<WardrobeItem> ws = pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> !publicOnly || w.getVisibility() == Visibility.PUBLIC).toList();
        List<Scheme> ss = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> !publicOnly || s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED).toList();
        List<Card> cards = flair.cardsOf(ws);
        // relevância média (HypeScore v2 público dos looks): nulo sem nenhum → 50 neutro na rodada, nunca 0
        java.util.Collection<Double> hype = flair.publicLookHype(ss.stream().map(Scheme::getId).toList()).values();
        Double relevance = hype.isEmpty() ? null : hype.stream().mapToDouble(Double::doubleValue).average().orElse(FlairLooks.NEUTRAL_HYPE);
        int styles = (int) cards.stream().flatMap(c -> c.styles().stream()).distinct().count();
        int occ = (int) cards.stream().flatMap(c -> c.occasions().stream()).distinct().count();
        Set<Set<String>> combos = new HashSet<>();
        Set<String> usedPieces = new HashSet<>();
        for (Scheme s : ss) {
            Set<String> set = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull)
                    .map(w -> w.getId().toString()).collect(Collectors.toSet());
            if (!set.isEmpty()) {
                combos.add(set);
                usedPieces.addAll(set);
            }
        }
        double originality = ws.isEmpty() ? 0 : Math.min(100, combos.size() * 100.0 / ws.size());
        double collection = cards.stream().mapToInt(c -> Map.of("STANDARD", 1, "PREMIUM", 2, "LIMITED", 3, "RARE", 5).getOrDefault(c.rarity(), 1)).sum() * 2.0;
        double sustainability = ws.isEmpty() ? 0 : Math.min(100, ws.stream().mapToInt(WardrobeItem::getWearCount).average().orElse(0) * 6 + usedPieces.size() * 60.0 / ws.size());
        double eng = ss.stream().mapToLong(s -> s.getLikeCount() + 2 * s.getSaveCount() + 3 * s.getCommentCount()).sum();
        double community = Math.min(100, 18 * Math.log(1 + eng) / Math.log(2));
        return new FlairLooks.Wardrobe(u.getUsername(), relevance, styles, occ, originality, collection, sustainability, community);
    }

    Map<String, Object> wardrobeWars(CurrentUser user, String opponent) {
        guard.requireCanCreate(user);
        User me = users.findById(user.id()).orElseThrow();
        User rival = modeLooks.opponentUser(user, opponent);
        FlairLooks.Wardrobe a = wardrobe(me, false), b = wardrobe(rival, true);
        List<Clash> rounds = FlairLooks.wardrobeWars(a, b);
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("me", a);
        r.put("opponent", Map.of("label", "@" + rival.getUsername(), "wardrobe", b));
        r.put("rounds", rounds.stream().map(FlairModeViews::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        r.put("note", Msg.t("flairModes.do_oponente_contam_so_pecas"));
        return recorder.finish(user, "WARDROBE", Msg.t("flairModes.guarda_roupa_guarda_roupa_2"), w, r, List.of(), rival, List.of());
    }
}
