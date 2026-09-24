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

import java.time.Instant;
import java.util.UUID;

/** FLAIR — troféu exibido no perfil (FLAIR Runway Winner, campeão da liga, território conquistado…). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_trophies")
public class FlairTrophy extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private String mode;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(name = "season_key", nullable = false, length = 20)
    private String seasonKey;

    @Column(name = "detail_json", columnDefinition = "json")
    private String detailJson;
}
