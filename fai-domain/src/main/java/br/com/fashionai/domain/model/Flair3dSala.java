package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * FLAIR 3D multiplayer (V133) — convite e sala de uma partida entre duas pessoas da rede FAI. Nasce CONVIDADO (com
 * prazo de aceite), vai a JOGANDO no aceite e a FECHADO com o resultado dos dois lados; RECUSADO, CANCELADO e EXPIRADO
 * encerram sem partida. O modo diz como se joga: ASSINCRONO (as duas partidas com a mesma semente e rodada, comparadas
 * no servidor), TURNOS (lance a lance, cada turno julgado no servidor; {@code turnosJson}) ou COOP (próximo passo).
 * {@code version} protege a sala de dois lances gravados ao mesmo tempo.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair3d_salas")
public class Flair3dSala {
    public static final String CONVIDADO = "CONVIDADO";
    public static final String JOGANDO = "JOGANDO";
    public static final String FECHADO = "FECHADO";
    public static final String RECUSADO = "RECUSADO";
    public static final String CANCELADO = "CANCELADO";
    public static final String EXPIRADO = "EXPIRADO";

    public static final String ASSINCRONO = "ASSINCRONO";
    public static final String TURNOS = "TURNOS";
    public static final String COOP = "COOP";

    @Id
    @Column(length = 36)
    private UUID id;

    /** Código do núcleo (BATALHA_LOOKS...) ou MAKE_UP. */
    @Column(nullable = false, length = 32)
    private String jogo;

    /** A rodada do núcleo ou o brief do MAKE UP (nula = o objetivo mais simples do jogo). */
    @Column(length = 48)
    private String rodada;

    @Column(nullable = false, length = 16)
    private String modo = ASSINCRONO;

    /** A semente das duas partidas: o mesmo sorteio para os dois lados. */
    @Column(nullable = false)
    private long semente;

    /** Quem convidou. */
    @Column(name = "de_user_id", nullable = false, length = 36)
    private UUID deUserId;

    /** Quem foi convidado. */
    @Column(name = "para_user_id", nullable = false, length = 36)
    private UUID paraUserId;

    @Column(nullable = false, length = 16)
    private String estado = CONVIDADO;

    /** Até quando o convite pode ser aceito. */
    @Column(nullable = false)
    private Instant prazo;

    /** A partida (flair3d_matches) ou o look do MAKE UP de cada lado, no modo ASSINCRONO. */
    @Column(name = "partida_de", length = 36)
    private UUID partidaDe;

    @Column(name = "partida_para", length = 36)
    private UUID partidaPara;

    /** As cartas que cada lado leva para a sala no modo TURNOS. */
    @Column(name = "deck_de_json", columnDefinition = "json")
    private String deckDeJson;

    @Column(name = "deck_para_json", columnDefinition = "json")
    private String deckParaJson;

    /** Os turnos: {turnos:[{turno, de, para, julgado}], vida...}; o lance de um lado só aparece depois do julgamento. */
    @Column(name = "turnos_json", columnDefinition = "json")
    private String turnosJson;

    /** O resultado dos dois lados: {de:{pontos, estrelas}, para:{...}, vencedor, motivo}. */
    @Column(name = "resultado_json", columnDefinition = "json")
    private String resultadoJson;

    /** Quem venceu (nulo no empate ou sem resultado). */
    @Column(name = "vencedor_user_id", length = 36)
    private UUID vencedorUserId;

    /** A sala de que esta é a revanche. */
    @Column(name = "revanche_de", length = 36)
    private UUID revancheDe;

    @Version
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** A pessoa está na sala (de um lado ou do outro)? */
    public boolean temParticipante(UUID userId) {
        return deUserId.equals(userId) || paraUserId.equals(userId);
    }

    /** O outro lado da sala para quem está nela. */
    public UUID outro(UUID userId) {
        return deUserId.equals(userId) ? paraUserId : deUserId;
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
