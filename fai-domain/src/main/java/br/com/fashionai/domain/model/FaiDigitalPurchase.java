package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "fai_digital_purchases")
@Getter
@Setter
public class FaiDigitalPurchase {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_id")
    private UUID ownerId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offer_code")
    private FaiDigitalOffer offer;

    @Column(name = "piece_id")
    private UUID pieceId;

    private int points;

    @Column(name = "purchased_at")
    private Instant purchasedAt;
}
