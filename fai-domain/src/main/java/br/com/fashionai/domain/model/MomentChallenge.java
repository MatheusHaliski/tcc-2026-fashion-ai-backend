package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Desafio dentro de um Momento (§12): "Dark Minimal +15", "No-Buy Halloween +40"… Cada desafio tem tags próprias para
 * o MomentMatch e parâmetros (params_json: looksRequired, idleDays, pieceId…) para os tipos NO_BUY, REDISCOVERY e
 * ONE_PIECE_MANY_LOOKS. Um look pode cumprir vários desafios; os pontos de cada um pagam uma vez (ledger idempotente).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moment_challenges")
public class MomentChallenge extends AuditableEntity {
    @Column(name = "moment_id", nullable = false, length = 36)
    private UUID momentId;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "names_json", columnDefinition = "json")
    private String namesJson;

    @Column(length = 500)
    private String description;

    @Column(name = "descriptions_json", columnDefinition = "json")
    private String descriptionsJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private MomentChallengeKind kind = MomentChallengeKind.STYLE;

    @Column(nullable = false)
    private int points = 15;

    @Column(name = "style_tags", length = 300)
    private String styleTags;

    @Column(name = "color_tags", length = 300)
    private String colorTags;

    @Column(name = "occasion_tags", length = 300)
    private String occasionTags;

    @Column(name = "params_json", columnDefinition = "json")
    private String paramsJson;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active = true;
}
