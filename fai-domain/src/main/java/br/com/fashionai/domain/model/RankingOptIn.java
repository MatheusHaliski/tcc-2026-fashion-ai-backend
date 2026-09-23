package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF34.CA08 — participação em rankings por opt-in (cidade só com consentimento explícito). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ranking_opt_ins")
public class RankingOptIn {
    @Id
    @Column(name = "user_id", length = 36)
    private UUID userId;

    @Column(name = "opted_in", nullable = false)
    private boolean optedIn;

    @Column(name = "share_city", nullable = false)
    private boolean shareCity;

    @Column(length = 80)
    private String city;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
