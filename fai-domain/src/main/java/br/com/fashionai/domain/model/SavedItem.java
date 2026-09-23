package br.com.fashionai.domain.model;

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

import java.time.Instant;
import java.util.UUID;

/**
 * SavedItem (taxonomia §social) — botão "Adicionar ao guarda-roupa" (RF19): bookmark de peça/esquema
 * público de terceiro, alimenta "Looks Salvos"/"Peças Salvas" (RF6). Nunca clona o item.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "saved_items", uniqueConstraints = @UniqueConstraint(name = "uq_saved_items", columnNames = {"user_id", "target_type", "target_id"}))
public class SavedItem extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 36)
    private UUID targetId;

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt = Instant.now();

    public SavedItem(User user, TargetType targetType, UUID targetId) {
        this.user = user;
        this.targetType = targetType;
        this.targetId = targetId;
    }

    /** RF6.CA12 — favoritar um look salvo de terceiro. */
    @Column(nullable = false)
    private boolean favorite;
}
