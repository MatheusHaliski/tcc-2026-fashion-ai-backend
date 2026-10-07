package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Look enviado a um Momento. Um look entra uma única vez por Momento (unique moment_id + scheme_id): reenviar o mesmo
 * look, ou criar/apagar looks em série, não gera pontos novos (§39). O MomentMatch e os pontos são congelados no envio
 * (match_json / points_json) para auditoria.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moment_submissions")
public class MomentSubmission extends AuditableEntity {
    @Column(name = "moment_id", nullable = false, length = 36)
    private UUID momentId;

    @Column(name = "participation_id", nullable = false, length = 36)
    private UUID participationId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "scheme_id", nullable = false, length = 36)
    private UUID schemeId;

    /** Desafio escolhido pela pessoa (opcional); os demais cumpridos ficam em points_json. */
    @Column(name = "challenge_id", length = 36)
    private UUID challengeId;

    @Column(name = "match_score")
    private Integer matchScore;

    @Column(name = "match_json", columnDefinition = "json")
    private String matchJson;

    @Column(name = "wardrobe_only", nullable = false)
    private boolean wardrobeOnly;

    @Column(name = "rediscovered_json", columnDefinition = "json")
    private String rediscoveredJson;

    @Column(name = "points_json", columnDefinition = "json")
    private String pointsJson;

    @Column(name = "points_earned", nullable = false)
    private int pointsEarned;

    /** Hype do look no instante do envio (contexto, nunca sobrescrito pelo Hype global). */
    @Column(name = "hype_at_submission")
    private Integer hypeAtSubmission;

    @Column(name = "vote_count", nullable = false)
    private int voteCount;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(nullable = false)
    private boolean withdrawn;
}
