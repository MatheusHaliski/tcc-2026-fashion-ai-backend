package br.com.fashionai.domain.model.laundry;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "laundry_batch_items", uniqueConstraints = @UniqueConstraint(name = "uq_laundry_item", columnNames = {"batch_id", "piece_id"}))
public class LaundryBatchItem extends AuditableEntity {
    @Column(name = "batch_id", nullable = false, length = 36)
    private UUID batchId;

    @Column(name = "piece_id", nullable = false, length = 36)
    private UUID pieceId;
}
