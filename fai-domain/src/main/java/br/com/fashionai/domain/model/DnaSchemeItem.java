package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.DnaCell;
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

import java.util.UUID;

/** Célula do DNA (taxonomia §04 — DNASchemeItem): referencia um ClothesScheme inteiro, não uma peça. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "dna_scheme_items")
public class DnaSchemeItem extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dna_scheme_id", nullable = false)
    private DnaScheme dnaScheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DnaCell cell;

    @Column(name = "era_label", length = 120)
    private String eraLabel;

    @Column(name = "is_duplicate", nullable = false)
    private boolean duplicate;

    @Column(name = "source_scheme_id", length = 36)
    private UUID sourceSchemeId;

    @Column(name = "applied_to_original", nullable = false)
    private boolean appliedToOriginal;
}
