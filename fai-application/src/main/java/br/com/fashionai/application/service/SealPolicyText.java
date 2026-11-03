package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.application.service.SealPolicies.HypeCriteria;
import br.com.fashionai.application.service.SealPolicies.Policy;
import br.com.fashionai.application.service.SealPolicies.Rule;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * RF25/RF53 — texto da política (card do selo, e-mails e o "porquê" da sugestão) no idioma de quem lê. Extraído de
 * {@link SealPolicies} (R80).
 */
final class SealPolicyText {
    private SealPolicyText() {
    }

    /** "Porquê" da sugestão: regras que bateram; trecho de Hype (com o valor atual); tags. */
    static String why(String rules, String hype, String tags) {
        String base = rules == null || rules.isEmpty() ? hype : hype == null ? rules : rules + "; " + hype;
        return base == null ? tags : tags == null ? base : base + " · " + tags;
    }

    /** Frase da política inteira: o que o card do selo mostra no lugar do antigo texto livre. */
    static String describe(Policy p, SealTier tier) {
        if (p == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        if (p.referenceModel() != null) parts.add(String.valueOf(p.referenceModel().get("description")));
        for (Rule r : p.rules()) {
            parts.add(describe(r, tier));
        }
        String rules = String.join(p.any() ? conj("sealPolicy.ou") : conj("sealPolicy.e"), parts);
        String hype = p.hype() == null ? null : describeHype(p.hype(), tier);
        return why(rules, hype, describeTags(p));
    }

    /** RF53 — "look com Hype ≥ 60 e em crescimento" / "peça com Hype ≥ Em alta". */
    static String describeHype(HypeCriteria c, SealTier tier) {
        List<String> min = new ArrayList<>();
        if (c.minLevel() != null) {
            min.add(Msg.t("sealPolicy.hype.minimo", levelLabel(c.minLevel())));
        }
        if (c.minScore() != null) {
            min.add(Msg.t("sealPolicy.hype.minimo", c.minScore()));
        }
        List<String> crit = new ArrayList<>();
        if (!min.isEmpty()) {
            crit.add(String.join(conj("sealPolicy.e"), min));
        }
        if (c.momentum() != null && !c.momentum().isEmpty()) {
            crit.add(String.join(conj("sealPolicy.ou"), c.momentum().stream().map(m -> Msg.t("sealPolicy.hype.momento." + m.name())).toList()));
        }
        if (c.dimensionMins() != null) c.dimensionMins().forEach((key, score) -> crit.add(Msg.t("sealHype.dimension_min", Msg.t("hype.dimension." + key), score)));
        String what = String.join(conj("sealPolicy.e"), crit);
        return Msg.t(tier == SealTier.PECA ? "sealPolicy.hype.peca" : "sealPolicy.hype.look", what);
    }

    /**
     * Conjunção com espaço dos dois lados (" e ", " ou "): o .properties descarta o espaço do início do valor, então
     * "sealPolicy.e= e " chega como "e " e juntava as partes sem espaço ("60e em crescimento").
     */
    static String conj(String key) {
        return " " + Msg.t(key).trim() + " ";
    }

    /** Rótulo da faixa de Hype no idioma de quem lê ("Em alta", "Viral"…). */
    static String levelLabel(HypeLevel level) {
        return Msg.t("sealPolicy.hype.nivel." + level.name());
    }

    static String describe(Rule r, SealTier tier) {
        String what = pieceWords(r);
        if (tier == SealTier.PECA) {
            return "NONE".equals(r.quantifier()) ? Msg.t("sealPolicy.peca_que_nao_seja", what) : Msg.t("sealPolicy.peca", what);
        }
        return switch (r.quantifier()) {
            case "ALL" -> Msg.t("sealPolicy.todas_as_pecas", what);
            case "NONE" -> Msg.t("sealPolicy.nenhuma_peca", what);
            default -> r.count() == 1 ? Msg.t("sealPolicy.ao_menos_uma_peca", what) : Msg.t("sealPolicy.no_minimo_pecas", r.count(), what);
        };
    }

    static String pieceWords(Rule r) {
        List<String> w = new ArrayList<>();
        if (r.subcategory() != null) {
            w.add(Msg.t("taxonomy." + r.subcategory()));
        } else if (r.category() != null) {
            w.add(Msg.t("taxonomy." + r.category()));
        }
        if (r.color() != null) {
            String c = Taxonomy.COLORS.containsKey(r.color()) ? Msg.t("taxonomy." + r.color()) : Msg.t("sealPolicy.familia." + r.color().toLowerCase(Locale.ROOT));
            w.add(Msg.t("sealPolicy.cor", c.toLowerCase(Locale.ROOT)));
        }
        if (r.brand() != null) {
            w.add(Msg.t("sealPolicy.da_marca", r.brand()));
        }
        if (r.hypeMin() != null) {
            w.add(Msg.t("sealPolicy.hype.com_hype", levelLabel(r.hypeMin())));
        }
        return String.join(" ", w).trim();
    }

    static String describeTags(Policy p) {
        List<String> t = new ArrayList<>();
        if (!p.occasions().isEmpty()) {
            t.add(Msg.t("sealPolicy.ocasioes", String.join(", ", p.occasions().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        if (!p.styles().isEmpty()) {
            t.add(Msg.t("sealPolicy.estilos", String.join(", ", p.styles().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        return t.isEmpty() ? null : String.join(" · ", t);
    }
}
