package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Frozen;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Registro de fabricação gravado no passaporte (garment_passports.manufacturing_json): série, lote, fábrica, revisão de
 * origem com o digest da ficha, designers (só ids e papéis; o nome é lido na hora), tamanho, medidas conferidas,
 * composição, etiqueta de cuidados, datas das etapas e rastreio. O passaporte filtra o que vai para o link público.
 */
final class GarmentPassportRecord {
    private GarmentPassportRecord() {
    }

    static String json(GarmentOrder order, Frozen frozen, List<GarmentOrderEvent> stages, Instant receivedAt) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("factoryCode", FactoryIdentifiers.FACTORY_CODE);
        out.put("serialNumber", order.getSerialNumber());
        out.put("lotCode", order.getLotCode());
        out.put("trackingCode", order.getTrackingCode());
        out.put("orderId", order.getId());
        out.put("projectId", order.getProjectId());
        out.put("revisionId", order.getRevisionId());
        out.put("revisionNumber", order.getRevisionNumber());
        out.put("projectTitle", order.getProjectTitle());
        out.put("specDigest", order.getSpecDigest());
        out.put("designers", frozen.designers().stream().map(d -> Map.of("userId", d.userId().toString(), "role", d.role())).toList());
        out.put("sizeLabel", order.getSizeLabel());
        out.put("sizeGrid", frozen.sizes().grid());
        out.put("measurements", frozen.measurements());
        out.put("composition", frozen.composition().lines());
        out.put("care", frozen.care());
        out.put("stages", stages.stream().map(e -> Map.of("stage", e.getStage(), "at", e.getOccurredAt())).toList());
        out.put("producedAt", stages.stream().filter(e -> "QUALITY_CHECK".equals(e.getStage())).map(GarmentOrderEvent::getOccurredAt)
                .findFirst().orElse(null));
        out.put("receivedAt", receivedAt);
        out.put("speed", order.getSpeed());
        return Json.write(out);
    }
}
