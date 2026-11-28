package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "marketplace_negotiations")
@Getter
@Setter
public class MarketplaceNegotiation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private long version;

    @Column(name = "piece_id")
    private UUID pieceId;

    @Column(name = "store_id")
    private UUID storeId;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(name = "counterparty_user_id")
    private UUID counterpartyUserId;

    @Column(name = "proposed_by")
    private UUID proposedBy;

    private BigDecimal amount;
    private String currency;
    private String terms;
    private String status;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
