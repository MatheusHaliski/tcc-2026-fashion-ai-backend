package br.com.fashionai.application.flair;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR-UT §14 — motor dos Desafios de Montagem, sem I/O e sem IA: requisitos, sintonia por vaga e a história escrita
 * carta a carta. O servidor é a fonte da verdade (o app só mostra o que {@code /check} devolve).
 *
 * <p>Regras do livro (O Império do Efêmero, §14.2) que moram aqui:</p>
 * <ul>
 *   <li>P1 — o requisito {@code theme} conta cartas que combinam com QUALQUER interpretação do Momento: não existe um
 *   jeito certo de viver o Halloween;</li>
 *   <li>P3 — a leitura escolhida só muda a sintonia de tema e a história, nunca os pontos;</li>
 *   <li>C2/C3 — {@code noBuy} e {@code rediscovery} premiam o que já estava no guarda-roupa (o novo pela recombinação,
 *   não pela compra);</li>
 *   <li>D1 — a história nasce das cartas: duas montagens diferentes nunca contam a mesma história.</li>
 * </ul>
 */
public final class CbcRules {
    private CbcRules() {
    }

    public static final String ANY = "ANY";
    /** "Minha leitura": a pessoa não escolhe interpretação; o tema vale com qualquer uma. */
    public static final String OWN = "own";
    public static final int REDISCOVERY_DAYS = 60;
    public static final int MIN_SLOTS = 3;
    public static final int MAX_SLOTS = 11;
    public static final List<String> TIERS = List.of("BRONZE", "PRATA", "OURO", "ESPECIAL");
    public static final Set<String> POSITIONS = Set.of("SUP", "INF", "CAL", "ACE", "VES", "LOOK", ANY);
    public static final Set<String> TYPES = Set.of("tier", "ovrAvg", "ovrMin", "sintonia", "sameBrand", "distinctBrands", "brand", "tag", "theme",
            "hype", "origin", "noBuy", "rediscovery", "strictPosition");
    /** O que uma vaga do mosaico pode exigir da carta que a completa (opcional, conforme o enredo do desafio). */
    public static final Set<String> ACCEPT_KEYS = Set.of("tier", "minOvr", "brand", "category", "subcategory", "color", "style", "occasion", "material", "origin");
    public static final Set<String> TAG_FIELDS = Set.of("color", "style", "occasion", "material");
    public static final Set<String> HYPE_DIMS = Set.of("POP", "ENG", "TRD", "ORI", "RAR", "LON", "NOV", "HYP");

    /**
     * Vaga do mosaico: a posição pedida ("ANY" = qualquer) e, quando o enredo pede, o que a carta precisa ter para virar
     * aquele fragmento da imagem ({@code accepts}: nível, nota mínima, marca, categoria, cor, estilo…). Sem {@code accepts},
     * qualquer carta serve.
     */
    public record Slot(String key, String position, Map<String, Object> accepts) {
        public Slot(String key, String position) {
            this(key, position, Map.of());
        }

        public Slot {
            accepts = accepts == null ? Map.of() : accepts;
        }
    }

    /**
     * Carta como o motor a vê. As tags vêm do retrato da geração ou, em cartas antigas, da peça; {@code pieceAddedAt} e
     * {@code pieceLastWorn} vêm da peça viva (nulos quando a peça foi removida).
     */
    public record Card(UUID id, String position, String tier, int ovr, String brand, String originType, Set<String> styles,
                       Set<String> colors, Set<String> occasions, Set<String> materials, Map<String, Double> hype,
                       Instant pieceAddedAt, LocalDate pieceLastWorn, String category, String subcategory) {
        public Card(UUID id, String position, String tier, int ovr, String brand, String originType, Set<String> styles, Set<String> colors,
                    Set<String> occasions, Set<String> materials, Map<String, Double> hype, Instant pieceAddedAt, LocalDate pieceLastWorn) {
            this(id, position, tier, ovr, brand, originType, styles, colors, occasions, materials, hype, pieceAddedAt, pieceLastWorn, null, null);
        }

        public Card {
            styles = norm(styles);
            colors = norm(colors);
            occasions = norm(occasions);
            materials = norm(materials);
            hype = hype == null ? Map.of() : hype;
        }
    }

