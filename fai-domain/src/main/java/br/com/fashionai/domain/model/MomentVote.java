package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Voto por dimensão (§32): um por (envio, votante, dimensão); nunca no próprio look (§39). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moment_votes")
public class MomentVote extends AuditableEntity {
    @Column(name = "moment_id", nullable = false, length = 36)
    private UUID momentId;

    @Column(name = "submission_id", nullable = false, length = 36)
    private UUID submissionId;

    @Column(name = "voter_id", nullable = false, length = 36)
    private UUID voterId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private MomentVoteDimension dimension;
}
