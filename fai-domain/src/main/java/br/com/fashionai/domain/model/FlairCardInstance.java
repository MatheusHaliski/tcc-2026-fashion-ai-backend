package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * FLAIR-UT · carta FLAIR (D11): uma CÓPIA da peça, gerada por um gesto da pessoa ("Converter para FLAIR"). A peça e o
 * card do guarda-roupa continuam onde estão; a carta guarda foto, nome, marca, nota, nível e números de Hype do dia da
 * geração. Uma carta por peça por temporada (D6, chave única). Converter nunca publica nada no feed.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_card_instance")
public class FlairCardInstance extends VersionedAuditableEntity {
    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    /** Quem gerou a carta (o "criada por"); nulo depois que a conta é excluída. */
    @Column(name = "creator_id", length = 36)
    private UUID creatorId;

    /** PIECE ou LOOK. */
    @Column(name = "origin_type", nullable = false, length = 10)
    private String originType;

    @Column(name = "origin_id", nullable = false, length = 36)
    private UUID originId;

    @Column(nullable = false, length = 20)
    private String season;

    /** BRONZE, PRATA, OURO ou ESPECIAL. */
    @Column(nullable = false, length = 10)
    private String tier;

    /** Nota FLAIR (OVR) de 45 a 99. */
    @Column(nullable = false)
    private int ovr;

    /** Acabamento "raro": vem do Hype público (raridade LIMITED ou RARE do motor), nunca do preço (RF53 · P2-18). */
    @Column(nullable = false)
    private boolean rare;

    /** SUP, INF, CAL, ACE, VES ou LOOK. */
    @Column(nullable = false, length = 4)
    private String position;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "brand_name", length = 120)
    private String brandName;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(length = 40)
    private String category;

    @Column(length = 80)
    private String subcategory;

    /** Números do Hype no dia da geração (as 7 dimensões + o score); vazio = sem Hype público ("—", nunca 0). */
    @Column(name = "hype_json", columnDefinition = "TEXT")
    private String hypeJson;

    /** Atributos de jogo (EDGE…SYNC), raridade e habilidade do motor de hoje: o verso da carta. */
    @Column(name = "stats_json", columnDefinition = "TEXT")
    private String statsJson;

    /** O que decidiu o nível (preço usado, marca, acabamento, se o preço foi confirmado). */
    @Column(name = "basis_json", columnDefinition = "TEXT")
    private String basisJson;

    @Column(name = "price_verified", nullable = false)
    private boolean priceVerified;

    /** AVAILABLE (pode jogar e entrar em desafio) ou LOCKED_CHALLENGE (entregue, D7). */
    @Column(nullable = false, length = 20)
    private String state = "AVAILABLE";

    @Column(nullable = false)
    private boolean tradeable = true;

    /** GENERATED, MARKET, REWARD, STORE_POINTS, STORE_MONEY ou SEAL. */
    @Column(name = "acquired_via", nullable = false, length = 20)
    private String acquiredVia = "GENERATED";

    /** Estilos, ocasiões, cor e material da peça no dia da geração (requisitos e sintonia dos Desafios de Montagem). */
    @Column(name = "tags_json", columnDefinition = "TEXT")
    private String tagsJson;

    /** Desafio de Montagem em que a carta foi entregue (D7): ela fica como memória, fora de jogo e de troca. */
    @Column(name = "locked_challenge_id", length = 36)
    private UUID lockedChallengeId;

    @Column(name = "locked_at")
    private Instant lockedAt;
}
