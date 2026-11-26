package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

/** Exercício 16 — chave de cbc_preferences: uma preferência por pessoa e desafio. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Embeddable
public class CbcPreferenceId implements Serializable {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "challenge_id", nullable = false, length = 36)
    private UUID challengeId;
}
