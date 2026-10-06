package br.com.fashionai.application.moments;

import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import br.com.fashionai.domain.model.enums.MomentNature;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * FAI Points sazonais (§10–§11, §39, §57): política DETERMINÍSTICA — nenhuma linha depende de resposta generativa.
 * Produz as linhas (actionCode, pontos, refId) que o ledger paga 1× cada: a referência é sempre momento(:look), então
 * reenviar, apagar/recriar o look ou sair/entrar do Momento não gera pontos novos. Nenhuma regra premia compra.
 *
 * <ul>
 *   <li>MOMENT_LOOK — look relacionado (MomentMatch ≥ limiar) · 1× por Momento · × multiplicador sazonal;</li>
 *   <li>MOMENT_PUBLISH — look publicado no período · 1× por Momento;</li>
 *   <li>MOMENT_WARDROBE_BONUS — só peças já possuídas (sem peça adicionada após o início) · 1× por Momento;</li>
 *   <li>MOMENT_REDISCOVERY_BONUS — peça sem uso há ≥ N dias · 1× por Momento;</li>
 *   <li>MOMENT_REMIX_BONUS — reinterpretação de look antigo · 1× por Momento;</li>
 *   <li>MOMENT_NEW_STYLE — estilo nunca usado nos looks anteriores · 1× por Momento;</li>
 *   <li>MOMENT_CHALLENGE — cada desafio cumprido · 1× por (Momento, desafio).</li>
 * </ul>
 */
public final class MomentPointsPolicy {
    /** MomentMatch mínimo para o look contar como "relacionado ao Momento". */
    public static final int RELATED_THRESHOLD = 40;
    public static final int DEFAULT_IDLE_DAYS = 60;

    private MomentPointsPolicy() {
    }

    public record Line(String actionCode, int points, String refId, String label) {
        public Map<String, Object> toMap() {
            return Map.of("action", actionCode, "points", points, "ref", refId, "label", label);
        }
    }

    /** Fatos do envio, já apurados pelo serviço (todos verificáveis no banco). */
    public record Facts(Integer matchScore, boolean published, boolean wardrobeOnly, List<UUID> rediscoveredPieces, long maxIdleDays,
                        boolean remixOfOldLook, Set<String> newStyles, int distinctColors, Map<UUID, Integer> looksPerPiece,
                        Set<String> lookStyles, Set<String> lookColors, int submissionsByUser) {
    }

    public static List<Line> compute(Moment m, List<MomentChallenge> challenges, Facts f) {
        List<Line> out = new ArrayList<>();
        if (m == null || !m.isPointsEnabled() || m.getNature() == MomentNature.RELIGIOUS) {
            return out;
        }
        String ref = m.getId().toString();
        Map<String, Object> bonus = bonusRules(m);
        boolean related = f.matchScore() != null && f.matchScore() >= RELATED_THRESHOLD;
        if (related) {
            int base = Math.max(0, m.getBasePoints());
            BigDecimal mult = m.getPointsMultiplier() == null ? BigDecimal.ONE : m.getPointsMultiplier();
            int pts = BigDecimal.valueOf(base).multiply(mult).setScale(0, RoundingMode.HALF_UP).intValue();
            if (pts > 0) {
                out.add(new Line("MOMENT_LOOK", pts, ref, "look"));
            }
            if (f.published()) {
                out.add(new Line("MOMENT_PUBLISH", bonus(bonus, "publish", 10), ref, "publish"));
            }
            if (f.wardrobeOnly()) {
                out.add(new Line("MOMENT_WARDROBE_BONUS", bonus(bonus, "wardrobe", 25), ref, "wardrobe"));
            }
            if (f.rediscoveredPieces() != null && !f.rediscoveredPieces().isEmpty()) {
                out.add(new Line("MOMENT_REDISCOVERY_BONUS", bonus(bonus, "rediscovery", 15), ref, "rediscovery"));
            }
            if (f.remixOfOldLook()) {
                out.add(new Line("MOMENT_REMIX_BONUS", bonus(bonus, "remix", 10), ref, "remix"));
            }
            if (f.newStyles() != null && !f.newStyles().isEmpty()) {
                out.add(new Line("MOMENT_NEW_STYLE", bonus(bonus, "newStyle", 15), ref, "newStyle"));
            }
        }
        if (challenges != null) {
            for (MomentChallenge c : challenges) {
                if (c.isActive() && fulfils(c, f, related)) {
                    out.add(new Line("MOMENT_CHALLENGE", c.getPoints(), ref + ":" + c.getCode(), "challenge:" + c.getCode()));
                }
            }
        }
        return out;
    }

