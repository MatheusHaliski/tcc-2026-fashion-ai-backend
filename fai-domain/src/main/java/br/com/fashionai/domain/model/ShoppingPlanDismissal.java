package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** RF-PESQ-09 — "já possuo" ou "não preciso" para um produto do catálogo; recalcular não sugere a mesma compra. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "shopping_plan_dismissals", uniqueConstraints = @UniqueConstraint(name = "uq_shopping_dismissal", columnNames = {"user_id", "product_id"}))
public class ShoppingPlanDismissal extends AuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "product_id", nullable = false, length = 36)
    private UUID productId;

    /** OWNED ou NOT_NEEDED. */
    @Column(nullable = false, length = 12)
    private String kind;
}
