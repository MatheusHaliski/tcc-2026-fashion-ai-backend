package br.com.fashionai.application.flair;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Slot;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * FLAIR CBC — os links do elenco (docs/flair/cbc/CINCO_ELENCOS.md), puro. Cada linha da formação liga duas vagas; com
 * as duas preenchidas, a força é a soma dos atributos em comum: marca 2, subcategoria 2, categoria 1, estilo 1, cor 1
 * (mesma cor ou mesma família; neutro só com neutro) e ocasião 1. Força 0 = vermelha, 1 = laranja, 2+ = verde. Carta
 * fora da posição da vaga tem química 0 e todas as linhas dela ficam vermelhas. Química da carta: verde vale 1, laranja
 * 0,5, arredondado para baixo e até 3. Química do elenco: soma das cartas sobre 3 por vaga, de 0 a 100.
 */
public final class CbcLinks {
    private CbcLinks() {
    }

    public enum Attribute {
        BRAND(2), SUBCATEGORY(2), CATEGORY(1), STYLE(1), COLOR(1), OCCASION(1);

        private final int weight;

        Attribute(int weight) {
            this.weight = weight;
        }

        public int weight() {
            return weight;
        }
    }

    public enum Level { RED, ORANGE, GREEN }

    public record Edge(String a, String b) {
    }

