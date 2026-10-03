package br.com.fashionai.application.catalog;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.Json;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF47 · Catalog Discovery — procura o produto SOMENTE nas fontes oficiais cadastradas da marca (catalog_sources),
 * pela capacidade {@link AiCapability#CATALOG_DISCOVERY} do motor de IA (busca na web restrita aos domínios). Todo
 * resultado passa por {@link #accept}: URL do produto e da imagem precisam ser https e do domínio oficial — nada de
 * Pinterest, Instagram, blogs, fóruns ou marketplaces desconhecidos. Sem IA disponível, devolve vazio (nada inventado).
 * A busca não é licença de reuso: imagens entram como REFERENCE_ONLY salvo autorização explícita da fonte.
 */
@Component
public class OfficialCatalogDiscovery {
    private final AiEngine ai;

    public OfficialCatalogDiscovery(AiEngine ai) {
        this.ai = ai;
    }

    /** Candidato bruto vindo de uma fonte oficial. */
    public record Found(String productName, String modelName, String color, String productCode, String sku, String gtin,
                        String productUrl, String imageUrl, String collection, String material) {
    }

    static final String SYSTEM = """
            Você é o Catalog Discovery do FashionAI. Use a busca na web APENAS nos domínios oficiais informados para achar
            produtos de moda que correspondam à busca. Nunca use marketplaces, Pinterest, Instagram, blogs ou fóruns.
            Nunca invente URL, código ou foto: só use o que aparece nas páginas oficiais encontradas. Responda SOMENTE JSON:
            {"products":[{"productName":"","modelName":null,"color":null,"productCode":null,"sku":null,"gtin":null,
            "productUrl":"https://...","imageUrl":"https://...","collection":null,"material":null}]} com no máximo 8 itens.
            Sem resultado oficial: {"products":[]}.""";

    public List<Found> discover(UUID userId, String brandName, String subcategoryLabel, String query, List<String> officialDomains) {
        if (officialDomains == null || officialDomains.isEmpty()) {
            return List.of();
        }
        String prompt = "Marca: " + brandName + "\nTipo de peça: " + subcategoryLabel + "\nBusca da pessoa: " + (query == null ? "" : query)
                + "\nDomínios oficiais permitidos: " + String.join(", ", officialDomains);
        AiOutcome<List<Found>> out = ai.text(new AiEngine.TextCall<>(userId, AiCapability.CATALOG_DISCOVERY, SYSTEM, prompt,
                List.of(), 2500, List.of("marca, tipo e texto da busca (sem dados pessoais)"),
                text -> parse(text, officialDomains), List::of, null, true));
        return out.value() == null ? List.of() : out.value();
    }

    static List<Found> parse(String text, List<String> officialDomains) {
        Map<String, Object> m = Json.map(text);
        List<Found> out = new ArrayList<>();
        if (!(m.get("products") instanceof List<?> list)) {
            return m.isEmpty() ? null : out;
        }
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> p)) {
                continue;
            }
            Found f = new Found(s(p.get("productName")), s(p.get("modelName")), s(p.get("color")), s(p.get("productCode")),
                    s(p.get("sku")), s(p.get("gtin")), s(p.get("productUrl")), s(p.get("imageUrl")), s(p.get("collection")),
                    s(p.get("material")));
            if (accept(f, officialDomains)) {
                out.add(f);
            }
        }
        return out;
    }

    /** Só aceita produto com nome e URL https de um domínio oficial; imagem de outro domínio é descartada. */
    static boolean accept(Found f, List<String> officialDomains) {
        if (f.productName() == null || f.productName().isBlank() || f.productUrl() == null || !f.productUrl().startsWith("https://")) {
            return false;
        }
        String dom = CatalogNormalizer.domain(f.productUrl());
        return officialDomains.stream().anyMatch(d -> CatalogNormalizer.sameSite(dom, d));
    }

    /**
     * Imagem aceita se vier do próprio domínio oficial ou de um CDN da marca cujo nome contém o rótulo da marca
     * ("static.nike.com", "assets.adidas.com" para "nike.com.br" / "adidas.com").
     */
    static boolean imageAllowed(String imageUrl, List<String> officialDomains) {
        if (imageUrl == null || !imageUrl.startsWith("https://")) {
            return false;
        }
        String dom = CatalogNormalizer.domain(imageUrl);
        List<String> labels = List.of(dom.split("\\."));
        return officialDomains.stream().anyMatch(d -> CatalogNormalizer.sameSite(dom, d) || labels.contains(brandLabel(d)));
    }

    /** "nike.com.br" → "nike"; "lojas.renner.com.br" → "renner" (penúltimo rótulo antes do sufixo público). */
    static String brandLabel(String domain) {
        String[] parts = domain.toLowerCase(java.util.Locale.ROOT).split("\\.");
        int i = parts.length - 2;
        if (i > 0 && parts[i].length() <= 3 && parts[parts.length - 1].length() == 2) {
            i--; // .com.br, .co.uk
        }
        return i >= 0 ? parts[i] : domain;
    }

    private static String s(Object o) {
        return o == null || "null".equals(String.valueOf(o)) ? null : String.valueOf(o).trim();
    }
}
