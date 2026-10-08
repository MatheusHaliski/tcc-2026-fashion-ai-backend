package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF33 / DET-D05 — look pendurado no espelho entre sessões e combinações já exibidas (RF33.CA13). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mirror_states")
public class MirrorState extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tipo_look_id")
    private TipoLook tipoLook;

    @Column(name = "user_id", nullable = false, length = 36, unique = true)
    private UUID userId;

    @Column(name = "slots_json", columnDefinition = "json")
    private String slotsJson;

    @Column(name = "shown_combinations_json", columnDefinition = "json")
    private String shownCombinationsJson;

    @Column(name = "last_prompt", length = 500)
    private String lastPrompt;
}