    public record Link(String a, String b, int strength, Level level, List<Attribute> attributes) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("a", a);
            m.put("b", b);
            m.put("strength", strength);
            m.put("level", level.name());
            m.put("attributes", attributes.stream().map(Enum::name).toList());
            return m;
        }
    }

    public record Result(List<Link> links, Map<String, Integer> cardChemistry, int squadChemistry, Map<Level, Integer> byLevel,
                         Map<Attribute, Integer> linksBy) {
        public int count(Level level) {
            return byLevel.getOrDefault(level, 0);
        }
    }

    /** Atributos em comum entre duas cartas, na ordem da tabela. */
    public static List<Attribute> shared(Card a, Card b) {
        List<Attribute> out = new ArrayList<>();
        if (a == null || b == null) {
            return out;
        }
        if (same(a.brand(), b.brand())) {
            out.add(Attribute.BRAND);
        }
        if (same(a.subcategory(), b.subcategory())) {
            out.add(Attribute.SUBCATEGORY);
        }
        if (same(a.category(), b.category())) {
            out.add(Attribute.CATEGORY);
        }
        if (intersects(a.styles(), b.styles())) {
            out.add(Attribute.STYLE);
        }
        if (a.colors().stream().anyMatch(x -> b.colors().stream().anyMatch(y -> colorMatch(x, y)))) {
            out.add(Attribute.COLOR);
        }
        if (intersects(a.occasions(), b.occasions())) {
            out.add(Attribute.OCCASION);
        }
        return out;
    }

    public static Level level(int strength) {
        return strength >= 2 ? Level.GREEN : strength == 1 ? Level.ORANGE : Level.RED;
    }

    /** Mesma cor ou mesma família da taxonomia; neutro casa só com neutro (no link a cor precisa ser semelhante). */
    public static boolean colorMatch(String x, String y) {
        if (x == null || y == null) {
            return false;
        }
        if (x.equals(y)) {
            return true;
        }
        boolean nx = ColorMath.isNeutral(x);
        boolean ny = ColorMath.isNeutral(y);
        if (nx || ny) {
            return nx && ny;
        }
        String fx = Taxonomy.COLOR_FAMILY.get(x);
        return fx != null && !"Especiais".equals(fx) && fx.equals(Taxonomy.COLOR_FAMILY.get(y));
    }

    /** Links, química por carta e do elenco. Linhas com uma ponta vazia não entram (ainda não existem). */
    public static Result evaluate(List<Slot> slots, List<Edge> edges, Map<String, Card> board) {
        Map<String, Slot> bySlot = new LinkedHashMap<>();
        slots.forEach(s -> bySlot.put(s.key(), s));
        List<Link> links = new ArrayList<>();
        Map<String, Double> raw = new LinkedHashMap<>();
        Map<Level, Integer> byLevel = new EnumMap<>(Level.class);
        Map<Attribute, Integer> linksBy = new EnumMap<>(Attribute.class);
        for (Edge e : edges) {
            Card ca = board.get(e.a());
            Card cb = board.get(e.b());
            if (ca == null || cb == null || !bySlot.containsKey(e.a()) || !bySlot.containsKey(e.b())) {
                continue;
            }
            boolean placed = CbcRules.positionOk(bySlot.get(e.a()), ca) && CbcRules.positionOk(bySlot.get(e.b()), cb);
            List<Attribute> attrs = placed ? shared(ca, cb) : List.of();
            int strength = attrs.stream().mapToInt(Attribute::weight).sum();
            Link link = new Link(e.a(), e.b(), strength, level(strength), attrs);
            links.add(link);
            byLevel.merge(link.level(), 1, Integer::sum);
            if (link.level() != Level.RED) {
                attrs.forEach(x -> linksBy.merge(x, 1, Integer::sum));
            }
            double value = link.level() == Level.GREEN ? 1 : link.level() == Level.ORANGE ? 0.5 : 0;
            raw.merge(e.a(), value, Double::sum);
            raw.merge(e.b(), value, Double::sum);
        }
        Map<String, Integer> chemistry = new LinkedHashMap<>();
        int sum = 0;
        for (Slot s : slots) {
            Card c = board.get(s.key());
            int chem = c == null || !CbcRules.positionOk(s, c) ? 0 : (int) Math.min(3, Math.floor(raw.getOrDefault(s.key(), 0.0)));
            chemistry.put(s.key(), chem);
            sum += chem;
        }
        int squad = slots.isEmpty() ? 0 : (int) Math.round(100.0 * sum / (3.0 * slots.size()));
        return new Result(links, chemistry, squad, byLevel, linksBy);
    }

    /**
     * Requisitos de link do elenco: {@code chemistry} (min, 0–100), {@code cardChemistry} (min por carta preenchida),
     * {@code greenLinks} (min), {@code linksBy} (attribute, count) e {@code noRedLinks} (opcional {@code slot}: só as
     * linhas daquela vaga). Tipos desconhecidos devolvem false (falha fechada).
     */
    public static boolean meets(Result r, Map<String, Object> req, Map<String, Card> board) {
        String type = String.valueOf(req.get("type"));
        return switch (type) {
            case "chemistry" -> r.squadChemistry() >= CbcRules.intOf(req.get("min"), 0);
            case "cardChemistry" -> r.cardChemistry().entrySet().stream().filter(e -> board.get(e.getKey()) != null)
                    .allMatch(e -> e.getValue() >= CbcRules.intOf(req.get("min"), 0));
            case "greenLinks" -> r.count(Level.GREEN) >= CbcRules.intOf(req.get("min"), 0);
            case "linksBy" -> r.linksBy().getOrDefault(attribute(req.get("attribute")), 0) >= CbcRules.intOf(req.get("count"), 1);
            case "noRedLinks" -> r.links().stream()
                    .filter(l -> req.get("slot") == null || l.a().equals(req.get("slot")) || l.b().equals(req.get("slot")))
                    .noneMatch(l -> l.level() == Level.RED);
            default -> false;
        };
    }

    static Attribute attribute(Object v) {
        try {
            return Attribute.valueOf(String.valueOf(v).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean same(String x, String y) {
        return x != null && y != null && !x.isBlank() && x.trim().equalsIgnoreCase(y.trim());
    }

    private static boolean intersects(Set<String> a, Set<String> b) {
        return a != null && b != null && a.stream().filter(Objects::nonNull).anyMatch(b::contains);
    }
}
