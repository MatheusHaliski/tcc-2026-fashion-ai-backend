package br.com.fashionai.application.catalog;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import tools.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF47 · Interpretação das características únicas da peça no texto da busca catalogada.
 *
 * <p>Sempre roda a leitura LOCAL ({@link CatalogDesignInterpreter}). Em descrições mais longas (4+ palavras), pede ao motor
 * de IA ({@link AiCapability#CATALOG_TEXT_INTERPRETER}, RF24) que refine a leitura — a IA só pode responder com o
 * vocabulário fechado (estampas, posições, tamanhos, lados e códigos de cor da taxonomia); o que vier fora dele é
 * descartado. O resultado fica em cache por texto normalizado (a busca roda enquanto a pessoa digita). Sem IA, vale a
 * leitura local: nada é inventado.</p>
 */
@Component
public class CatalogTextInterpreter {
    private static final int CACHE_MAX = 500;
    private final AiEngine ai;
    private final CatalogNormalizer norm = CatalogNormalizer.get();
    private final CatalogDesignInterpreter local = CatalogDesignInterpreter.get();
    private final Map<String, DesignTraits> cache = java.util.Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, DesignTraits> eldest) {
            return size() > CACHE_MAX;
        }
    });

    public CatalogTextInterpreter(AiEngine ai) {
        this.ai = ai;
    }

    static final String SYSTEM = """
            Você é o leitor de características de peças de roupa do FashionAI. Leia a descrição que a pessoa digitou para
            achar uma peça no catálogo e extraia SOMENTE o que está escrito (nunca invente). Responda SOMENTE JSON:
            {"pattern":null,"logoPlacement":null,"logoSize":null,"sides":[],"baseColors":[],"printColors":[],"anyColors":[]}
            pattern ∈ ALLOVER_LOGO (logo/monograma repetido em toda a peça), SINGLE_LOGO (um logo), STRIPES, PLAID, FLORAL,
            CAMO, TIE_DYE, COLOR_BLOCK, GRAPHIC (outra estampa), PLAIN (lisa) ou null.
            logoPlacement ∈ ALLOVER, CENTER_CHEST, LEFT_CHEST, BACK, SLEEVE ou null. logoSize ∈ LARGE, SMALL ou null.
            sides ⊆ [FRONT, BACK]. baseColors = cores da peça; printColors = cores do logo/estampa; anyColors = cores sem papel
            claro. Use só estes códigos de cor: %s.""";

    /** Fora da transação da busca: uma falha do provedor de IA não pode marcar a busca (só leitura) para rollback. */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public DesignTraits interpret(UUID userId, String text) {
        DesignTraits base = local.interpret(text);
        String key = CatalogNormalizer.key(text);
        if (key.split(" ").length < 4) {
            return base;
        }
        DesignTraits cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        DesignTraits refined = base;
        try {
            String system = SYSTEM.formatted(String.join(", ", colorCodes()));
            AiOutcome<DesignTraits> out = ai.text(new AiEngine.TextCall<>(userId, AiCapability.CATALOG_TEXT_INTERPRETER, system,
                    "Descrição da pessoa: " + text, List.of(), 400, List.of("texto da busca catalogada (sem dados pessoais)"),
                    this::parse, () -> null, null));
            if (out != null && out.value() != null && !out.fallbackUsed()) {
                DesignTraits fromAi = out.value();
                // as palavras usadas continuam as da leitura local (a IA não aponta palavras): a IA corrige os campos
                refined = base.merge(new DesignTraits(fromAi.pattern(), fromAi.logoPlacement(), fromAi.logoSize(), fromAi.sides(),
                        fromAi.baseColors(), fromAi.printColors(), fromAi.anyColors(), base.consumed(), "AI"), "AI");
            }
        } catch (RuntimeException ex) {
            refined = base;                                       // IA indisponível: vale a leitura local
        }
        cache.put(key, refined);
        return refined;
    }

    /** Resposta da IA → traços, aceitando só o vocabulário fechado. */
    DesignTraits parse(String text) {
        Map<String, Object> m = Json.map(text);
        if (m.isEmpty()) {
            return null;
        }
        JsonNode d = norm.design();
        Set<String> patterns = names(d.path("patterns")), placements = names(d.path("placements")), sizes = names(d.path("sizes"));
        Set<String> colors = new LinkedHashSet<>(colorCodes());
        String pattern = pick(m.get("pattern"), patterns), placement = pick(m.get("logoPlacement"), placements), size = pick(m.get("logoSize"), sizes);
        Set<String> sides = new LinkedHashSet<>();
        for (String s : strings(m.get("sides"))) {
            String up = s.toUpperCase(java.util.Locale.ROOT);
            if (up.equals("FRONT") || up.equals("BACK")) {
                sides.add(up);
            }
        }
        return new DesignTraits(pattern, placement, size, sides, keep(m.get("baseColors"), colors), keep(m.get("printColors"), colors),
                keep(m.get("anyColors"), colors), Set.of(), "AI");
    }

    private List<String> colorCodes() {
        List<String> out = new ArrayList<>();
        norm.design();                                            // garante o vocabulário carregado
        for (String c : br.com.fashionai.application.taxonomy.Taxonomy.COLORS.keySet()) {
            if (!"print".equals(c) && !"multicolor".equals(c)) {
                out.add(c);
            }
        }
        return out;
    }

    private static Set<String> names(JsonNode node) {
        Set<String> out = new LinkedHashSet<>();
        out.addAll(node.propertyNames());
        return out;
    }

    private static String pick(Object o, Set<String> allowed) {
        if (o == null) {
            return null;
        }
        String v = String.valueOf(o).trim().toUpperCase(java.util.Locale.ROOT);
        return allowed.contains(v) ? v : null;
    }

    private static List<String> strings(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            l.forEach(x -> {
                if (x != null) {
                    out.add(String.valueOf(x).trim());
                }
            });
        }
        return out;
    }

    private List<String> keep(Object o, Set<String> allowed) {
        List<String> out = new ArrayList<>();
        for (String s : strings(o)) {
            String code = allowed.contains(s) ? s : norm.colorExact(s);
            if (code != null && allowed.contains(code)) {
                out.add(code);
            }
        }
        return out;
    }
}
