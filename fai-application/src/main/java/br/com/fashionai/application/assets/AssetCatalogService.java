package br.com.fashionai.application.assets;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.AssetPreset;
import br.com.fashionai.domain.model.enums.AssetKind;
import br.com.fashionai.domain.repository.AssetPresetRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Catálogo de assets visuais gerado de /public por scripts/assets/build_asset_catalog.py:
 * fundos do chrome (RF23 — pasta /public/bg_chrome), presets AURA com e sem animação, materiais com e sem
 * animação, combinações AURA × material (estática/animada — hoje por fallback CSS) e mosaicos P##_M##
 * (somente animados), gradientes, sazonais e skins de card (RF11). Sincroniza a tabela asset_presets.
 */
@Service
public class AssetCatalogService {
    private static final Logger log = LoggerFactory.getLogger(AssetCatalogService.class);

    private final AssetPresetRepository repository;
    private final Path publicDir;
    private final Map<String, Object> manifest;

    public AssetCatalogService(AssetPresetRepository repository,
                               @Value("${fashionai.assets.public-dir:public}") String publicDir) {
        this.repository = repository;
        this.publicDir = Path.of(publicDir).toAbsolutePath().normalize();
        this.manifest = load();
    }

    private Map<String, Object> load() {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("catalog/asset-manifest.json")) {
            if (in == null) {
                log.warn("catalog/asset-manifest.json não encontrado no classpath — catálogo vazio");
                return new LinkedHashMap<>();
            }
            return Json.MAPPER.readValue(in, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (IOException ex) {
            throw new IllegalStateException("Manifesto de assets inválido", ex);
        }
    }

    public Map<String, Object> manifest() {
        return manifest;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> list(String key) {
        Object v = manifest.get(key);
        return v instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> mosaics() {
        Object combos = manifest.get("auraMaterialCombos");
        if (combos instanceof Map<?, ?> m && m.get("mosaic") instanceof List<?> l) {
            return (List<Map<String, Object>>) l;
        }
        return List.of();
    }

    public List<Map<String, Object>> chromeBackgrounds() {
        return list("chromeBackgrounds");
    }

    public boolean isChromeBackground(String id) {
        return id == null || chromeBackgrounds().stream().anyMatch(b -> id.equals(b.get("id")))
                || id.startsWith("theme:");
    }

    public Optional<Map<String, Object>> auraVariant(String variantId) {
        for (Map<String, Object> preset : list("auraPresets")) {
            Object variants = preset.get("variants");
            if (variants instanceof List<?> l) {
                for (Object o : l) {
                    if (o instanceof Map<?, ?> v && variantId != null && variantId.equals(v.get("id"))) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> m = new LinkedHashMap<>((Map<String, Object>) v);
                        m.put("preset", preset);
                        return Optional.of(m);
                    }
                }
            }
        }
        return Optional.empty();
    }

    public Optional<Map<String, Object>> auraPreset(String presetId) {
        return list("auraPresets").stream().filter(p -> presetId != null && presetId.equals(p.get("id"))).findFirst();
    }

    public Optional<Map<String, Object>> material(String id) {
        return list("materials").stream().filter(p -> id != null && id.equals(p.get("id"))).findFirst();
    }

    public Optional<Map<String, Object>> gradient(String id) {
        List<Map<String, Object>> all = new ArrayList<>(list("gradientAuraPresets"));
        all.addAll(list("seasonalPresets"));
        return all.stream().filter(p -> id != null && id.equals(p.get("id"))).findFirst();
    }

    public Optional<Map<String, Object>> cardSkin(String id) {
        return list("cardSkins").stream().filter(p -> id != null && id.equals(p.get("id"))).findFirst();
    }

    public Optional<Map<String, Object>> mosaic(String auraVariantId, String materialId) {
        return mosaics().stream().filter(m -> auraVariantId != null && auraVariantId.equals(m.get("auraVariantId"))
                && materialId != null && materialId.equals(m.get("materialId"))).findFirst();
    }

    /**
     * Resolução de uma combinação AURA × material conforme a disponibilidade real das pastas:
     * mosaico animado (asset real) → combinação estática/animada (hoje ausentes → fallback css-blend).
     */
    public Map<String, Object> resolveCombination(String auraVariantId, String materialId, boolean animated, boolean mosaic) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("auraVariantId", auraVariantId);
        out.put("materialId", materialId);
        if (mosaic) {
            Optional<Map<String, Object>> m = mosaic(auraVariantId, materialId);
            if (m.isPresent()) {
                out.put("strategy", "asset");
                out.put("kind", "mosaic-animated");
                out.put("url", m.get().get("url"));
                out.put("posterUrl", m.get().get("posterUrl"));
                return out;
            }
        }
        Optional<Map<String, Object>> aura = auraVariant(auraVariantId);
        Optional<Map<String, Object>> material = material(materialId);
        out.put("strategy", animated ? "css-blend(aura_static + material_animated video)" : "css-blend(aura_static + material_static)");
        out.put("kind", animated ? "aura-material-animated" : "aura-material-static");
        aura.ifPresent(a -> out.put("auraLayer", a.get("static")));
        material.ifPresent(m -> out.put("materialLayer", animated ? m.getOrDefault("animated", m.get("static")) : m.get("static")));
        out.put("blendMode", "soft-light");
        out.put("materialOpacity", 0.42);
        return out;
    }

    /** Arquivo físico em /public para renderização no servidor (card RF5); vazio quando a pasta não existe. */
    public Optional<Path> publicFile(String url) {
        if (url == null || url.isBlank() || url.startsWith("http")) {
            return Optional.empty();
        }
        Path p = publicDir.resolve(url.startsWith("/") ? url.substring(1) : url).normalize();
        return p.startsWith(publicDir) && Files.isRegularFile(p) ? Optional.of(p) : Optional.empty();
    }

    @Transactional
    public int syncPresets() {
        List<AssetPreset> rows = new ArrayList<>();
        int order = 0;
        for (Map<String, Object> bg : chromeBackgrounds()) {
            rows.add(row((String) bg.get("id"), AssetKind.CHROME_BACKGROUND, (String) bg.get("label"), "chrome",
                    (String) bg.get("originalFile"), (String) bg.get("previewUrl"), null, null, null, bg, order++, "RF23"));
        }
        for (Map<String, Object> preset : list("auraPresets")) {
            rows.add(row((String) preset.get("id"), AssetKind.AURA_PRESET, (String) preset.get("name"), "aura",
                    null, null, null, null, preset.get("palette"), without(preset, "variants"), order++, "RF11"));
            if (preset.get("variants") instanceof List<?> variants) {
                for (Object o : variants) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> v = (Map<String, Object>) o;
                    Map<?, ?> st = (Map<?, ?>) v.get("static");
                    Map<?, ?> an = (Map<?, ?>) v.get("animated");
                    rows.add(row((String) v.get("id"), AssetKind.AURA_VARIANT, preset.get("name") + " · " + v.get("theme"),
                            (String) preset.get("id"), st == null ? null : (String) st.get("url"),
                            st == null ? null : (String) st.get("previewUrl"), an == null ? null : (String) an.get("url"),
                            an == null ? null : (String) an.get("posterUrl"), preset.get("palette"), v, order++, "RF11"));
                }
            }
        }
        for (Map<String, Object> m : list("materials")) {
            Map<?, ?> st = (Map<?, ?>) m.get("static");
            Map<?, ?> an = (Map<?, ?>) m.get("animated");
            rows.add(row((String) m.get("id"), AssetKind.MATERIAL, (String) m.get("name"), "material",
                    st == null ? null : (String) st.get("url"), st == null ? null : (String) st.get("previewUrl"),
                    an == null ? null : (String) an.get("url"), an == null ? null : (String) an.get("posterUrl"), null, m,
                    order++, "RF11"));
        }
        for (Map<String, Object> mz : mosaics()) {
            rows.add(row((String) mz.get("code"), AssetKind.AURA_MATERIAL_MOSAIC, (String) mz.get("code"), "mosaic",
                    null, (String) mz.get("posterUrl"), (String) mz.get("url"), (String) mz.get("posterUrl"), null, mz,
                    order++, "RF11"));
        }
        for (Map<String, Object> g : list("gradientAuraPresets")) {
            rows.add(row((String) g.get("id"), AssetKind.GRADIENT_AURA, (String) g.get("name"), "gradient", null, null, null,
                    null, g.get("stops"), g, order++, "RF11"));
        }
        for (Map<String, Object> s : list("seasonalPresets")) {
            rows.add(row((String) s.get("id"), AssetKind.SEASONAL, (String) s.get("name"), "seasonal", null, null, null,
                    null, s.get("stops"), s, order++, "RF11"));
        }
        for (Map<String, Object> s : list("cardSkins")) {
            rows.add(row((String) s.get("id"), AssetKind.CARD_SKIN, (String) s.get("name"), (String) s.get("family"), null,
                    null, null, null, null, s, order++, "RF11/RNF9"));
        }
        repository.saveAll(rows);
        return rows.size();
    }

