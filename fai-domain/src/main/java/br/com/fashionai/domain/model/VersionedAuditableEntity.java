package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;

@MappedSuperclass
public abstract class VersionedAuditableEntity extends AuditableEntity {
    @Version
    @Column(nullable = false)
    private long version;

    public long getVersion() {
        return version;
    }
}
