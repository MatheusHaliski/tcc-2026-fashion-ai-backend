package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** DET-C07 / DET-M04 — Diário da Peça: cada uso com data, ocasião e nota (1× por dia). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "piece_usage_diary")
public class PieceUsageDiaryEntry {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "wardrobe_item_id", nullable = false, length = 36)
    private UUID wardrobeItemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "used_on", nullable = false)
    private LocalDate usedOn;

    @Column(length = 40)
    private String occasion;

    @Column(length = 160)
    private String note;

    @Column(nullable = false, length = 20)
    private String source;

    @Column(name = "scheme_id", length = 36)
    private UUID schemeId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
