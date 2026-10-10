package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.FlairChallengeDifficulty;
import br.com.fashionai.domain.model.enums.FlairChallengeStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * FLAIR-UT §7 e §14 — Desafio de Montagem (Card Building Challenge): um cenário FashionAI com vagas que a pessoa
 * preenche com as próprias cartas FLAIR. É DADO, não página: o mesmo cenário serve ao Halloween de 2026 e ao de 2027.
 *
 * <p>Tempo (Lipovetsky, o efêmero — §14.2 E1–E3): ligado a um Momento, a janela é a do Momento; sem Momento, vale a
 * janela própria ({@code startAt}/{@code endAt}, nulos = sempre aberto). Encerrado, vira Memória e nunca reabre.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_challenges")
public class FlairChallenge extends VersionedAuditableEntity {
    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "names_json", columnDefinition = "json")
    private String namesJson;

    @Column(length = 600)
    private String description;

    @Column(name = "descriptions_json", columnDefinition = "json")
    private String descriptionsJson;

    /** Cenário ilustrado (arte e textos das vagas no app): ipanema, gala, halloween… ou "livre" (textos nas vagas). */
    @Column(nullable = false, length = 40)
    private String scenario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private FlairChallengeDifficulty difficulty = FlairChallengeDifficulty.EASY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private FlairChallengeStatus status = FlairChallengeStatus.ACTIVE;

    /** Momento dono da janela, do tema e das interpretações; nulo = desafio "sempre" (ou com janela própria). */
    @Column(name = "moment_id", length = 36)
    private UUID momentId;

    @Column(name = "start_at")
    private Instant startAt;

    @Column(name = "end_at")
    private Instant endAt;

    /** Vagas: [{"key":"calcadao","position":"CAL"}] (+ "label"/"story" por idioma no cenário livre). */
    @Column(name = "slots_json", nullable = false, columnDefinition = "json")
    private String slotsJson;

    /** Requisitos (FLAIR-UT §14.5), validados no servidor: [{"type":"tier","only":"BRONZE"}…]. */
    @Column(name = "requirements_json", columnDefinition = "json")
    private String requirementsJson;

    /** Estilos e cores do próprio desafio, somados ao tema do Momento na sintonia. */
    @Column(name = "theme_tags", length = 300)
    private String themeTags;

    @Column(nullable = false)
    private int points;

    /** Entregas por pessoa: 1 = avulso; mais = repetível com limite. */
    @Column(name = "repeat_limit", nullable = false)
    private int repeatLimit = 1;

    @Column(name = "group_code", length = 40)
    private String groupCode;

    /** D7: as cartas entregues ficam bloqueadas como memória ("Entregue em ‹desafio›"). */
    @Column(name = "locks_cards", nullable = false)
    private boolean locksCards = true;

    @Column(nullable = false)
    private boolean official = true;

    @Column(name = "created_by_user_id", length = 36)
    private UUID createdByUserId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
