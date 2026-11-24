package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Visibility;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Dados recebidos no cadastro e na edição de peças. */
public record PieceForm(UUID draftId, boolean useDefaultImage, String name, String category, String subcategory,
                        String sex, UUID brandId, String brandName, String color, String material, String size,
                        String market, List<String> occasion, List<String> style, List<String> seals, BigDecimal price,
                        Visibility visibility, List<String> tags, String notes, ItemCondition condition,
                        LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                        Boolean forSale, Boolean studio, String brandLogoUrl, String brandSource, String brandRef,
                        Map<String, Object> background, UUID captureSessionId, String variation, Map<String, List<String>> attributes,
                        List<String> confirmed, UUID estadoConservacaoId, Boolean clearEstadoConservacao, UUID colecaoId, UUID intensidadeTermicaId,
                        UUID tipoLavagemId, Boolean clearTipoLavagem) {
    /** Ocasião e estilo chegam da tela como listas de códigos: espaços, maiúsculas e repetidos não derrubam o cadastro. */
    public PieceForm {
        occasion = Taxonomy.normalizeTags(occasion);
        style = Taxonomy.normalizeTags(style);
        variation = variation == null || variation.isBlank() ? null : variation.trim().toUpperCase(Locale.ROOT);
    }
}
