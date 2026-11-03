package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Scheme Composer local (#3) — composição por regras quando a IA externa está indisponível ou sem
 * consentimento. Restrição rígida (RF5.CA04 / RF30.CA02): usa SÓ peças do acervo do usuário. Sintetiza
 * ocasião/estilo (máx. 3, por frequência ponderada — nunca concatena) e sugere até 4 selos.
 */
public final class LocalSchemeComposer {
    private LocalSchemeComposer() {
    }

    public record Pick(UUID wardrobeItemId, SchemeSlot slot) {
    }

    public record Composition(String title, List<Pick> items, List<String> occasions, List<String> styles,
                              String season, String mood, List<String> seals, BigDecimal totalPrice, double score,
                              String rationale) {
    }

    public static List<Composition> compose(List<WardrobeItem> wardrobe, List<String> occasions, List<String> styles,
                                            String season, String freeText, int count) {
        List<WardrobeItem> usable = wardrobe.stream()
                .filter(WardrobeItem::isDisponivel)
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> w.getModerationStatus() != ModerationStatus.REJECTED_POLICY
                        && w.getModerationStatus() != ModerationStatus.REJECTED_NOT_CLOTHING)
                .toList();
        Set<String> words = LocalSchemeScoring.words(freeText);
        Map<String, List<WardrobeItem>> byCat = new LinkedHashMap<>();
        for (WardrobeItem w : usable) {
            byCat.computeIfAbsent(w.getCategory(), k -> new ArrayList<>()).add(w);
        }
        Comparator<WardrobeItem> byScore = Comparator.comparingDouble(
                (WardrobeItem w) -> LocalSchemeScoring.score(w, occasions, styles, season, words)).reversed();
        byCat.values().forEach(list -> list.sort(byScore));

        List<List<WardrobeItem>> candidates = new ArrayList<>();
        List<WardrobeItem> tops = top(byCat, "upper_piece");
        List<WardrobeItem> bottoms = top(byCat, "lower_piece");
        List<WardrobeItem> shoes = top(byCat, "shoes_piece");
        List<WardrobeItem> full = top(byCat, "full_body_piece");
        for (WardrobeItem t : tops.isEmpty() ? nullList() : tops) {
            for (WardrobeItem b : bottoms.isEmpty() ? nullList() : bottoms) {
                for (WardrobeItem s : shoes.isEmpty() ? nullList() : shoes) {
                    List<WardrobeItem> combo = new ArrayList<>();
                    if (t != null) {
                        combo.add(t);
                    }
                    if (b != null) {
                        combo.add(b);
                    }
                    if (s != null) {
                        combo.add(s);
                    }
                    if (combo.size() >= 2) {
                        candidates.add(combo);
                    }
                }
            }
        }
        for (WardrobeItem f : full) {
            for (WardrobeItem s : shoes.isEmpty() ? nullList() : shoes) {
                List<WardrobeItem> combo = new ArrayList<>(List.of(f));
                if (s != null) {
                    combo.add(s);
                }
                candidates.add(combo);
            }
        }
        if (candidates.isEmpty() && usable.size() >= 2) {
            List<WardrobeItem> fallback = onePerType(usable);
            if (fallback.size() >= 2) {
                candidates.add(fallback.subList(0, Math.min(3, fallback.size())));
            }
        }
        List<WardrobeItem> accessories = top(byCat, "accessory_piece");
        List<Composition> result = new ArrayList<>();
        candidates.sort(Comparator.comparingDouble(
                (List<WardrobeItem> c) -> LocalSchemeScoring.comboScore(c, occasions, styles, season, words)).reversed());
        Set<Set<UUID>> used = new HashSet<>();
        for (List<WardrobeItem> combo : candidates) {
            Set<UUID> key = combo.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
            boolean tooSimilar = used.stream().anyMatch(u -> overlap(u, key) >= key.size());
            if (tooSimilar) {
                continue;
            }
            used.add(key);
            List<WardrobeItem> pieces = new ArrayList<>(combo);
            for (WardrobeItem acc : accessories) {
                if (LocalSchemeScoring.score(acc, occasions, styles, season, words) > 0
                        && pieces.stream().noneMatch(p -> p.getId().equals(acc.getId()))
                        && LocalSchemeScoring.harmony(pieces, acc) >= 0) {
                    pieces.add(acc);
                    break;
                }
            }
            result.add(toComposition(pieces, occasions, styles, season, LocalSchemeScoring.comboScore(combo, occasions, styles, season, words)));
            if (result.size() >= count) {
                break;
            }
        }
        return result;
    }

    public static Composition toComposition(List<WardrobeItem> pieces, List<String> occasions, List<String> styles,
                                            String season, double score) {
        List<Pick> picks = pieces.stream().map(p -> new Pick(p.getId(), slotOf(p))).toList();
        List<String> occ = synthesize(pieces.stream().flatMap(p -> Json.csv(p.getOccasionTags()).stream()).toList(), occasions, 3);
        List<String> sty = synthesize(pieces.stream().flatMap(p -> Json.csv(p.getStyleTags()).stream()).toList(), styles, 3);
        BigDecimal total = pieces.stream().map(WardrobeItem::getPrice).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<String> seals = LocalSchemeLabels.seals(pieces, sty, occ, total);
        String mood = LocalSchemeLabels.mood(sty, occ);
        String title = LocalSchemeLabels.title(sty, occ, season);
        String rationale = Msg.t("localSchemeComposer.combinacao_de_pecas_do_seu", pieces.size(), (occ.isEmpty() ? Msg.t("localSchemeComposer.ocasiao_livre") : Msg.t("localSchemeComposer.ocasiao", String.join("/", occ))), (sty.isEmpty() ? "" : " e estilo " + String.join("/", sty)));
        return new Composition(title, picks, occ, sty, season, mood, seals, total, score, rationale);
    }

    /**
     * RF5 — um look tem no máximo uma peça de cada tipo (cima, baixo, calçado, acessório); a peça inteira ocupa cima e
     * baixo. Mantém a primeira de cada tipo, na ordem recebida (a IA ou o ranking já vêm em ordem de preferência).
     */
    public static List<WardrobeItem> onePerType(List<WardrobeItem> pieces) {
        List<WardrobeItem> out = new ArrayList<>();
        for (WardrobeItem w : pieces) {
            String type = typeOf(w);
            if (out.stream().noneMatch(o -> clashes(typeOf(o), type))) {
                out.add(w);
            }
        }
        return out;
    }

    static String typeOf(WardrobeItem w) {
        return w.getCategory() == null ? "accessory_piece" : w.getCategory();
    }

    static boolean clashes(String a, String b) {
        boolean aBody = a.equals("upper_piece") || a.equals("lower_piece");
        boolean bBody = b.equals("upper_piece") || b.equals("lower_piece");
        return a.equals(b) || (a.equals("full_body_piece") && bBody) || (b.equals("full_body_piece") && aBody);
    }

    public static SchemeSlot slotOf(WardrobeItem item) {
        return switch (item.getCategory() == null ? "" : item.getCategory()) {
            case "upper_piece" -> Set.of("jacket", "coat", "parka", "blazer", "windbreaker", "cardigan", "kimono")
                    .contains(item.getSubcategory()) ? SchemeSlot.OUTERWEAR : SchemeSlot.TOP;
            case "lower_piece" -> SchemeSlot.BOTTOM;
            case "shoes_piece" -> SchemeSlot.SHOES;
            case "full_body_piece" -> SchemeSlot.FULL_BODY;
            default -> SchemeSlot.ACCESSORY;
        };
    }

    /** Síntese por frequência ponderada: pedidos do usuário pesam 2, tags das peças pesam 1 — top N. */
    public static List<String> synthesize(List<String> itemTags, List<String> requested, int max) {
        Map<String, Double> weight = new LinkedHashMap<>();
        if (requested != null) {
            requested.forEach(r -> weight.merge(r, 2.0, Double::sum));
        }
        itemTags.forEach(t -> weight.merge(t, 1.0, Double::sum));
        return weight.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(Map.Entry::getKey).limit(max).toList();
    }

    private static List<WardrobeItem> top(Map<String, List<WardrobeItem>> byCat, String cat) {
        List<WardrobeItem> list = byCat.getOrDefault(cat, List.of());
        return list.subList(0, Math.min(5, list.size()));
    }

    private static List<WardrobeItem> nullList() {
        List<WardrobeItem> l = new ArrayList<>();
        l.add(null);
        return l;
    }

    private static long overlap(Set<UUID> a, Set<UUID> b) {
        return a.stream().filter(b::contains).count();
    }

}