    private static Map<String, Object> without(Map<String, Object> map, String key) {
        Map<String, Object> copy = new LinkedHashMap<>(map);
        copy.remove(key);
        return copy;
    }

    private AssetPreset row(String id, AssetKind kind, String label, String group, String staticUrl, String previewUrl,
                            String animatedUrl, String posterUrl, Object palette, Object metadata, int order, String rf) {
        AssetPreset p = repository.findById(id).orElseGet(AssetPreset::new);
        p.setId(id);
        p.setKind(kind);
        p.setLabel(label == null ? id : label.length() > 150 ? label.substring(0, 150) : label);
        p.setPresetGroup(group);
        p.setStaticUrl(staticUrl);
        p.setPreviewUrl(previewUrl);
        p.setAnimatedUrl(animatedUrl);
        p.setPosterUrl(posterUrl);
        p.setPaletteJson(palette == null ? null : Json.write(palette));
        p.setMetadataJson(Json.write(metadata));
        p.setStatus(staticUrl != null || animatedUrl != null || kind == AssetKind.GRADIENT_AURA || kind == AssetKind.SEASONAL
                || kind == AssetKind.CARD_SKIN || kind == AssetKind.AURA_PRESET ? "AVAILABLE" : "FALLBACK");
        p.setSortOrder(order);
        p.setRfTags(rf);
        p.setSyncedAt(Instant.now());
        return p;
    }
}
