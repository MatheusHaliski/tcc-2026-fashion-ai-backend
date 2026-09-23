package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.SchemeSlot;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "scheme_items")
public class SchemeItem extends AuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wardrobe_item_id", nullable = false)
    private WardrobeItem wardrobeItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SchemeSlot slot;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected SchemeItem() {
    }
}
