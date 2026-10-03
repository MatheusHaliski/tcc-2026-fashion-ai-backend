package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.DatasetSourceType;
import br.com.fashionai.domain.model.enums.DatasetUsage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Proveniência e licença de uma fonte de dados de treinamento. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "dataset_sources")
public class DatasetSource extends VersionedAuditableEntity {
    @Column(name = "code", nullable = false, length = 60)
    private String code;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private DatasetSourceType sourceType;

    @Column(name = "license", nullable = false, length = 160)
    private String license;

    @Enumerated(EnumType.STRING)
    @Column(name = "usage_permission", nullable = false, length = 30)
    private DatasetUsage usagePermission;

    @Column(name = "commercial_use", nullable = false)
    private boolean commercialUse;

    @Column(name = "consent_required", nullable = false)
    private boolean consentRequired;

    @Column(name = "attribution", length = 512)
    private String attribution;
}