    public record Interpretation(String key, Set<String> styles, Set<String> colors) {
        public Interpretation {
            styles = norm(styles);
            colors = norm(colors);
        }
    }

    /**
     * Contexto do desafio: interpretações do Momento, tags do Momento somadas às do desafio, a leitura escolhida, o início
     * (para "sem compras") e o dia de hoje (para "redescoberta").
     */
    public record Context(List<Interpretation> interpretations, Set<String> styles, Set<String> colors, Set<String> occasions,
                          String chosen, Instant startAt, LocalDate today) {
        public Context {
            interpretations = interpretations == null ? List.of() : interpretations;
            styles = norm(styles);
            colors = norm(colors);
            occasions = norm(occasions);
        }

        boolean hasTheme() {
            return !interpretations.isEmpty() || !styles.isEmpty() || !colors.isEmpty() || !occasions.isEmpty();
        }

        Interpretation chosenInterpretation() {
            if (chosen == null || OWN.equals(chosen)) {
                return null;
            }
            return interpretations.stream().filter(i -> i.key().equals(chosen)).findFirst().orElse(null);
        }
    }

    public record SlotResult(String slot, String position, UUID cardId, boolean positionOk, boolean neighbor, boolean theme, int sintonia,
                             boolean accepted, List<String> misses) {
        public SlotResult(String slot, String position, UUID cardId, boolean positionOk, boolean neighbor, boolean theme, int sintonia) {
            this(slot, position, cardId, positionOk, neighbor, theme, sintonia, true, List.of());
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slot", slot);
            m.put("position", position);
            m.put("cardId", cardId);
            m.put("positionOk", positionOk);
            m.put("neighbor", neighbor);
            m.put("theme", theme);
            m.put("sintonia", sintonia);
            m.put("accepted", accepted);
            m.put("misses", misses);
            return m;
        }
    }

