package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF34 §3.3 — histórico de transições disponível/indisponível (população de exposição da Utilização). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "wardrobe_availability_log")
public class WardrobeAvailabilityChange {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "wardrobe_item_id", nullable = false, length = 36)
    private UUID wardrobeItemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false)
    private boolean available;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
