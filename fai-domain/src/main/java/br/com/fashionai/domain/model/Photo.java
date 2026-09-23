package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.PhotoOrigin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "photos")
public class Photo extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PhotoOrigin origin;

    @Column(name = "source_entity_id")
    private UUID sourceEntityId;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "public_url", length = 1024)
    private String publicUrl;

    @Column(name = "content_hash", length = 128)
    private String contentHash;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    protected Photo() {
    }
}
