package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;
import br.com.fashionai.application.atelierproject.TechPackCompleteness;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.garmentdelivery.GarmentCompositionRules.BomMaterial;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Compõe as regras puras numa cotação: tipo de peça, grade de tamanhos (SizeOptionsService), composição, etiqueta de
 * cuidados, medidas graduadas, preço, entrega e plano da fábrica. Não grava nada; a encomenda congela o resultado.
 */
final class GarmentQuoter {
    /** Revisão já autorizada e lida: ficha decodificada, JSON publicado (para o digest), BOM e créditos. */
    record Source(UUID projectId, UUID revisionId, int revisionNumber, String title, String specJson, Specification spec,
                  List<BomMaterial> bom, List<Designer> designers) {
    }

    /** Cotação mais o que a encomenda congela (com o apelido da entrega) e o plano. */
    record Result(Quote quote, Frozen frozen) {
    }

    private final SizeOptionsService sizes;
    private final AssetCatalogService assets;

    GarmentQuoter(SizeOptionsService sizes, AssetCatalogService assets) {
        this.sizes = sizes;
        this.assets = assets;
    }

    Result quote(Source source, String size, String cep, String deliveryLabel, String speed, Instant now) {
        Specification spec = source.spec();
        List<String> missing = TechPackCompleteness.missing(spec);
        GarmentFamilyRules.Kind kind = GarmentFamilyRules.classify(spec.family(), spec.modeling());
        Composition composition = GarmentCompositionRules.compose(spec.fabric(), source.bom());
        String material = GarmentCompositionRules.materialCode(spec.fabric(), composition);
        String color = GarmentFamilyRules.color(spec.colors());
        Garment garment = new Garment(spec.family(), kind.category(), kind.subcategory(), kind.line(), material, color,
                Taxonomy.hex(color), assets.defaultPieceImage(kind.category(), kind.subcategory()));
        SizeChoice choice = sizeChoice(kind, size);
        List<Measure> measurements = GarmentSizeRules.graded(spec.measurements(), choice.labels(), choice.base(), choice.selected());
        String digits = CepRegions.digits(cep);
        CepRegions.Region region = digits == null ? null : CepRegions.of(digits);
        Delivery delivery = region == null ? null
                : new Delivery(CepRegions.masked(CepRegions.prefix(digits)), region.code(), region.transitDays(), label(deliveryLabel));
        String complexity = GarmentPriceRules.complexity(spec);
        Price price = GarmentPriceRules.price(kind.line(), material, complexity, region == null ? null : region.shipping());
        String pace = speed(speed);
        List<PlanStep> plan = FactoryPlanRules.plan(now, pace, kind.line(), material, complexity, region == null ? 2 : region.transitDays());
        CareLabel care = GarmentCareRules.label(composition, material);
        Quote quote = new Quote(source.projectId(), source.revisionId(), source.revisionNumber(), source.title(),
                FactoryIdentifiers.digest(source.specJson()), missing.isEmpty(), missing, garment, choice, composition, care,
                measurements, price, delivery, pace, plan, plan.getLast().at(), source.designers(), FactoryIdentifiers.FACTORY_CODE,
                "SIMULATION_NO_CHARGE_NO_PHYSICAL_SHIPMENT");
        return new Result(quote, new Frozen(garment, composition, care, measurements, choice, price, delivery, source.designers()));
    }

    @SuppressWarnings("unchecked")
    private SizeChoice sizeChoice(GarmentFamilyRules.Kind kind, String size) {
        Map<String, Object> grid = sizes.forTaxonomy(kind.category(), kind.subcategory());
        List<String> labels = ((List<Map<String, Object>>) grid.get("sizes")).stream().map(row -> String.valueOf(row.get("label"))).toList();
        String base = GarmentSizeRules.base((String) grid.get("grid"), labels);
        String selected = size == null || size.isBlank() ? base : size.trim().toUpperCase(java.util.Locale.ROOT);
        if (!labels.contains(selected)) {
            throw ApiException.badRequest("GARMENT_ORDER_INVALID_SIZE", Msg.t("garmentDelivery.erro.tamanho_invalido"));
        }
        return new SizeChoice((String) grid.get("grid"), labels, base, selected);
    }

    static String speed(String speed) {
        if (speed == null || speed.isBlank()) {
            return FactoryPlanRules.STANDARD;
        }
        if (!FactoryPlanRules.STANDARD.equals(speed) && !FactoryPlanRules.DEMO.equals(speed)) {
            throw ApiException.badRequest("GARMENT_ORDER_INVALID_SPEED", Msg.t("garmentDelivery.erro.velocidade_invalida"));
        }
        return speed;
    }

    /** Apelido da entrega ("Casa"): texto curto, sem quebras; vazio vira nulo. */
    static String label(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String clean = value.strip().replaceAll("\\s+", " ");
        if (clean.length() > 40 || clean.codePoints().anyMatch(Character::isISOControl)) {
            throw ApiException.badRequest("GARMENT_ORDER_INVALID_LABEL", Msg.t("garmentDelivery.erro.apelido_invalido"));
        }
        return clean;
    }
}
