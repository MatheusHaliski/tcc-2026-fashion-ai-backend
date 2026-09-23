package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.TryOnLayer;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Peça posicionada no esquema (taxonomia §03 — SchemeItem): slot, transformação (zIndex, posição,
 * escala, rotação, opacidade) e filtros de imagem do pipeline RF5 (blur, saturation, brightness,
 * contrast, hue_shift) em filtersJson.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "scheme_items")
public class SchemeItem extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wardrobe_item_id", nullable = false)
    private WardrobeItem wardrobeItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SchemeSlot slot;

    @Enumerated(EnumType.STRING)
    @Column(name = "try_on_layer", length = 20)
    private TryOnLayer tryOnLayer;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "z_index", nullable = false)
    private int zIndex;

    @Column(name = "position_x", precision = 8, scale = 3)
    private BigDecimal positionX = BigDecimal.ZERO;

    @Column(name = "position_y", precision = 8, scale = 3)
    private BigDecimal positionY = BigDecimal.ZERO;

    @Column(name = "scale_factor", precision = 6, scale = 3)
    private BigDecimal scale = BigDecimal.ONE;

    @Column(name = "rotation_deg", precision = 7, scale = 2)
    private BigDecimal rotation = BigDecimal.ZERO;

    @Column(name = "opacity", precision = 4, scale = 3)
    private BigDecimal opacity = BigDecimal.ONE;

    @Column(name = "filters_json", columnDefinition = "json")
    private String filtersJson;

    /** Snapshot do nome/imagem no momento da publicação (RF7.CA03 — peça excluída depois). */
    @Column(name = "snapshot_json", columnDefinition = "json")
    private String snapshotJson;
}
