package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Seal (taxonomia §07, RF14/RF25) — selo de marca ou celebridade. O visual (têxtil/dourado vs.
 * vítreo/holográfico) deriva de owner.profileType; a janela de disponibilidade e o limite de uso
 * atendem RNF12. A arte de fundo do selo (RF25) fica em backgroundConfigJson.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "seals")
public class Seal extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SealTier tier = SealTier.LOOK;

    @Column(name = "policy_text", length = 2048)
    private String policyText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SealStatus status = SealStatus.ACTIVE;

    @Column(name = "icon_url", length = 1024)
    private String iconUrl;

    @Column(nullable = false)
    private boolean premium;

    @Column(name = "background_config_json", columnDefinition = "json")
    private String backgroundConfigJson;

    @Column(name = "available_from")
    private Instant availableFrom;

    @Column(name = "available_until")
    private Instant availableUntil;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "usage_count", nullable = false)
    private int usageCount;

    /** Selo emitido automaticamente por um vínculo (não criado no editor do RF25). */
    @Column(name = "auto_issued", nullable = false)
    private boolean autoIssued;

    public boolean isAvailableAt(Instant now) {
        if (status != SealStatus.ACTIVE) {
            return false;
        }
        if (availableFrom != null && now.isBefore(availableFrom)) {
            return false;
        }
        if (availableUntil != null && now.isAfter(availableUntil)) {
            return false;
        }
        return usageLimit == null || usageCount < usageLimit;
    }
}
