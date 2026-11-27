package br.com.fashionai.application.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierProductionRequest;
import br.com.fashionai.domain.model.sourcing.AtelierSampleDeviation;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções do pedido de amostra/lote; a aprovação só vale enquanto a revisão congelada for a vigente. */
public final class AtelierProductionViews {
    private AtelierProductionViews() {
    }

    public record RequestCmd(UUID revisionId, String producerUsername, Map<String, String> tolerances, UUID quoteId, String requestId) { }
    public record VersionCmd(long expectedVersion) { }
    public record DeviationCmd(String measurementPoint, String expected, String measured) { }
    public record DecisionCmd(boolean accept, String justification) { }

    static Map<String, Object> request(AtelierProductionRequest r, int revisionNumber, boolean currentRevision, String producerName, String role,
                                       List<Map<String, Object>> bom, Map<String, String> tolerances, List<AtelierSampleDeviation> deviations) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.getId());
        out.put("projectId", r.getProjectId());
        out.put("revisionId", r.getRevisionId());
        out.put("revisionNumber", revisionNumber);
        out.put("producerId", r.getProducerId());
        out.put("producerName", producerName);
        out.put("quoteId", r.getQuoteId());
        out.put("status", r.getStatus());
        out.put("bomSnapshot", bom);
        out.put("tolerances", tolerances);
        out.put("deviations", deviations.stream().map(AtelierProductionViews::deviation).toList());
        out.put("pendingDeviations", deviations.stream().filter(d -> "PENDING".equals(d.getDecision())).count());
        out.put("approvedBy", r.getApprovedBy());
        out.put("approvedAt", r.getApprovedAt());
        out.put("approvedProjectVersion", r.getApprovedProjectVersion());
        boolean approved = "APPROVED".equals(r.getStatus());
        out.put("approvalValid", approved && currentRevision);
        out.put("invalidatedByRevision", approved && !currentRevision);
        out.put("currentRevision", currentRevision);
        out.put("socialInterest", "IGNORED");
        out.put("commitment", "NONE");
        out.put("role", role);
        out.put("version", r.getVersion());
        out.put("createdAt", r.getCreatedAt());
        return out;
    }

    static Map<String, Object> deviation(AtelierSampleDeviation d) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("measurementPoint", d.getMeasurementPoint());
        out.put("expected", d.getExpected());
        out.put("measured", d.getMeasured());
        out.put("decision", d.getDecision());
        out.put("justification", d.getJustification());
        out.put("decidedBy", d.getDecidedBy());
        out.put("decidedAt", d.getDecidedAt());
        out.put("createdAt", d.getCreatedAt());
        return out;
    }
}
