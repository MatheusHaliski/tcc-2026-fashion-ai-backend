package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.atelierproject.AtelierProjectViews.Measurement;
import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.garmentdelivery.GarmentCompositionRules.BomMaterial;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** FashionAI Garment Delivery — regras puras: tipo de peça, composição, etiqueta de cuidados, tamanho, preço e plano. */
class GarmentDeliveryRulesTest {
    static Specification ficha(String family, String fabric, String colors, String pockets, String collar, List<Measurement> measures) {
        return new Specification(family, "Reta", fabric, colors, pockets, collar, null, null, null, null, null, null, null, null, measures);
    }

    static List<Measurement> medidas() {
        return List.of(new Measurement("Tórax", "Largura plana entre cavas", new BigDecimal("52")),
                new Measurement("Comprimento", "Do ombro à barra", new BigDecimal("70")));
    }

    @Test
    void familiaDaFichaViraSubcategoriaComLinhaDeProducao() {
        assertThat(GarmentFamilyRules.classify("Camiseta básica", null).subcategory()).isEqualTo("t_shirt");
        assertThat(GarmentFamilyRules.classify("Jaqueta jeans", null)).extracting(GarmentFamilyRules.Kind::subcategory, GarmentFamilyRules.Kind::line)
                .containsExactly("jacket", "ALF");
        assertThat(GarmentFamilyRules.classify("Calça jeans", null).subcategory()).isEqualTo("jeans");
        assertThat(GarmentFamilyRules.classify("Short-saia", null).subcategory()).isEqualTo("skort");
        assertThat(GarmentFamilyRules.classify("Vestido camiseta", null).category()).isEqualTo("full_body_piece");
        assertThat(GarmentFamilyRules.classify("Moletom com capuz", null).subcategory()).isEqualTo("hoodie");
        assertThat(GarmentFamilyRules.classify("Peça conceitual", "saia evasê").subcategory()).isEqualTo("skirt");
        assertThat(GarmentFamilyRules.classify("Objeto", "livre").subcategory()).isEqualTo("top");
    }

    @Test
    void primeiraCorCitadaViraCodigoDaPaleta() {
        assertThat(GarmentFamilyRules.color("Azul marinho com detalhes brancos")).isEqualTo("navy");
        assertThat(GarmentFamilyRules.color("Branco e preto")).isEqualTo("white");
        assertThat(GarmentFamilyRules.color("cor da estação")).isEqualTo("multicolor");
    }

    @Test
    void composicaoUsaPercentuaisExplicitosDepoisBomDepoisTecido() {
        assertThat(GarmentCompositionRules.compose("Malha 95% algodão, 5% elastano", List.of()).lines())
                .containsExactly(new CompositionLine("COTTON", 95), new CompositionLine("ELASTANE", 5));
        assertThat(GarmentCompositionRules.compose("Algodão 60% e poliéster 40%", List.of()).lines())
                .containsExactly(new CompositionLine("COTTON", 60), new CompositionLine("POLYESTER", 40));
        Composition bom = GarmentCompositionRules.compose("Linho lavado", List.of(new BomMaterial("Linho", new BigDecimal("1.5")),
                new BomMaterial("Viscose do forro", new BigDecimal("0.5"))));
        assertThat(bom.source()).isEqualTo("BOM");
        assertThat(bom.lines()).containsExactly(new CompositionLine("LINEN", 75), new CompositionLine("VISCOSE", 25));
        assertThat(GarmentCompositionRules.compose("Algodão com elastano", List.of()).lines())
                .containsExactly(new CompositionLine("COTTON", 97), new CompositionLine("ELASTANE", 3));
        assertThat(GarmentCompositionRules.compose("Lã batida", List.of()).lines()).containsExactly(new CompositionLine("WOOL", 100));
        assertThat(GarmentCompositionRules.compose("Tecido misterioso", List.of()).source()).isEqualTo("UNSPECIFIED");
    }

    @Test
    void etiquetaDeCuidadosSegueOPerfilMaisDelicadoEGravaOTipoDeLavagem() {
        Composition jeans = GarmentCompositionRules.compose("Jeans 98% algodão 2% elastano", List.of());
        CareLabel denim = GarmentCareRules.label(jeans, GarmentCompositionRules.materialCode("Jeans", jeans));
        assertThat(denim.profile()).isEqualTo("DENIM");
        assertThat(denim.washCode()).isEqualTo("MAQUINA_40");
        assertThat(denim.iron()).isEqualTo("IRON_LOW");
        assertThat(denim.tips()).contains("WASH_INSIDE_OUT");
        Composition silk = GarmentCompositionRules.compose("Cetim de seda", List.of());
        CareLabel fine = GarmentCareRules.label(silk, GarmentCompositionRules.materialCode("Cetim de seda", silk));
        assertThat(fine).extracting(CareLabel::profile, CareLabel::wash, CareLabel::tumble, CareLabel::washCode)
                .containsExactly("FINE", "HAND_30", "DO_NOT_TUMBLE", "LAVAR_A_MAO");
        Composition leather = GarmentCompositionRules.compose("Couro legítimo", List.of());
        assertThat(GarmentCareRules.label(leather, "LEATHER")).extracting(CareLabel::wash, CareLabel::dryClean, CareLabel::washCode)
                .containsExactly("DO_NOT_WASH", "PROFESSIONAL_ONLY", "NAO_LAVAR");
        Composition cotton = GarmentCompositionRules.compose("Algodão", List.of());
        assertThat(GarmentCareRules.label(cotton, "COTTON")).extracting(CareLabel::bleach, CareLabel::iron)
                .containsExactly("NON_CHLORINE", "IRON_HIGH");
        Composition unknown = GarmentCompositionRules.compose("?", List.of());
        assertThat(GarmentCareRules.label(unknown, "BLEND").washCode()).isEqualTo("LAVAR_A_MAO");
    }

