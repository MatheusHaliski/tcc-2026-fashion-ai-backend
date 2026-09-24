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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** FLAIR — extrato de coins; (motivo, referência) única por usuário: recompensa não paga duas vezes. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_coin_entries")
public class FlairCoinEntry extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private int delta;

    @Column(nullable = false, length = 60)
    private String reason;

    @Column(nullable = false, length = 80)
    private String ref;

}
