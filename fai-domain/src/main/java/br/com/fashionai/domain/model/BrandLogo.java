package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Logo de marca encontrado na internet (Wikidata, busca na web pela IA ou ícone do site oficial) e guardado no storage
 * próprio. A chave é o nome normalizado, então serve tanto para marcas do catálogo quanto para o texto livre
 * {@code brandName} das peças. Sem logo encontrado, fica o monograma gerado (status GENERATED) e uma nova busca é feita
 * depois do prazo de nova tentativa.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "brand_logos")
public class BrandLogo extends VersionedAuditableEntity {
    @Column(name = "name_key", nullable = false, unique = true, length = 160)
    private String nameKey;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(name = "logo_url", length = 1024)
    private String logoUrl;

    /** PERFIL_MARCA, WIKIDATA, IA_BUSCA_WEB, FAVICON_SITE, MANUAL ou MONOGRAMA. */
    @Column(nullable = false, length = 40)
    private String source;

    /** FOUND (logo real) ou GENERATED (monograma provisório). */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 255)
    private String domain;

    @Column(name = "origin_url", length = 1024)
    private String originUrl;

    @Column(precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "checked_at", nullable = false)
    private Instant checkedAt;

    @Column(name = "last_error", length = 512)
    private String lastError;

    public BrandLogo(String nameKey, String displayName) {
        this.nameKey = nameKey;
        this.displayName = displayName;
        this.status = "GENERATED";
        this.source = "MONOGRAMA";
        this.checkedAt = Instant.EPOCH;
    }
}
