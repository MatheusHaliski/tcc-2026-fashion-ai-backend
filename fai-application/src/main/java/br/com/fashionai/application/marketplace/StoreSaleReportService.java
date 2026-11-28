package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.PhysicalStore;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.MarketplaceNegotiationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional
public class StoreSaleReportService {
    private final EntityManager entities;
    private final MarketplaceNegotiationRepository offers;
    private final Guard guard;

    public StoreSaleReportService(EntityManager entities, MarketplaceNegotiationRepository offers, Guard guard) {
        this.entities = entities;
        this.offers = offers;
        this.guard = guard;
    }

    public void record(CurrentUser viewer, UUID storeId, UUID pieceId, String reference, Long pointsReceived) {
        guard.requireCanCreate(viewer);
        if (reference == null || reference.isBlank() || reference.length() > 100) {
            throw ApiException.badRequest("SALE_REFERENCE_REQUIRED", "Informe uma referência de venda de até 100 caracteres.");
        }
        validateRevenue(pointsReceived);
        PhysicalStore store = entities.find(PhysicalStore.class, storeId, LockModeType.PESSIMISTIC_WRITE);
        if (store == null) throw ApiException.notFound("Loja física");
        requireStoreOwner(viewer, store);
        WardrobeItem piece = entities.find(WardrobeItem.class, pieceId, LockModeType.PESSIMISTIC_WRITE);
        if (piece == null) throw ApiException.notFound("Peça");
        boolean previousReport = !entities.createNativeQuery("""
                SELECT 1 FROM marketplace_sale_reports WHERE store_id = :store AND reference_hash = SHA2(:reference, 256)
                """).setParameter("store", storeId.toString()).setParameter("reference", reference.strip()).getResultList().isEmpty();
        if (previousReport) return;
        boolean assigned = viewer.id().equals(piece.getUser().getId()) && storeId.equals(piece.getPhysicalStoreItemId());
        boolean negotiated = piece.getNegotiationId() != null && offers.findById(piece.getNegotiationId())
                .filter(offer -> offer.getStoreId().equals(storeId) && offer.getPieceId().equals(pieceId)
                        && "ACCEPTED".equals(offer.getStatus()) && offer.getExpiresAt().isAfter(Instant.now())).isPresent();
        if (!assigned && !negotiated) {
            throw ApiException.badRequest("SALE_OUTSIDE_STOREFRONT", "A peça precisa estar na vitrine da loja ou em negociação vigente.");
        }
        entities.createNativeQuery("""
                INSERT INTO marketplace_sale_reports (id, store_id, piece_id, reported_at, reference_hash, points_received)
                VALUES (:id, :store, :piece, UTC_TIMESTAMP(6), SHA2(:reference, 256), :points)
                """).setParameter("id", UUID.randomUUID().toString()).setParameter("store", storeId.toString())
                .setParameter("piece", pieceId.toString()).setParameter("reference", reference.strip())
                .setParameter("points", pointsReceived).executeUpdate();
        piece.setSalesCount((piece.getSalesCount() == null ? 0 : piece.getSalesCount()) + 1);
    }

    @Transactional(readOnly = true)
    public SaleSummary summary(CurrentUser viewer, UUID storeId, Instant start, Instant end) {
        guard.requireSession(viewer);
        var store = entities.find(PhysicalStore.class, storeId);
        if (store == null) throw ApiException.notFound("Loja física");
        requireStoreOwner(viewer, store);
        Instant upper = end == null ? Instant.now() : end;
        Instant lower = start == null ? upper.minus(java.time.Duration.ofDays(30)) : start;
        if (!lower.isBefore(upper)) throw ApiException.badRequest("INVALID_SALE_PERIOD", "Informe um período válido.");
        Object[] result = (Object[]) entities.createNativeQuery("""
                SELECT COUNT(*), COUNT(points_received), COALESCE(SUM(points_received), 0)
                  FROM marketplace_sale_reports
                 WHERE store_id = :store AND reported_at >= :start AND reported_at < :end
                """).setParameter("store", storeId.toString()).setParameter("start", lower).setParameter("end", upper)
                .getSingleResult();
        return new SaleSummary(((Number) result[0]).longValue(), ((Number) result[1]).longValue(),
                ((Number) result[2]).longValue(), lower, upper);
    }

    private static void validateRevenue(Long points) {
        if (points != null && (points < 0 || points > 10_000_000_000L)) {
            throw ApiException.badRequest("INVALID_REVENUE", "Informe o valor recebido em FAI Points.");
        }
    }

    private static void requireStoreOwner(CurrentUser viewer, PhysicalStore store) {
        var brand = store.getBrand().getBrandProfile();
        if (brand == null || !viewer.id().equals(brand.getOwner().getId()) || !brand.getOwner().isVerified()
                || brand.getApprovalStatus() != ApprovalStatus.APROVADO || viewer.status() != AccountStatus.ACTIVE) {
            throw ApiException.forbidden("Somente a marca verificada da loja pode acessar o relatório.");
        }
    }

    public record SaleSummary(long salesCount, long pricedSalesCount, long pointsReceived, Instant start, Instant end) {}
}
