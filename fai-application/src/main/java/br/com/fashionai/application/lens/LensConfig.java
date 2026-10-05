package br.com.fashionai.application.lens;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * RF54 · Parâmetros do FashionAI Lens, versionados como o {@code HypeScoreConfig}: todo resultado diz com qual versão
 * do algoritmo foi feito ({@link #ALGORITHM_VERSION}). Mudar um peso = nova versão.
 *
 * <pre>
 * semelhança = 100 · (0,45·visual + 0,35·atributos + 0,20·cor) / Σ pesos presentes
 * atributos  = 0,40·subcategoria + 0,15·categoria + 0,15·material + 0,15·padrão + 0,15·sobreposição de estilo
 * cor        = max(0, 1 − ΔE00 / 40)
 * </pre>
 */
@Component
public class LensConfig {
    public static final String ALGORITHM_VERSION = "LENS_V1";

    /** Pesos das três dimensões da semelhança (§9.2). */
    public static final double W_VISUAL = 0.45;
    public static final double W_ATTRIBUTES = 0.35;
    public static final double W_COLOR = 0.20;

    /** Pesos dos atributos (somam 1; atributo sem dado de um dos lados sai da conta). */
    public static final double A_SUBCATEGORY = 0.40;
    public static final double A_CATEGORY = 0.15;
    public static final double A_MATERIAL = 0.15;
    public static final double A_PATTERN = 0.15;
    public static final double A_STYLE = 0.15;

    /** ΔE00 a partir do qual a cor já não conta nada. */
    public static final double DELTA_E_MAX = 40.0;

    /** Pisos por escopo: abaixo disso a correspondência não aparece ("sem correspondência", nunca 0%). */
    public static final int FLOOR_MY_CLOSET = 55;
    public static final int FLOOR_COMMUNITY = 65;
    /** Correspondências por escopo e por peça. */
    public static final int TOP_N = 12;

    /** Peça própria "quase igual" (redundância: você já tem uma assim). */
    public static final int REDUNDANT_AT = 85;
    /** Motivos: cor próxima (componente ≥ 75 ≈ ΔE00 ≤ 10) e visual próximo (cosseno ≥ 0,85). */
    public static final int COLOR_CLOSE_AT = 75;
    public static final int VISUAL_CLOSE_AT = 85;

    /** Faixas de confiança escritas na UI. */
    public static final double CONFIDENCE_HIGH = 0.75;
    public static final double CONFIDENCE_MEDIUM = 0.50;

    /** Hype do grupo: mínimo de itens públicos com o mesmo par de atributos (k-anonimato da leitura). */
    public static final int TREND_MIN_ITEMS = 5;

    /**
     * Recriar: peso da semelhança na escolha da peça de cada slot (o resto vem do {@code RecommendationScoring} do modo).
     * SEGURO fica perto da foto; EXPERIMENTAL aceita mais distância em troca de novidade e reuso.
     */
    public static final Map<String, Double> RECREATE_SIMILARITY_WEIGHT = Map.of("SAFE", 0.75, "DISCOVERY", 0.55, "EXPERIMENTAL", 0.35);
    /** Alternativas por slot no plano. */
    public static final int RECREATE_ALTERNATIVES = 3;

    /** Lado maior da imagem gravada e da miniatura. */
    public static final int IMAGE_MAX_SIDE = 2048;
    public static final int THUMB_MAX_SIDE = 480;

    private final int dailyScans;
    private final int retentionDays;

    @Autowired
    public LensConfig(@Value("${fashionai.lens.daily-scans:30}") int dailyScans,
                      @Value("${fashionai.lens.retention-days:30}") int retentionDays) {
        this.dailyScans = Math.max(1, dailyScans);
        this.retentionDays = Math.max(1, retentionDays);
    }

    public static LensConfig defaults() {
        return new LensConfig(30, 30);
    }

    /** Scans por pessoa por dia (RateLimitPort). */
    public int dailyScans() {
        return dailyScans;
    }

    /** Dias até um scan não salvo ser apagado. */
    public int retentionDays() {
        return retentionDays;
    }

    public int floor(LensSimilarity.Scope scope) {
        return scope == LensSimilarity.Scope.COMMUNITY ? FLOOR_COMMUNITY : FLOOR_MY_CLOSET;
    }

    public static String confidenceBand(double confidence) {
        return confidence >= CONFIDENCE_HIGH ? "HIGH" : confidence >= CONFIDENCE_MEDIUM ? "MEDIUM" : "LOW";
    }
}
