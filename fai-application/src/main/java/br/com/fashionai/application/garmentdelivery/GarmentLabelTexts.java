package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.CareLabel;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Composition;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Frozen;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Measure;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Textos gravados com a peça (cuidados, composição) e as notas da fábrica em cada evento do passaporte, no idioma de
 * quem confirma o recebimento. A tela sempre tem os códigos para mostrar os símbolos no idioma de quem lê.
 */
final class GarmentLabelTexts {
    private GarmentLabelTexts() {
    }

    /** "97% algodão, 3% elastano". */
    static String composition(Composition composition) {
        return composition.lines().stream().map(l -> l.percent() + "% " + Msg.t("garmentDelivery.fibra." + l.fiber()))
                .collect(Collectors.joining(", "));
    }

    /** As seis instruções da etiqueta numa linha (cabe nos 512 caracteres do cadastro da peça). */
    static String care(CareLabel care) {
        return Stream.of(care.wash(), care.bleach(), care.tumble(), care.iron(), care.dryClean(), care.naturalDry())
                .map(code -> Msg.t("garmentDelivery.cuidado." + code)).collect(Collectors.joining(" · "));
    }

    static String note(String stage, GarmentOrder order, Frozen frozen) {
        return switch (stage) {
            case "PLACED" -> Msg.t("garmentDelivery.nota.PLACED", order.getSerialNumber(), order.getRevisionNumber(), order.getLotCode());
            case "PATTERN" -> Msg.t("garmentDelivery.nota.PATTERN", order.getSizeLabel());
            case "CUTTING" -> Msg.t("garmentDelivery.nota.CUTTING", composition(frozen.composition()));
            case "FINISHING" -> Msg.t("garmentDelivery.nota.FINISHING", care(frozen.care()));
            case "QUALITY_CHECK" -> Msg.t("garmentDelivery.nota.QUALITY_CHECK", measures(frozen.measurements()));
            case "SHIPPED" -> Msg.t("garmentDelivery.nota.SHIPPED", order.getTrackingCode());
            default -> Msg.t("garmentDelivery.nota." + stage);
        };
    }

    /** "Tórax 56,5 cm (conferida 56,8 cm, ±1,5)". */
    static String measures(List<Measure> measures) {
        if (measures == null || measures.isEmpty()) {
            return Msg.t("garmentDelivery.nota.sem_medidas");
        }
        return measures.stream().map(m -> Msg.t("garmentDelivery.nota.medida", m.point(), number(m.value()),
                number(m.checked() == null ? m.value() : m.checked()), number(m.tolerance()))).collect(Collectors.joining("; "));
    }

    private static String number(BigDecimal value) {
        return String.format(Msg.locale(), "%.1f", value);
    }
}
