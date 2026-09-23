package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF35 §5.4 — Molde + Acabamento = SKU da loja do quarto. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "room_catalog")
public class RoomCatalogItem {
    @Id
    @Column(length = 40)
    private String sku;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "mold_id", nullable = false, length = 40)
    private String moldId;

    @Column(name = "slot_type", nullable = false, length = 30)
    private String slotType;

    @Column(name = "width_cm", nullable = false)
    private int widthCm;

    @Column(name = "finish_json", columnDefinition = "json")
    private String finishJson;

    @Column(nullable = false, length = 20)
    private String rarity;

    @Column(name = "price_points", nullable = false)
    private int pricePoints;

    @Column(name = "required_level", nullable = false, length = 20)
    private String requiredLevel;

    @Column(name = "stock_limit")
    private Integer stockLimit;

    @Column(name = "sold_count", nullable = false)
    private int soldCount;

    @Column(name = "maison_brand_user_id", length = 36)
    private UUID maisonBrandUserId;

    @Column(nullable = false)
    private boolean active = true;
}