    public record RequirementResult(String type, boolean ok, int have, int need, Map<String, Object> args) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", type);
            m.put("ok", ok);
            m.put("have", have);
            m.put("need", need);
            m.put("args", args);
            return m;
        }
    }

    public record Evaluation(List<SlotResult> slots, List<RequirementResult> requirements, int sintonia, int sintoniaMax,
                             int filled, boolean complete, boolean ok, List<UUID> rediscovered) {
    }

    // ================================================================== avaliação
    public static Evaluation evaluate(List<Slot> slots, Map<String, Card> placed, List<Map<String, Object>> requirements, Context ctx) {
        Map<String, Card> board = placed == null ? Map.of() : placed;
        List<SlotResult> results = new ArrayList<>();
        int total = 0;
        for (int i = 0; i < slots.size(); i++) {
            Slot s = slots.get(i);
            Card c = board.get(s.key());
            if (c == null) {
                results.add(new SlotResult(s.key(), s.position(), null, false, false, false, 0, false, List.of()));
                continue;
            }
            List<String> misses = misses(s, c);
            boolean pos = positionOk(s, c);
            boolean neighbor = (i > 0 && harmonious(c, board.get(slots.get(i - 1).key())))
                    || (i < slots.size() - 1 && harmonious(c, board.get(slots.get(i + 1).key())));
            boolean theme = themeFocus(c, ctx);
            int score = (pos ? 1 : 0) + (neighbor ? 1 : 0) + (theme ? 1 : 0);
            total += score;
            results.add(new SlotResult(s.key(), s.position(), c.id(), pos, neighbor, theme, score, misses.isEmpty(), misses));
        }
        List<Card> cards = slots.stream().map(s -> board.get(s.key())).filter(Objects::nonNull).toList();
        int filled = cards.size();
        boolean complete = filled == slots.size();
        List<RequirementResult> reqs = new ArrayList<>();
        for (Map<String, Object> r : requirements == null ? List.<Map<String, Object>>of() : requirements) {
            reqs.add(requirement(r, slots, board, cards, total, ctx));
        }
        // a vaga que pede uma carta específica para o fragmento só fecha com essa carta
        boolean slotsOk = results.stream().allMatch(r -> r.cardId() == null || r.accepted());
        boolean ok = complete && slotsOk && reqs.stream().allMatch(RequirementResult::ok);
        List<UUID> rediscovered = cards.stream().filter(c -> idleDays(c, ctx.today()) >= REDISCOVERY_DAYS).map(Card::id).toList();
        return new Evaluation(results, reqs, total, 3 * slots.size(), filled, complete, ok, rediscovered);
    }

    static RequirementResult requirement(Map<String, Object> r, List<Slot> slots, Map<String, Card> board, List<Card> cards, int sintonia, Context ctx) {
        String type = String.valueOf(r.get("type"));
        int n = slots.size();
        Map<String, Object> args = new LinkedHashMap<>(r);
        args.remove("type");
        switch (type) {
            case "tier" -> {
                if (r.get("only") != null) {
                    String only = tier(r.get("only"));
                    int have = (int) cards.stream().filter(c -> only.equals(c.tier())).count();
                    return new RequirementResult(type, have >= n, have, n, args);
                }
                if (r.get("max") != null) {
                    int max = TIERS.indexOf(tier(r.get("max")));
                    int have = (int) cards.stream().filter(c -> TIERS.indexOf(c.tier()) <= max).count();
                    return new RequirementResult(type, have >= n, have, n, args);
                }
                if (r.get("exact") != null) {
                    String exact = tier(r.get("exact"));
                    int need = intOf(r.get("count"), 1);
                    int have = (int) cards.stream().filter(c -> exact.equals(c.tier())).count();
                    return new RequirementResult(type, have == need, have, need, args);
                }
                int min = TIERS.indexOf(tier(r.get("min")));
                int need = intOf(r.get("count"), n);
                int have = (int) cards.stream().filter(c -> TIERS.indexOf(c.tier()) >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "ovrAvg" -> {
                int min = intOf(r.get("min"), 0);
                int avg = cards.isEmpty() ? 0 : (int) Math.round(cards.stream().mapToInt(Card::ovr).average().orElse(0));
                return new RequirementResult(type, cards.size() == n && avg >= min, avg, min, args);
            }
            case "ovrMin" -> {
                // sem "count": todas as cartas; com "count": pelo menos N ("3 cartas com nota acima de 80")
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), n);
                int have = (int) cards.stream().filter(c -> c.ovr() >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "brand" -> {
                // marca específica ("3 cartas da Norte"): quando o desafio é de uma marca, o nome vem do perfil dela
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.brand() != null && wanted.contains(c.brand().trim().toLowerCase(Locale.ROOT))).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "sintonia" -> {
                int min = intOf(r.get("min"), 0);
                return new RequirementResult(type, sintonia >= min, sintonia, min, args);
            }
            case "sameBrand" -> {
                int need = intOf(r.get("count"), 2);
                Map<String, Integer> byBrand = new HashMap<>();
                cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .forEach(b -> byBrand.merge(b.trim().toLowerCase(Locale.ROOT), 1, Integer::sum));
                int have = byBrand.values().stream().max(Integer::compare).orElse(0);
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "distinctBrands" -> {
                int need = intOf(r.get("count"), 2);
                int have = (int) cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .map(b -> b.trim().toLowerCase(Locale.ROOT)).distinct().count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "tag" -> {
                String field = String.valueOf(r.getOrDefault("field", "style"));
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> tagMatch(c, field, wanted)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "theme" -> {
                // P1: qualquer interpretação do Momento (ou as tags do desafio) vale — nunca só a escolhida
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> themeAny(c, ctx)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "hype" -> {
                String dim = String.valueOf(r.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT);
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.hype().get(dim) != null && c.hype().get(dim) >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "origin" -> {
                String only = String.valueOf(r.getOrDefault("only", "PIECE")).toUpperCase(Locale.ROOT);
                int have = (int) cards.stream().filter(c -> only.equals(c.originType())).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "noBuy" -> {
                // C2: a peça já estava no guarda-roupa antes do início (sem início, basta a peça existir)
                int have = (int) cards.stream().filter(c -> c.pieceAddedAt() != null
                        && (ctx.startAt() == null || c.pieceAddedAt().isBefore(ctx.startAt()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "rediscovery" -> {
                int days = intOf(r.get("idleDays"), REDISCOVERY_DAYS);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> idleDays(c, ctx.today()) >= days).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "strictPosition" -> {
                int have = (int) slots.stream().filter(s -> board.get(s.key()) != null && positionOk(s, board.get(s.key()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            default -> {
                return new RequirementResult(type, false, 0, 1, args);
            }
        }
    }

    /** O que falta à carta para completar a vaga (lista vazia = aceita). Vaga sem {@code accepts} aceita qualquer carta. */
    public static List<String> misses(Slot s, Card c) {
        List<String> out = new ArrayList<>();
        Map<String, Object> a = s.accepts();
        if (a.isEmpty() || c == null) {
            return out;
        }
        if (a.get("tier") != null) {
            Set<String> tiers = new HashSet<>();
            strings(a.get("tier")).forEach(t -> tiers.add(t.toUpperCase(Locale.ROOT)));
            if (a.get("tier") instanceof String one) {
                tiers.add(one.toUpperCase(Locale.ROOT));
            }
            if (!tiers.contains(c.tier())) {
                out.add("tier");
            }
        }
        if (a.get("minOvr") instanceof Number n && c.ovr() < n.intValue()) {
            out.add("minOvr");
        }
        if (a.get("brand") != null && (c.brand() == null || !norm(listOrOne(a.get("brand"))).contains(c.brand().trim().toLowerCase(Locale.ROOT)))) {
            out.add("brand");
        }
        if (a.get("category") != null && (c.category() == null || !norm(listOrOne(a.get("category"))).contains(c.category().toLowerCase(Locale.ROOT)))) {
            out.add("category");
        }
        if (a.get("subcategory") != null && (c.subcategory() == null || !norm(listOrOne(a.get("subcategory"))).contains(c.subcategory().toLowerCase(Locale.ROOT)))) {
            out.add("subcategory");
        }
        if (a.get("color") != null && !colorsMatch(c.colors(), norm(listOrOne(a.get("color"))))) {
            out.add("color");
        }
        if (a.get("style") != null && !intersects(c.styles(), norm(listOrOne(a.get("style"))))) {
            out.add("style");
        }
        if (a.get("occasion") != null && !intersects(c.occasions(), norm(listOrOne(a.get("occasion"))))) {
            out.add("occasion");
        }
        if (a.get("material") != null && !intersects(c.materials(), norm(listOrOne(a.get("material"))))) {
            out.add("material");
        }
        if (a.get("origin") != null && !String.valueOf(a.get("origin")).equalsIgnoreCase(c.originType())) {
            out.add("origin");
        }
        return out;
    }

    static List<String> listOrOne(Object v) {
        return v instanceof String s ? List.of(s) : strings(v);
    }

    // ================================================================== sintonia
    static boolean positionOk(Slot s, Card c) {
        return s.position() == null || ANY.equals(s.position()) || s.position().equals(c.position());
    }

    /** +1 vizinhança: mesma marca, um estilo em comum ou cores em harmonia com a carta da vaga ao lado. */
    static boolean harmonious(Card a, Card b) {
        if (a == null || b == null) {
            return false;
        }
        if (a.brand() != null && b.brand() != null && !a.brand().isBlank() && a.brand().trim().equalsIgnoreCase(b.brand().trim())) {
            return true;
        }
        if (intersects(a.styles(), b.styles())) {
            return true;
        }
        for (String x : a.colors()) {
            for (String y : b.colors()) {
                if (colorHarmony(x, y)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Roda de famílias da taxonomia: neutros combinam com tudo; mesma família, vizinhas e complementares combinam. */
    static final List<String> WHEEL = List.of("Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Roxo", "Rosa");
    static final Set<Set<String>> COMPLEMENTS = Set.of(Set.of("Azul", "Laranja"), Set.of("Vermelho", "Verde"), Set.of("Roxo", "Amarelo"));

    public static boolean colorHarmony(String x, String y) {
        if (x == null || y == null) {
            return false;
        }
        if (x.equals(y) || ColorMath.isNeutral(x) || ColorMath.isNeutral(y)) {
            return true;
        }
        String fx = Taxonomy.COLOR_FAMILY.get(x);
        String fy = Taxonomy.COLOR_FAMILY.get(y);
        if (fx == null || fy == null) {
            return false;
        }
        if ("Especiais".equals(fx) || "Especiais".equals(fy) || fx.equals(fy)) {
            return true;
        }
        int ix = WHEEL.indexOf(fx);
        int iy = WHEEL.indexOf(fy);
        if (ix >= 0 && iy >= 0) {
            int d = Math.abs(ix - iy);
            if (d == 1 || d == WHEEL.size() - 1) {
                return true;
            }
        }
        return COMPLEMENTS.contains(Set.of(fx, fy));
    }

    /** Cor da carta conta como a do tema quando é a mesma ou da mesma família ("grafite" vale como "preto"). */
    static boolean colorMatch(String cardColor, String tagColor) {
        if (cardColor == null || tagColor == null) {
            return false;
        }
        if (cardColor.equals(tagColor)) {
            return true;
        }
        String fc = Taxonomy.COLOR_FAMILY.get(cardColor);
        return fc != null && !"Especiais".equals(fc) && fc.equals(Taxonomy.COLOR_FAMILY.get(tagColor));
    }

    static boolean colorsMatch(Set<String> cardColors, Set<String> tagColors) {
        for (String c : cardColors) {
            for (String t : tagColors) {
                if (colorMatch(c, t)) {
                    return true;
                }
            }
        }
        return false;
    }

    static boolean matchesInterpretation(Card c, Interpretation i) {
        return intersects(c.styles(), i.styles()) || colorsMatch(c.colors(), i.colors());
    }

    /** Tema em "qualquer leitura": alguma interpretação, ou as tags do Momento e do desafio. */
    public static boolean themeAny(Card c, Context ctx) {
        if (ctx == null || !ctx.hasTheme()) {
            return false;
        }
        for (Interpretation i : ctx.interpretations()) {
            if (matchesInterpretation(c, i)) {
                return true;
            }
        }
        return intersects(c.styles(), ctx.styles()) || colorsMatch(c.colors(), ctx.colors()) || intersects(c.occasions(), ctx.occasions());
    }

    /** +1 tema da sintonia: com leitura escolhida, a interpretação dela (ou as tags do próprio desafio); senão, qualquer uma. */
    static boolean themeFocus(Card c, Context ctx) {
        Interpretation chosen = ctx == null ? null : ctx.chosenInterpretation();
        if (chosen == null) {
            return themeAny(c, ctx);
        }
        return matchesInterpretation(c, chosen) || intersects(c.styles(), ctx.styles()) || colorsMatch(c.colors(), ctx.colors());
    }

    static boolean tagMatch(Card c, String field, Set<String> wanted) {
        return switch (field) {
            case "color" -> colorsMatch(c.colors(), wanted);
            case "occasion" -> intersects(c.occasions(), wanted);
            case "material" -> intersects(c.materials(), wanted);
            default -> intersects(c.styles(), wanted);
        };
    }

    /** Dias sem uso: desde o último uso; nunca usada, desde que entrou no guarda-roupa; peça removida = 0. */
    public static long idleDays(Card c, LocalDate today) {
        if (today == null) {
            return 0;
        }
        if (c.pieceLastWorn() != null) {
            return ChronoUnit.DAYS.between(c.pieceLastWorn(), today);
        }
        if (c.pieceAddedAt() != null) {
            return ChronoUnit.DAYS.between(c.pieceAddedAt().atZone(ZoneOffset.UTC).toLocalDate(), today);
        }
        return 0;
    }

    /** A interpretação que mais combina com as cartas da pessoa (sugestão, nunca obrigação). */
    public static String suggestInterpretation(Collection<Card> cards, List<Interpretation> interpretations) {
        String best = null;
        int bestCount = 0;
        for (Interpretation i : interpretations) {
            int n = (int) cards.stream().filter(c -> matchesInterpretation(c, i)).count();
            if (n > bestCount) {
                best = i.key();
                bestCount = n;
            }
        }
        return best;
    }

    /** A1: o desafio não exige nível acima de Bronze (aberto a quem tem só peças baratas). */
    public static boolean levelOpen(List<Map<String, Object>> requirements) {
        for (Map<String, Object> r : requirements == null ? List.<Map<String, Object>>of() : requirements) {
            if (!"tier".equals(r.get("type"))) {
                continue;
            }
            if (r.get("min") != null && TIERS.indexOf(tier(r.get("min"))) > 0) {
                return false;
            }
            if (r.get("exact") != null && TIERS.indexOf(tier(r.get("exact"))) > 0) {
                return false;
            }
            if (r.get("only") != null && TIERS.indexOf(tier(r.get("only"))) > 0) {
                return false;
            }
        }
        return true;
    }

    // ================================================================== validação (administração)
    /** Erros de forma das vagas e requisitos (lista vazia = válido). */
    public static List<String> validate(List<Slot> slots, List<Map<String, Object>> requirements) {
        List<String> errors = new ArrayList<>();
        if (slots == null || slots.size() < MIN_SLOTS || slots.size() > MAX_SLOTS) {
            errors.add("slots.count");
            return errors;
        }
        Set<String> keys = new HashSet<>();
        for (Slot s : slots) {
            if (s.key() == null || !s.key().matches("[a-z0-9_-]{1,40}") || !keys.add(s.key())) {
                errors.add("slots.key:" + s.key());
            }
            if (s.position() != null && !POSITIONS.contains(s.position())) {
                errors.add("slots.position:" + s.position());
            }
            for (String k : s.accepts().keySet()) {
                if (!ACCEPT_KEYS.contains(k)) {
                    errors.add("slots.accepts:" + k);
                }
            }
        }
        for (Map<String, Object> r : requirements == null ? List.<Map<String, Object>>of() : requirements) {
            Object type = r.get("type");
            if (!(type instanceof String t) || !TYPES.contains(t)) {
                errors.add("requirements.type:" + type);
                continue;
            }
            if ("tier".equals(t)) {
                Object v = r.get("only") != null ? r.get("only") : r.get("max") != null ? r.get("max") : r.get("exact") != null ? r.get("exact") : r.get("min");
                if (v == null || !TIERS.contains(String.valueOf(v).toUpperCase(Locale.ROOT))) {
                    errors.add("requirements.tier");
                }
            }
            if ("tag".equals(t) && (!TAG_FIELDS.contains(String.valueOf(r.get("field"))) || strings(r.get("anyOf")).isEmpty())) {
                errors.add("requirements.tag");
            }
            if ("brand".equals(t) && strings(r.get("anyOf")).isEmpty()) {
                errors.add("requirements.brand");
            }
            if ("hype".equals(t) && !HYPE_DIMS.contains(String.valueOf(r.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT))) {
                errors.add("requirements.hype");
            }
            Object count = r.get("count");
            if (count instanceof Number c && (c.intValue() < 1 || c.intValue() > slots.size())) {
                errors.add("requirements.count:" + t);
            }
        }
        return errors;
    }

    public static boolean hasTheme(List<Map<String, Object>> requirements) {
        return requirements != null && requirements.stream().anyMatch(r -> "theme".equals(r.get("type")));
    }

    // ================================================================== apoio
    static String tier(Object v) {
        return v == null ? "BRONZE" : String.valueOf(v).toUpperCase(Locale.ROOT);
    }

    static int intOf(Object v, int def) {
        return v instanceof Number n ? n.intValue() : def;
    }

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        if (v instanceof Collection<?> c) {
            return c.stream().filter(Objects::nonNull).map(String::valueOf).toList();
        }
        return List.of();
    }

    static boolean intersects(Set<String> a, Set<String> b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) {
            return false;
        }
        for (String x : a) {
            if (b.contains(x)) {
                return true;
            }
        }
        return false;
    }

    public static Set<String> norm(Collection<String> values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    out.add(v.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        return out;
    }
}
