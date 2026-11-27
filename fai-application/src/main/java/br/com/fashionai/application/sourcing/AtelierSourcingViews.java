package br.com.fashionai.application.sourcing;

import br.com.fashionai.domain.model.sourcing.AtelierBomItem;
import br.com.fashionai.domain.model.sourcing.AtelierQuote;
import br.com.fashionai.domain.model.sourcing.AtelierQuoteRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Projeções de BOM, pedido de cotação e cotação. Preço só aparece para quem pode ver (CA2). */
public final class AtelierSourcingViews {
    private AtelierSourcingViews() {
    }

    public record BomItemCmd(java.util.UUID revisionId, String kind, String name, String unit, BigDecimal quantity, String notes, String requestId) { }
    public record QuoteRequestCmd(java.util.UUID revisionId, String supplierUsername, String currency, Map<String, Integer> sizes, String notes, String requestId) { }
    public record QuoteCmd(BigDecimal unitPrice, BigDecimal sampleCost, String currency, Integer leadTimeDays, LocalDate validUntil, String notes, String commandKey) { }
    public record AcceptCmd(long expectedVersion) { }

    static Map<String, Object> bomItem(AtelierBomItem b) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", b.getId());
        out.put("revisionId", b.getRevisionId());
        out.put("kind", b.getKind());
        out.put("name", b.getName());
        out.put("unit", b.getUnit());
        out.put("quantity", b.getQuantity());
        out.put("notes", b.getNotes());
        return out;
    }

    static Map<String, Object> request(AtelierQuoteRequest r, Map<String, Integer> sizes, boolean outdated, int revisionNumber,
                                       String supplierName, List<Map<String, Object>> quotes) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.getId());
        out.put("projectId", r.getProjectId());
        out.put("revisionId", r.getRevisionId());
        out.put("revisionNumber", revisionNumber);
        out.put("supplierId", r.getSupplierId());
        out.put("supplierName", supplierName);
        out.put("currency", r.getCurrency());
        out.put("sizes", sizes);
        out.put("totalUnits", sizes.values().stream().mapToInt(Integer::intValue).sum());
        out.put("notes", r.getNotes());
        out.put("status", r.getStatus());
        out.put("outdated", outdated);
        out.put("version", r.getVersion());
        out.put("createdAt", r.getCreatedAt());
        out.put("quotes", quotes);
        out.put("commitment", "NONE");
        return out;
    }

    static Map<String, Object> quote(AtelierQuote q, boolean showPrice, LocalDate today) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", q.getId());
        out.put("supplierId", q.getSupplierId());
        out.put("currency", q.getCurrency());
        if (showPrice) {
            out.put("unitPrice", q.getUnitPrice());
            out.put("sampleCost", q.getSampleCost());
        }
        out.put("leadTimeDays", q.getLeadTimeDays());
        out.put("validUntil", q.getValidUntil());
        out.put("expired", q.getValidUntil().isBefore(today));
        out.put("notes", q.getNotes());
        out.put("status", q.getStatus());
        out.put("acceptedBy", q.getAcceptedBy());
        out.put("acceptedAt", q.getAcceptedAt());
        out.put("acceptedRevisionId", q.getAcceptedRevisionId());
        out.put("acceptedProjectVersion", q.getAcceptedProjectVersion());
        out.put("version", q.getVersion());
        out.put("createdAt", q.getCreatedAt());
        return out;
    }
}
