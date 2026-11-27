package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

/** RF-PESQ-10 — evento consentido de interesse/indisponibilidade; nunca guarda o id do usuário, só um HMAC. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "retail_demand_events", uniqueConstraints = @UniqueConstraint(name = "uq_demand_daily", columnNames = {"contributor_hash", "product_id", "kind", "bucket_day"}))
public class RetailDemandEvent extends AuditableEntity {
    @Column(name = "brand_id", nullable = false, length = 36)
    private UUID brandId;

    @Column(name = "product_id", nullable = false, length = 36)
    private UUID productId;

    @Column(name = "variant_id", length = 36)
    private UUID variantId;

    @Column(name = "color_name", length = 120)
    private String colorName;

    @Column(name = "size_label", length = 40)
    private String sizeLabel;

    /** INTEREST, UNAVAILABLE (quis e não havia), SIZE_MISMATCH (devolução por caimento, com consentimento). */
    @Column(nullable = false, length = 16)
    private String kind;

    @Column(name = "bucket_day", nullable = false)
    private LocalDate bucketDay;

    @Column(name = "contributor_hash", nullable = false, length = 64)
    private String contributorHash;

    @Column(name = "consent_version", nullable = false, length = 20)
    private String consentVersion;
}
