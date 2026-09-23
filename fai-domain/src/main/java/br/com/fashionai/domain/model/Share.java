package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
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

/** RF19.CA08/CA09 — compartilhamento no feed interno (referencia o original) ou exportação para rede externa. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "shares")
public class Share extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 36)
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShareChannel channel;

    @Column(length = 500)
    private String caption;

    @Column(name = "export_url", length = 1024)
    private String exportUrl;
}
