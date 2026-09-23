package br.com.fashionai.domain.model;

import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "comments")
public class Comment extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scheme_id")
    private Scheme scheme;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wardrobe_item_id")
    private WardrobeItem wardrobeItem;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "content_ciphertext", nullable = false, length = 2048)
    private String content;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    protected Comment() {
    }
}
