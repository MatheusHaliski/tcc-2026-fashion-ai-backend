package br.com.fashionai.application.service;

import br.com.fashionai.application.service.WardrobeService.PieceForm;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.WardrobeItem;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Variação, atributos, estilo e ocasião da peça vindos do formulário, com a origem da variação (IA × pessoa). */
final class PieceTaxonomyWriter {
    private PieceTaxonomyWriter() {
    }

    /**
     * Variação e atributos da peça (docs/taxonomia, C.6). Formulário sem variação nem atributos (tela antiga, lote,
     * catálogo) mantém os que a peça já tinha — só some a variação que deixou de valer para a subcategoria nova.
     * Estilo e ocasião também vão para os atributos (as colunas CSV continuam, para compatibilidade).
     */
    static void applyTaxonomy(WardrobeItem w, PieceForm f) {
        applyTaxonomy(w, f, null);
    }

    /**
     * @param aiPrefill pré-preenchimento da IA guardado no rascunho da foto (só no cadastro). A variação que volta igual
     *                  à sugerida e que a pessoa não confirmou ({@code confirmed} sem "variation") continua AI_SUGGESTED/AI,
     *                  com a confiança da IA; só a troca ou a confirmação explícita vira USER_CONFIRMED/USER.
     */
    static void applyTaxonomy(WardrobeItem w, PieceForm f, Map<?, ?> aiPrefill) {
        boolean full = f.attributes() != null || f.variation() != null;
        if (full) {
            boolean confirmedByUser = f.confirmed() != null && f.confirmed().contains("variation");
            if (!java.util.Objects.equals(w.getVariationCode(), f.variation())) {
                w.setVariationCode(f.variation());
                String suggested = aiPrefill == null || aiPrefill.get("variation") == null ? null
                        : String.valueOf(aiPrefill.get("variation")).trim().toUpperCase(java.util.Locale.ROOT);
                if (f.variation() == null) {
                    setVariationProvenance(w, null, null, null);
                } else if (f.variation().equals(suggested) && !confirmedByUser) {
                    setVariationProvenance(w, "AI_SUGGESTED", "AI", aiPrefill.get("variationConfidence") instanceof Number n
                            ? BigDecimal.valueOf(n.doubleValue()) : null);
                } else {
                    setVariationProvenance(w, "USER_CONFIRMED", "USER", null);
                }
            } else if (confirmedByUser && f.variation() != null && !"USER_CONFIRMED".equals(w.getVariationStatus())) {
                setVariationProvenance(w, "USER_CONFIRMED", "USER", null);     // a pessoa confirmou a sugestão da IA
            }
            Map<String, List<String>> attrs = f.attributes() == null ? Map.of() : f.attributes();
            w.getAttributes().removeIf(a -> !Taxonomy.FIELD_DIMENSIONS.contains(a.getDimensionCode()) && !attrs.containsKey(a.getDimensionCode()));
            attrs.forEach((dim, codes) -> TaxonomyAttribute.replace(w.getAttributes(), dim, codes, "USER", null));
        } else if (w.getVariationCode() != null && !TaxonomyRegistry.get().isVariationOf(f.subcategory(), w.getVariationCode())) {
            w.setVariationCode(null);
            setVariationProvenance(w, null, null, null);
        }
        TaxonomyAttribute.replace(w.getAttributes(), "STYLE", Taxonomy.canonicalTags(f.style()), "USER", null);
        TaxonomyAttribute.replace(w.getAttributes(), "OCCASION", Taxonomy.canonicalTags(f.occasion()), "USER", null);
    }

    private static void setVariationProvenance(WardrobeItem w, String status, String source, BigDecimal confidence) {
        w.setVariationStatus(status);
        w.setVariationSource(source);
        w.setVariationConfidence(confidence);
    }

    /** Ver {@link PieceForm#resolveTaxonomy()}: subcategoria LEGACY no padrão novo; o que a pessoa escolheu vale mais. */
    static PieceForm resolveLegacy(PieceForm f) {
        TaxonomyRegistry.Resolved r = TaxonomyRegistry.get().resolve(f.subcategory());
        if (r == null || r.legacyCode() == null) {
            return f;
        }
        Map<String, List<String>> attrs = new LinkedHashMap<>(f.attributes() == null ? Map.of() : f.attributes());
        String mat = f.material();
        for (Map.Entry<String, String> e : r.implied().entrySet()) {
            if ("MATERIAL".equals(e.getKey())) {
                if (mat == null || Set.of("COTTON", "BLEND", "SYNTHETIC").contains(mat)) {
                    mat = e.getValue();                      // short jeans antigo: algodão → denim
                }
            } else {
                attrs.putIfAbsent(e.getKey(), List.of(e.getValue()));
            }
        }
        return new PieceForm(f.draftId(), f.useDefaultImage(), f.name(), f.category(), r.subcategory(), f.sex(), f.brandId(),
                f.brandName(), f.color(), mat, f.size(), f.market(), f.occasion(), f.style(), f.seals(), f.price(), f.visibility(),
                f.tags(), f.notes(), f.condition(), f.purchaseDate(), f.purchaseLocation(), f.sku(), f.careInstructions(),
                f.forSale(), f.studio(), f.brandLogoUrl(), f.brandSource(), f.brandRef(), f.background(), f.captureSessionId(),
                f.variation() != null ? f.variation() : r.variation(), attrs, f.confirmed(), f.estadoConservacaoId(),
                f.clearEstadoConservacao());
    }
}
