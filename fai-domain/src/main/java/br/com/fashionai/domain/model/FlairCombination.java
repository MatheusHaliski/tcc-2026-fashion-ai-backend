package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** FLAIR — combinação definida pela loja (aba "Minhas combinações FLAIR" do perfil RF14/RF22) que completa um jogo e dá cupom. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_combinations")
public class FlairCombination extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_user_id", nullable = false)
    private User brand;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 600)
    private String description;

    @Column(name = "game_type", nullable = false, length = 30)
    private String gameType;

    @Column(name = "required_categories_json", columnDefinition = "json")
    private String requiredCategoriesJson;

    @Column(name = "required_styles_json", columnDefinition = "json")
    private String requiredStylesJson;

    @Column(name = "required_occasions_json", columnDefinition = "json")
    private String requiredOccasionsJson;

    @Column(name = "min_brand_pieces", nullable = false)
    private int minBrandPieces;

    @Column(name = "min_deck_power", nullable = false)
    private int minDeckPower;

    @Column(name = "min_rarity", length = 20)
    private String minRarity;

    @Column(name = "min_wins", nullable = false)
    private int minWins;

    @Column(name = "coupon_title", nullable = false, length = 120)
    private String couponTitle;

    @Column(name = "discount_percent")
    private Integer discountPercent;

    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "min_purchase", precision = 10, scale = 2)
    private BigDecimal minPurchase;

    @Column(name = "valid_days", nullable = false)
    private int validDays;

    private Integer stock;

    @Column(nullable = false)
    private int redeemed;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "accent_color", length = 20)
    private String accentColor;


    /** Link da loja terceira onde o cupom é usado (sobrepõe o site da marca). */
    @Column(name = "store_url", length = 512)
    private String storeUrl;
}
