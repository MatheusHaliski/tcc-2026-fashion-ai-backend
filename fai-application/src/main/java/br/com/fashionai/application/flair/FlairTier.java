package br.com.fashionai.application.flair;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * FLAIR-UT §4 — nota FLAIR (OVR) e nível da carta, sem I/O (docs/plano/FLAIR_UT_Cartas_e_Desafios.md).
 *
 * <pre>OVR = 45 + 30·preço + 18·marca + 6·acabamento   (arredondado, limitado a 45–92 nas cartas geradas)</pre>
 *
 * Nível: Bronze &lt; 65 · Prata 65–74 · Ouro ≥ 75 (D2). Especial só por programa (selo, loja, evento), nunca por esta conta.
 * O preço que conta é o <b>confirmado</b> (D8): o da faixa do produto na Busca Catalogada. Preço só digitado fica no p75
 * da faixa da categoria e a carta para em Prata. A raridade continua vindo do Hype público e vira o acabamento "raro",
 * fora desta conta (RF53 · P2-18: o preço decide o nível, nunca a raridade).
 */
public final class FlairTier {
    private FlairTier() {
    }

    public static final int PRATA_MIN = 65;
    public static final int OURO_MIN = 75;
    public static final int GENERATED_MIN = 45;
    public static final int GENERATED_MAX = 92;

    /** Faixa de preço da categoria (BRL): p25, p75 e p95. Valores iniciais fixos até a tabela price_band da F2 completa. */
    public record Band(double p25, double p75, double p95) {
    }

    static final Map<String, Band> BANDS = Map.of(
            "upper_piece", new Band(60, 220, 600),
            "lower_piece", new Band(80, 260, 700),
            "shoes_piece", new Band(120, 450, 1200),
            "accessory_piece", new Band(50, 250, 1200),
            "full_body_piece", new Band(100, 400, 1200));
    /** Bolsas têm faixa própria: na faixa geral dos acessórios uma bolsa premium viraria nota de luxo. */
    static final Band BAG = new Band(150, 900, 6000);
    static final Set<String> BAG_SUBS = Set.of("handbag", "clutch", "backpack", "shoulder_bag", "bucket_bag", "belt_bag");

    /** Peso da marca pelo tier de preço do catálogo (Brand.priceTier); sem marca ou desconhecida = 0,1. */
    static final Map<String, Double> BRAND = Map.of("LUXURY", 1.0, "PREMIUM", 0.75, "MID", 0.5, "BUDGET", 0.25);

    /**
     * Entrada: o que o formulário e o catálogo dizem da peça.
     *
     * @param price          preço digitado (nulo = sem preço)
     * @param catalogMin     faixa do produto escolhido na Busca Catalogada (nula = peça sem produto do catálogo)
     * @param brandPriceTier tier de preço da marca no catálogo (BUDGET, MID, PREMIUM, LUXURY) ou nulo
     * @param brandKnown     a peça tem marca (nome) — sem tier conta como "desconhecida"
     * @param brandVerified  marca com perfil verificado na plataforma (+0,05)
     */
    public record Input(String category, String subcategory, Double price, Double catalogMin, Double catalogMax,
                        String brandPriceTier, boolean brandKnown, boolean brandVerified, boolean hasStyles,
                        boolean hasOccasions, boolean hasColor, boolean hasMaterial, boolean studioPhoto, boolean model3d) {
    }

    /** Resultado com o porquê (vai para o verso da carta e para a prévia do criador). */
    public record Result(int ovr, String tier, boolean priceVerified, Double priceUsed, double priceFactor, double brandFactor,
                         double finishFactor, boolean cappedByUnverifiedPrice) {
        public Map<String, Object> basis() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("priceUsed", priceUsed);
            m.put("priceVerified", priceVerified);
            m.put("priceFactor", round2(priceFactor));
            m.put("brandFactor", round2(brandFactor));
            m.put("finishFactor", round2(finishFactor));
            m.put("cappedByUnverifiedPrice", cappedByUnverifiedPrice);
            return m;
        }
    }

    public static Band band(String category, String subcategory) {
        if (subcategory != null && (BAG_SUBS.contains(subcategory) || subcategory.endsWith("_bag"))) {
            return BAG;
        }
        return BANDS.getOrDefault(category == null ? "" : category, BANDS.get("upper_piece"));
    }

    /** Posição do preço na faixa, em escala log: abaixo do p25 = 0, no p95 ou acima = 1. */
    static double priceFactor(Double price, Band b) {
        if (price == null || price <= 0) {
            return 0;
        }
        double f = (Math.log(price) - Math.log(b.p25())) / (Math.log(b.p95()) - Math.log(b.p25()));
        return Math.max(0, Math.min(1, f));
    }

    static double brandFactor(Input in) {
        double f = in.brandPriceTier() != null ? BRAND.getOrDefault(in.brandPriceTier().toUpperCase(Locale.ROOT), 0.1) : 0.1;
        return Math.min(1, f + (in.brandKnown() && in.brandVerified() ? 0.05 : 0));
    }

    /** Peso pequeno de propósito: completar o cadastro nunca leva sozinho a peça de um nível ao outro. */
    static double finishFactor(Input in) {
        return Math.min(1, (in.hasStyles() ? 0.2 : 0) + (in.hasOccasions() ? 0.2 : 0) + (in.hasColor() ? 0.1 : 0)
                + (in.hasMaterial() ? 0.1 : 0) + (in.studioPhoto() ? 0.2 : 0) + (in.model3d() ? 0.2 : 0));
    }

    public static String tierOf(int ovr) {
        return ovr >= OURO_MIN ? "OURO" : ovr >= PRATA_MIN ? "PRATA" : "BRONZE";
    }

    public static Result compute(Input in) {
        Band b = band(in.category(), in.subcategory());
        boolean verified = in.catalogMin() != null && in.catalogMax() != null && in.catalogMax() > 0;
        Double used;
        if (verified) {
            // D8: o preço que conta é o da faixa do produto; digitado fora da faixa, vale o limite mais próximo
            double typed = in.price() == null || in.price() <= 0 ? (in.catalogMin() + in.catalogMax()) / 2 : in.price();
            used = Math.max(in.catalogMin(), Math.min(in.catalogMax(), typed));
        } else {
            // preço só digitado: no máximo o p75 da faixa da categoria
            used = in.price() == null || in.price() <= 0 ? null : Math.min(in.price(), b.p75());
        }
        double pf = priceFactor(used, b), bf = brandFactor(in), ff = finishFactor(in);
        int raw = (int) Math.round(45 + 30 * pf + 18 * bf + 6 * ff);
        int ovr = Math.max(GENERATED_MIN, Math.min(GENERATED_MAX, raw));
        boolean capped = false;
        if (!verified && ovr >= OURO_MIN) {
            ovr = OURO_MIN - 1;           // preço sem confirmação não passa de Prata (D8)
            capped = true;
        }
        return new Result(ovr, tierOf(ovr), verified, used, pf, bf, ff, capped);
    }

    /** Posição da carta pela categoria (como a posição do jogador). */
    public static String position(String category) {
        return switch (category == null ? "" : category) {
            case "upper_piece" -> "SUP";
            case "lower_piece" -> "INF";
            case "shoes_piece" -> "CAL";
            case "accessory_piece" -> "ACE";
            case "full_body_piece" -> "VES";
            default -> "SUP";
        };
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
