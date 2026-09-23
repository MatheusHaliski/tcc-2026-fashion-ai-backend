package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF35 — itens da loja adquiridos pelo usuário (compra com saldo ou recompensa). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "room_inventory")
public class RoomInventoryItem {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 40)
    private String sku;

    @Column
    private Integer serial;

    @Column(nullable = false, length = 20)
    private String source;

    @Column(name = "applied_module", length = 40)
    private String appliedModule;

    @Column(name = "acquired_at", nullable = false)
    private Instant acquiredAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
