package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * RF53 · P1-10 — marco de Hype já alcançado por uma peça ou look (tabela {@code hype_milestones}). Serve de dedupe: cada
 * entidade notifica cada marco no máximo uma vez, então a oscilação na borda de uma faixa (o recálculo ao vivo roda a
 * cada 120 s) não vira uma avalanche de avisos. {@code digestDate} + {@code notificationId} agrupam os marcos do dia
 * num único resumo por dono. Só subida: queda nunca vira linha aqui.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "hype_milestones")
public class HypeMilestone {
    /** Marcos notificáveis. Os de faixa têm ordem: atingir Viral já cobre Em alta e Tendência (nunca avisa "de volta"). */
    public enum Kind {
        HOT(HypeLevel.HOT),
        TRENDING(HypeLevel.TRENDING),
        VIRAL(HypeLevel.VIRAL),
        /** momento EMERGING: crescimento acelerado a partir de uma base pequena (independe da faixa) */
        EMERGING(null);

        private final HypeLevel level;

        Kind(HypeLevel level) {
            this.level = level;
        }

        public HypeLevel level() {
            return level;
        }

        public boolean isLevel() {
            return level != null;
        }

        /** Marco de faixa correspondente (só Em alta, Tendência e Viral são marcos); nulo para as demais faixas. */
        public static Kind ofLevel(HypeLevel level) {
            if (level == null) {
                return null;
            }
            for (Kind k : values()) {
                if (k.level == level) {
                    return k;
                }
            }
            return null;
        }
    }

    @Id
    @Column(length = 36)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private UUID entityId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind milestone;

    /** faixa e momento no instante do marco (contexto do resumo e da exportação LGPD) */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private HypeLevel level;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private HypeMomentum momentum;

    @Column(precision = 6, scale = 2)
    private BigDecimal score;

    /** falso = item privado/só seguidores: Hype pessoal, o aviso foi só para o dono */
    @Column(name = "public_eligible", nullable = false)
    private boolean publicEligible;

    @Column(name = "algorithm_version", nullable = false, length = 20)
    private String algorithmVersion;

    @Column(name = "achieved_at", nullable = false)
    private Instant achievedAt;

    /** dia do resumo (America/Sao_Paulo): todos os marcos do dono nesse dia vão para a mesma notificação */
    @Column(name = "digest_date", nullable = false)
    private LocalDate digestDate;

    /** notificação de resumo do dia (nula se o dono não existe mais) */
    @Column(name = "notification_id", length = 36)
    private UUID notificationId;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
