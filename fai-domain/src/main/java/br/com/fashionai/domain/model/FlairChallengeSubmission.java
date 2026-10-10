package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Entrega de um Desafio de Montagem: retrato das cartas por vaga, leitura escolhida, sintonia e a história escrita carta
 * a carta (gravada como chaves e variáveis, para aparecer no idioma de quem lê). Nunca é apagada: é a memória do jogo.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_challenge_submissions")
public class FlairChallengeSubmission extends AuditableEntity {
    @Column(name = "challenge_id", nullable = false, length = 36)
    private UUID challengeId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false)
    private int attempt = 1;

    /** [{"slot":"calcadao","cardId":…,"name":…,"brandName":…,"tier":…,"ovr":…,"position":…,"imageUrl":…,"sintonia":2}]. */
    @Column(name = "cards_json", nullable = false, columnDefinition = "json")
    private String cardsJson;

    /** Chave da interpretação do Momento ou "own" ("Minha leitura"). */
    @Column(length = 40)
    private String interpretation;

    @Column(nullable = false)
    private int sintonia;

    @Column(name = "sintonia_max", nullable = false)
    private int sintoniaMax;

    @Column(name = "story_json", columnDefinition = "json")
    private String storyJson;

    @Column(nullable = false)
    private int points;

    @Column(name = "bonus_json", columnDefinition = "json")
    private String bonusJson;
}