    /** O desafio foi cumprido por este envio? Regras por tipo, sobre tags e fatos — sem IA. */
    public static boolean fulfils(MomentChallenge c, Facts f, boolean related) {
        Map<String, Object> p = c.getParamsJson() == null ? Map.of() : br.com.fashionai.application.common.Json.map(c.getParamsJson());
        return switch (c.getKind()) {
            case NO_BUY -> f.wardrobeOnly() && f.submissionsByUser() >= intParam(p, "looksRequired", 1);
            case REDISCOVERY -> f.rediscoveredPieces() != null && f.rediscoveredPieces().size() >= intParam(p, "piecesRequired", 1)
                    && f.maxIdleDays() >= intParam(p, "idleDays", DEFAULT_IDLE_DAYS);
            case ONE_PIECE_MANY_LOOKS -> f.looksPerPiece() != null && f.looksPerPiece().values().stream().anyMatch(n -> n >= intParam(p, "looksRequired", 3));
            case EXPERIMENTAL -> f.newStyles() != null && !f.newStyles().isEmpty() && (c.getStyleTags() == null
                    || f.lookStyles().stream().anyMatch(s -> MomentMatch.norm(br.com.fashionai.application.common.Json.csv(c.getStyleTags())).contains(s)));
            case REMIX -> f.remixOfOldLook();
            case COLOR -> {
                Set<String> wanted = MomentMatch.norm(br.com.fashionai.application.common.Json.csv(c.getColorTags()));
                int distinct = intParam(p, "distinctColors", 0);
                if (distinct > 0) {
                    yield f.distinctColors() >= distinct && (wanted.isEmpty() || f.lookColors().stream().anyMatch(wanted::contains));
                }
                yield !wanted.isEmpty() && f.lookColors().containsAll(wanted);
            }
            case STYLE, THEME -> {
                Set<String> styles = MomentMatch.norm(br.com.fashionai.application.common.Json.csv(c.getStyleTags()));
                Set<String> colors = MomentMatch.norm(br.com.fashionai.application.common.Json.csv(c.getColorTags()));
                boolean styleOk = styles.isEmpty() || f.lookStyles().stream().anyMatch(styles::contains);
                boolean colorOk = colors.isEmpty() || f.lookColors().stream().anyMatch(colors::contains);
                yield related && styleOk && colorOk && !(styles.isEmpty() && colors.isEmpty());
            }
        };
    }

    static int intParam(Map<String, Object> p, String key, int def) {
        Object v = p.get(key);
        return v instanceof Number n ? n.intValue() : def;
    }

    static int bonus(Map<String, Object> rules, String key, int def) {
        Object v = rules.get(key);
        return v instanceof Number n ? Math.max(0, n.intValue()) : def;
    }

    public static Map<String, Object> bonusRules(Moment m) {
        return m.getBonusRulesJson() == null ? Map.of() : br.com.fashionai.application.common.Json.map(m.getBonusRulesJson());
    }

    /** Projeção "FAI Points previstos" (§58): mesma política, antes de enviar. */
    public static int total(List<Line> lines) {
        return lines.stream().mapToInt(Line::points).sum();
    }

    public static boolean kindNeedsWardrobe(MomentChallengeKind k) {
        return k == MomentChallengeKind.NO_BUY;
    }
}
