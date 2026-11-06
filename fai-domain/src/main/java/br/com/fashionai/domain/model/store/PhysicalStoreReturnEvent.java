package br.com.fashionai.domain.model.store;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Trilha imutável das transições de um caso de troca/devolução (quem, de onde, para onde, por quê). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_return_events")
public class PhysicalStoreReturnEvent extends AuditableEntity {
    @Column(name = "case_id", nullable = false, length = 36)
    private UUID caseId;

    @Column(name = "actor_id", nullable = false, length = 36)
    private UUID actorId;

    @Column(name = "from_status", length = 20)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 20)
    private String toStatus;

    @Column(length = 2000)
    private String notes;
}
