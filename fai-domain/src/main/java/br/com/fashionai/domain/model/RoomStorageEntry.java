package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF32 §1.1 — endereço estável de cada peça no quarto (door:{n}/hanger:{n}, drawer:{n}, top:{n}, base:{n}, shoe:{n}, chair, basket). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "room_storage_map")
public class RoomStorageEntry extends AuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "wardrobe_item_id", nullable = false, length = 36, unique = true)
    private UUID wardrobeItemId;

    @Column(nullable = false, length = 40)
    private String address;

    @Column(name = "assigned_by", nullable = false, length = 10)
    private String assignedBy = "AUTO";
}
