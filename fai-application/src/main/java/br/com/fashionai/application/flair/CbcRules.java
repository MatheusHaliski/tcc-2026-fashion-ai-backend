package br.com.fashionai.application.flair;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.flair.CbcRequirements.requirement;
import static br.com.fashionai.application.flair.CbcSintonia.harmonious;
import static br.com.fashionai.application.flair.CbcSintonia.positionOk;
import static br.com.fashionai.application.flair.CbcSintonia.themeFocus;

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

    /** O que falta à carta para completar a vaga (lista vazia = aceita). Vaga sem {@code accepts} aceita qualquer carta. */
    public static List<String> misses(Slot s, Card c) {
        return CbcSlotAccepts.misses(s, c);
    }

    // ================================================================== sintonia
    public static boolean colorHarmony(String x, String y) {
        return CbcSintonia.colorHarmony(x, y);
    }

    /** Tema em "qualquer leitura": alguma interpretação, ou as tags do Momento e do desafio. */
    public static boolean themeAny(Card c, Context ctx) {
        return CbcSintonia.themeAny(c, ctx);
    }

    /** Dias sem uso: desde o último uso; nunca usada, desde que entrou no guarda-roupa; peça removida = 0. */
    public static long idleDays(Card c, LocalDate today) {
        return CbcSintonia.idleDays(c, today);
    }

    /** A interpretação que mais combina com as cartas da pessoa (sugestão, nunca obrigação). */
    public static String suggestInterpretation(Collection<Card> cards, List<Interpretation> interpretations) {
        return CbcSintonia.suggestInterpretation(cards, interpretations);
    }

    /** A1: o desafio não exige nível acima de Bronze (aberto a quem tem só peças baratas). */
    public static boolean levelOpen(List<Map<String, Object>> requirements) {
        return CbcValidation.levelOpen(requirements);
    }

    // ================================================================== validação (administração)
    /** Erros de forma das vagas e requisitos (lista vazia = válido). */
    public static List<String> validate(List<Slot> slots, List<Map<String, Object>> requirements) {
        return CbcValidation.validate(slots, requirements);
    }

    public static boolean hasTheme(List<Map<String, Object>> requirements) {
        return CbcValidation.hasTheme(requirements);
    }

    // ================================================================== apoio
    public static Set<String> norm(Collection<String> values) {
        return CbcValues.norm(values);
    }
}
