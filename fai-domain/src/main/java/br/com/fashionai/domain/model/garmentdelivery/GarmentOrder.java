package br.com.fashionai.domain.model.garmentdelivery;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * FashionAI Garment Delivery — encomenda de uma peça desenhada no Atelier à Fábrica FashionAI (fictícia). Congela a
 * revisão (snapshot e digest da ficha), a cotação (tipo, composição, cuidados, medidas, preço, designers) e o plano
 * da fábrica. Simulação: sem pagamento e sem endereço além do prefixo do CEP.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "garment_orders", uniqueConstraints = {
        @UniqueConstraint(name = "uq_garment_order_request", columnNames = {"owner_id", "request_id"}),
        @UniqueConstraint(name = "uq_garment_order_serial", columnNames = {"serial_number"})})
public class GarmentOrder extends VersionedAuditableEntity {
    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    /** Sem FK: a encomenda e o snapshot sobrevivem ao projeto (que pode ser arquivado ou apagado com a conta da autoria). */
    @Column(name = "project_id", nullable = false, length = 36)
    private UUID projectId;

    @Column(name = "revision_id", nullable = false, length = 36)
    private UUID revisionId;

    @Column(name = "revision_number", nullable = false)
    private int revisionNumber;

    @Column(name = "project_title", nullable = false, length = 160)
    private String projectTitle;

    /** SHA-256 da ficha como foi publicada na revisão. */
    @Column(name = "spec_digest", nullable = false, length = 64)
    private String specDigest;

    @Lob
    @Column(name = "spec_snapshot_json", nullable = false, columnDefinition = "LONGTEXT")
    private String specSnapshotJson;

    /** Cotação congelada: tipo de peça, composição, etiqueta de cuidados, medidas, preço e designers. */
    @Lob
    @Column(name = "quote_json", nullable = false, columnDefinition = "LONGTEXT")
    private String quoteJson;

    /** Plano da fábrica: etapa → instante previsto. */
    @Column(name = "plan_json", nullable = false, length = 4000)
    private String planJson;

    @Column(name = "size_label", nullable = false, length = 8)
    private String sizeLabel;

    /** STANDARD ou DEMO. */
    @Column(nullable = false, length = 12)
    private String speed;

    /** Só os 5 primeiros dígitos do CEP ficam guardados. */
    @Column(name = "cep_prefix", nullable = false, length = 5)
    private String cepPrefix;

    @Column(nullable = false, length = 8)
    private String region;

    @Column(name = "delivery_label", length = 40)
    private String deliveryLabel;

    @Column(name = "price_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceTotal;

    @Column(nullable = false, length = 3)
    private String currency = "BRL";

    @Column(name = "serial_number", nullable = false, length = 20)
    private String serialNumber;

    @Column(name = "lot_code", nullable = false, length = 24)
    private String lotCode;

    @Column(name = "tracking_code", nullable = false, length = 24)
    private String trackingCode;

    /** Índice para a varredura (PLACED … DELIVERED, RECEIVED, CANCELLED); a verdade é o plano mais o relógio. */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;

    @Column(name = "request_digest", nullable = false, length = 64)
    private String requestDigest;
}
