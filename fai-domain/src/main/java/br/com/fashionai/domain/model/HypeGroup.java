package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** HypeGroup (RF6 §8/§9) — itens semelhantes entre usuários (Sim ≥ 0,70) e média do Hype Score pessoal. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hype_groups")
public class HypeGroup extends VersionedAuditableEntity {
    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "signature_style", length = 80)
    private String signatureStyle;

    @Column(name = "signature_occasion", length = 80)
    private String signatureOccasion;

    @Column(name = "signature_brands_json", columnDefinition = "json")
    private String signatureBrandsJson;

    @Column(name = "signature_colors_json", columnDefinition = "json")
    private String signatureColorsJson;

    @Column(name = "signature_piece_types_json", columnDefinition = "json")
    private String signaturePieceTypesJson;

    @Column(name = "member_ids_json", columnDefinition = "json")
    private String memberIdsJson;

    @Column(name = "member_count", nullable = false)
    private int memberCount;

    @Column(name = "hype_score_global", precision = 6, scale = 2)
    private BigDecimal hypeScoreGlobal;

    @Column(name = "computed_at")
    private Instant computedAt;
}
