package br.com.fashionai.domain.model.fitting;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Peça da lista de prova por SKU/tamanho: RESERVED, UNAVAILABLE (sem estoque) ou NO_INTEGRATION (loja sem a oferta). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "fitting_appointment_items")
public class FittingAppointmentItem extends AuditableEntity {
    @Column(name = "appointment_id", nullable = false, length = 36)
    private UUID appointmentId;

    @Column(name = "catalog_product_id", nullable = false, length = 36)
    private UUID catalogProductId;

    @Column(name = "store_variant_id", length = 36)
    private UUID storeVariantId;

    @Column(name = "size_label", nullable = false, length = 40)
    private String sizeLabel;

    @Column(nullable = false, length = 16)
    private String state;

    /** Resultado da prova conciliado pela pessoa: FIT, NO_FIT ou NOT_TRIED. */
    @Column(length = 10)
    private String result;
}