    @Test
    void medidasSaoGraduadasComToleranciaEConferenciaDentroDaTolerancia() {
        List<String> letras = List.of("PP", "P", "M", "G", "GG", "XG");
        assertThat(GarmentSizeRules.base("letter", letras)).isEqualTo("M");
        List<Measure> g = GarmentSizeRules.graded(medidas(), letras, "M", "G");
        assertThat(g.getFirst().value()).isEqualByComparingTo("53.5");
        assertThat(g.getFirst().tolerance()).isEqualByComparingTo("1.5");
        assertThat(g.get(1).value()).isEqualByComparingTo("72.0");
        for (Measure m : GarmentSizeRules.checked(g, "FAI-2026-ABCDEF")) {
            assertThat(m.checked().subtract(m.value()).abs()).isLessThanOrEqualTo(m.tolerance());
        }
        assertThat(GarmentSizeRules.checked(g, "FAI-2026-ABCDEF")).isEqualTo(GarmentSizeRules.checked(g, "FAI-2026-ABCDEF"));
        assertThat(GarmentSizeRules.sizeCode("G")).isEqualTo("l");
        assertThat(GarmentSizeRules.sizeCode("40")).isEqualTo("br_40");
    }

    @Test
    void precoNaoDependeDoTamanhoEUsaFamiliaTecidoComplexidadeEFrete() {
        Specification simples = ficha("Camiseta", "Algodão", "Branco", null, null, medidas());
        Specification detalhada = ficha("Camiseta", "Algodão", "Branco", "Bolso", "Gola V", medidas());
        assertThat(GarmentPriceRules.complexity(simples)).isEqualTo("LOW");
        Price p = GarmentPriceRules.price("CAM", "COTTON", "LOW", new BigDecimal("14.90"));
        assertThat(p.garment()).isEqualByComparingTo("88.90");
        assertThat(p.total()).isEqualByComparingTo("103.80");
        assertThat(GarmentPriceRules.price("CAM", "SILK", "LOW", null).garment()).isEqualByComparingTo("142.90");
        assertThat(GarmentPriceRules.price("ALF", "LEATHER", "HIGH", null).garment()).isGreaterThan(p.garment());
        assertThat(GarmentPriceRules.complexity(detalhada)).isEqualTo("LOW");
        assertThat(CepRegions.of(CepRegions.digits("01310-100")).code()).isEqualTo("SP");
        assertThat(CepRegions.of("69000000").transitDays()).isEqualTo(5);
        assertThat(CepRegions.masked(CepRegions.prefix("01310100"))).isEqualTo("01310-***");
        assertThatThrownBy(() -> CepRegions.digits("123")).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_INVALID_CEP"));
    }

    @Test
    void planoDeDemonstracaoDuraTresMinutosECancelamentoSoAntesDoCorte() {
        Instant t0 = Instant.parse("2026-11-16T15:00:00Z");
        List<PlanStep> plan = FactoryPlanRules.plan(t0, "DEMO", "CAM", "COTTON", "LOW", 1);
        assertThat(plan).extracting(PlanStep::stage).containsExactlyElementsOf(FactoryPlanRules.STAGES);
        assertThat(plan.getLast().at()).isEqualTo(t0.plusSeconds(180));
        assertThat(FactoryPlanRules.stageAt(plan, t0.plusSeconds(20))).isEqualTo("PATTERN");
        assertThat(FactoryPlanRules.CANCELLABLE).contains("PATTERN").doesNotContain("CUTTING");
        assertThat(FactoryPlanRules.stageAt(plan, t0.plusSeconds(41))).isEqualTo("CUTTING");
        assertThat(FactoryPlanRules.status(plan, t0.plusSeconds(500), null, null)).isEqualTo("DELIVERED");
        assertThat(FactoryPlanRules.progress(plan, t0.plusSeconds(90), null, null)).isEqualTo(0.5);
    }

    @Test
    void planoPadraoUsaHorasUteisEPulaFimDeSemana() {
        ZoneId sp = FactoryPlanRules.FACTORY_ZONE;
        Instant sexta17h = ZonedDateTime.of(2026, 11, 13, 17, 0, 0, 0, sp).toInstant();
        assertThat(FactoryPlanRules.addWorkingHours(sexta17h, 3)).isEqualTo(ZonedDateTime.of(2026, 11, 16, 11, 0, 0, 0, sp).toInstant());
        List<PlanStep> plan = FactoryPlanRules.plan(sexta17h, "STANDARD", "ALF", "LEATHER", "HIGH", 5);
        for (int i = 1; i < plan.size(); i++) {
            assertThat(plan.get(i).at()).isAfter(plan.get(i - 1).at());
            assertThat(Set.of(6, 7)).doesNotContain(plan.get(i).at().atZone(sp).getDayOfWeek().getValue());
        }
        assertThat(plan.getLast().at()).isAfter(sexta17h.plusSeconds(14L * 86400));
    }

    @Test
    void identificadoresDaFabricaSeguemOFormato() {
        Instant t = Instant.parse("2026-11-16T15:00:00Z");
        assertThat(FactoryIdentifiers.serial(t)).matches("FAI-2026-[2-9A-HJ-NP-Z]{6}");
        assertThat(FactoryIdentifiers.lot(t, "MAL")).isEqualTo("L2026-47-MAL");
        assertThat(FactoryIdentifiers.tracking("FAI-2026-ABCDEF")).matches("FAI-TRK-[2-9A-Z]{4}-[2-9A-Z]{4}")
                .isEqualTo(FactoryIdentifiers.tracking("FAI-2026-ABCDEF"));
    }
}
