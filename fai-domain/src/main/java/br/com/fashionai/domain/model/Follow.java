package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.FollowStatus;
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

import java.time.Instant;

/** Vínculo social (RF6/RF8/RF17/RF22): PENDENTE quando a conta alvo é privada, ACEITO quando aprovado. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "follows", uniqueConstraints = @UniqueConstraint(name = "uq_follows_pair", columnNames = {"follower_id", "following_id"}))
public class Follow extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "follower_id", nullable = false)
    private User follower;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "following_id", nullable = false)
    private User following;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FollowStatus status = FollowStatus.ACEITO;

    @Column(name = "responded_at")
    private Instant respondedAt;

    public Follow(User follower, User following, FollowStatus status) {
        this.follower = follower;
        this.following = following;
        this.status = status;
    }
}
