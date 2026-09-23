package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
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

import java.time.Instant;

/** AcervoGroup (RF6 — Acervo Grouping AI): cluster local do acervo de UM usuário, nunca cruza donos (RNF6). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_groups")
public class AcervoGroup extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(name = "member_ids_json", columnDefinition = "json")
    private String memberIdsJson;

    @Column(name = "centroid_json", columnDefinition = "json")
    private String centroidJson;

    @Column(name = "member_count", nullable = false)
    private int memberCount;

    @Column(name = "computed_at")
    private Instant computedAt;
}
