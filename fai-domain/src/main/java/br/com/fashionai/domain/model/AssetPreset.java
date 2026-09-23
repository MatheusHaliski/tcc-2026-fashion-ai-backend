package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AssetKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Catálogo visual do RF11/RF23 (presets AURA, materiais, combinações, mosaicos, fundos do chrome,
 * gradientes Aura, presets sazonais, skins). Semeado a partir de catalog/asset-manifest.json
 * (scripts/assets/build_asset_catalog.py); status FALLBACK marca combinações sem asset físico.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "asset_presets")
public class AssetPreset {
    @Id
    @Column(nullable = false, length = 120)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AssetKind kind;

    @Column(nullable = false, length = 160)
    private String label;

    @Column(name = "preset_group", length = 120)
    private String presetGroup;

    @Column(name = "static_url", length = 1024)
    private String staticUrl;

    @Column(name = "preview_url", length = 1024)
    private String previewUrl;

    @Column(name = "animated_url", length = 1024)
    private String animatedUrl;

    @Column(name = "poster_url", length = 1024)
    private String posterUrl;

    @Column(name = "palette_json", columnDefinition = "json")
    private String paletteJson;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    @Column(nullable = false, length = 20)
    private String status = "ASSET";

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "rf_tags", length = 60)
    private String rfTags;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt = Instant.now();
}
