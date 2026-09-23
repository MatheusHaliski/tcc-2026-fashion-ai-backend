package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.TargetType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** RF19.CA01-CA03/CA18 — curtida e reações qualitativas (trend/elegante/criativo), uma por tipo e usuário. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "reactions", uniqueConstraints = @UniqueConstraint(name = "uq_reactions_actor_target",
        columnNames = {"actor_user_id", "target_type", "target_id", "reaction_type"}))
public class Reaction extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 36)
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reaction_type", nullable = false, length = 30)
    private ReactionType reactionType;

    public Reaction(User actor, TargetType targetType, UUID targetId, ReactionType reactionType) {
        this.actor = actor;
        this.targetType = targetType;
        this.targetId = targetId;
        this.reactionType = reactionType;
    }
}
