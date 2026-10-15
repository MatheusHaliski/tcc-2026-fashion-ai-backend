package br.com.fashionai.domain.model;

import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Physical item redemption; delivery data is encrypted and only exposed to the buyer and admins. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_orders")
public class PhysicalStoreOrder extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private PhysicalStoreListing listing;

    @Column(name = "buyer_user_id", nullable = false, length = 36)
    private UUID buyerUserId;

    @Column(name = "price_points", nullable = false)
    private int pricePoints;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "shipping_address_ciphertext", nullable = false, length = 4096)
    private String shippingAddress;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PROCESSING";

    @Column(name = "tracking_code", length = 120)
    private String trackingCode;

    @Column(name = "tracking_url", length = 1024)
    private String trackingUrl;

    @Column(name = "shipped_at")
    private Instant shippedAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;
}
