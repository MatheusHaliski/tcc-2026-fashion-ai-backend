package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.MomentApproach;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Participação de uma pessoa num Momento (§37): uma linha por (momento, usuário). Guarda a trajetória — salvou,
 * entrou, enviou, concluiu, saiu — e o resultado (pontos, score, ranking, badge). Nunca é apagada quando o Momento
 * termina: alimenta o Perfil → Momentos, as Memórias do grupo e o FashionAI Replay.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moment_participations")
public class MomentParticipation extends AuditableEntity {
    @Column(name = "moment_id", nullable = false, length = 36)
    private UUID momentId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MomentParticipationStatus status = MomentParticipationStatus.INTERESTED;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MomentApproach approach;

    /** "Somente meu guarda-roupa" escolhido ao participar (§58). */
    @Column(name = "wardrobe_only", nullable = false)
    private boolean wardrobeOnly;

    /** §46 — "Lembrar-me": aviso quando o Momento começar. */
    @Column(nullable = false)
    private boolean remind;

    /** Look preparado antes do início (§46). */
    @Column(name = "prepared_scheme_id", length = 36)
    private UUID preparedSchemeId;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "points_earned", nullable = false)
    private int pointsEarned;

    /** Melhor MomentMatch entre os looks enviados (0–100). */
    @Column(name = "best_match")
    private Integer bestMatch;

    @Column
    private Integer ranking;

    /** Percentil ("Top 10%") calculado ao encerrar. */
    @Column
    private Integer percentile;

    @Column(name = "badge_code", length = 40)
    private String badgeCode;

    /** §41 — a pessoa controla se esta participação aparece no perfil público. */
    @Column(name = "public_on_profile", nullable = false)
    private boolean publicOnProfile = true;

    /** Contador de reentradas (anti-farming §39: entrar/sair repetidamente não repõe bônus). */
    @Column(name = "join_count", nullable = false)
    private int joinCount;

    /** Dedupe das notificações (§44): um aviso por Momento por motivo. */
    @Column(name = "remind_sent", nullable = false)
    private boolean remindSent;

    @Column(name = "deadline_notified", nullable = false)
    private boolean deadlineNotified;
}
