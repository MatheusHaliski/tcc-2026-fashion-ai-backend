package br.com.fashionai.application.vision.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.vision.ensemble.BrandEnsembleResolver;
import br.com.fashionai.domain.model.KbBrandSignature;
import br.com.fashionai.domain.model.KbProductLine;
import br.com.fashionai.domain.model.KbProductModel;
import br.com.fashionai.domain.repository.KbBrandSignatureRepository;
import br.com.fashionai.domain.repository.KbProductLineRepository;
import br.com.fashionai.domain.repository.KbProductModelRepository;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * RF4 · Product Knowledge Base — assinaturas de marca, linhas e modelos (tabelas kb_*). Fornece evidência
 * complementar ao ensemble (posição típica do logo, marca × categoria) e a identificação de linha/modelo por tokens
 * de OCR e padrões de código. Nunca é prova: um modelo achado por token tem confiança moderada.
 */
@Service
public class ProductKnowledgeBase {
    private final KbBrandSignatureRepository signatures;
    private final KbProductLineRepository lines;
    private final KbProductModelRepository models;

    /** Zonas do {@code BrandRegions}/perfis → regiões da base de conhecimento. */
    private static final Map<String, String> ZONE_TO_REGION = Map.ofEntries(
            Map.entry("peito_esquerdo", "chest_left"), Map.entry("peito_direito", "chest_right"),
            Map.entry("centro_peito", "chest"), Map.entry("gola", "neck_label"), Map.entry("cos", "front_waistband"),
            Map.entry("cos_traseiro", "back_waistband_patch"), Map.entry("bolso_traseiro", "back_pockets"),
            Map.entry("lateral", "side_panel"), Map.entry("lingua", "tongue"), Map.entry("calcanhar", "heel"));

    public ProductKnowledgeBase(KbBrandSignatureRepository signatures, KbProductLineRepository lines,
                                KbProductModelRepository models) {
        this.signatures = signatures;
        this.lines = lines;
        this.models = models;
    }

    public static String slug(String brand) {
        String n = Normalizer.normalize(brand == null ? "" : brand, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replace("'", "").replace("’", "").replace(".", "");
        return n.trim().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    public List<KbBrandSignature> signatures(String brand) {
        return brand == null ? List.of() : signatures.findByBrandSlug(slug(brand));
    }

    /** Evidências da base para uma marca candidata: posição do logo consistente e categoria compatível. */
    public List<BrandEnsembleResolver.Evidence> evidenceFor(String brand, String zone, String category, String view) {
        List<BrandEnsembleResolver.Evidence> out = new ArrayList<>();
        List<KbBrandSignature> sigs = signatures(brand);
        if (sigs.isEmpty()) {
            return out;
        }
        String region = zone == null ? null : ZONE_TO_REGION.getOrDefault(zone, zone);
        for (KbBrandSignature s : sigs) {
            if (region != null && s.getTypicalRegions() != null && Json.csv(s.getTypicalRegions()).contains(region)) {
                out.add(new BrandEnsembleResolver.Evidence(BrandEnsembleResolver.Signal.SIGNATURE_PATTERN, brand,
                        s.getWeight().doubleValue(), "posição típica do " + s.getName() + " (" + region + ")", view, "kb"));
                break;
            }
        }
        boolean category_ = category != null && sigs.stream().anyMatch(s -> s.getCategories() != null && Json.csv(s.getCategories()).contains(category));
        if (category_) {
            out.add(new BrandEnsembleResolver.Evidence(BrandEnsembleResolver.Signal.CATEGORY_CONTEXT, brand, 1.0,
                    "a marca produz essa categoria", view, "kb"));
        }
        return out;
    }

    /** Marca citada por um token de OCR conhecido da base (ex.: "AIRWAIR" → Dr. Martens). */
    public Optional<String> brandByToken(String text) {
        String t = fold(text);
        if (t.isBlank()) {
            return Optional.empty();
        }
        for (KbBrandSignature s : signatures.findAll()) {
            for (String token : Json.csv(s.getOcrTokens())) {
                if (token.length() >= 4 && t.contains(fold(token))) {
                    return Optional.of(s.getBrandName());
                }
            }
        }
        return Optional.empty();
    }

    public record ModelMatch(String productLine, double lineConfidence, String model, double modelConfidence, String evidence) {
    }

    /**
     * Linha e modelo a partir do texto lido (OCR de etiqueta/língua/verso + IA). Código que casa com o padrão do modelo
     * vale mais que um token solto; token curto ("501") só vale com a marca já conhecida.
     */
    public Optional<ModelMatch> matchModel(String brand, String text) {
        if (brand == null || text == null || text.isBlank()) {
            return Optional.empty();
        }
        String slug = slug(brand);
        String folded = fold(text);
        String upper = text.toUpperCase(Locale.ROOT);
        ModelMatch best = null;
        for (KbProductModel m : models.findByBrandSlug(slug)) {
            double conf = 0;
            String why = null;
            if (m.getCodePattern() != null && Pattern.compile(m.getCodePattern()).matcher(upper).find()) {
                conf = 0.9;
                why = "código " + m.getCodePattern();
            }
            for (String token : Json.csv(m.getOcrTokens())) {
                if (containsWord(folded, fold(token))) {
                    double c = token.length() >= 6 ? 0.8 : 0.65;
                    if (c > conf) {
                        conf = c;
                        why = "texto \"" + token + "\"";
                    }
                }
            }
            if (conf > 0 && (best == null || conf > best.modelConfidence())) {
                String line = m.getProductLineId() == null ? null
                        : lines.findById(m.getProductLineId()).map(KbProductLine::getName).orElse(null);
                best = new ModelMatch(line, Math.min(0.95, conf + 0.05), m.getName(), conf, why);
            }
        }
        if (best == null) {
            for (KbProductLine l : lines.findByBrandSlug(slug)) {
                for (String token : Json.csv(l.getOcrTokens())) {
                    if (token.length() >= 3 && containsWord(folded, fold(token))) {
                        return Optional.of(new ModelMatch(l.getName(), 0.7, null, 0, "texto \"" + token + "\""));
                    }
                }
            }
        }
        return Optional.ofNullable(best);
    }

    static boolean containsWord(String haystack, String needle) {
        if (needle.isBlank()) {
            return false;
        }
        return (" " + haystack + " ").contains(" " + needle + " ");
    }

    static String fold(String s) {
        if (s == null) {
            return "";
        }
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ").trim();
    }

    public static String canonicalBrand(String brand) {
        return BrandEnsembleResolver.canonical(brand);
    }
}
