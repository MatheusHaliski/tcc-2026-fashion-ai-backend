package br.com.fashionai.application.assets;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.AssetPreset;
import br.com.fashionai.domain.model.enums.AssetKind;
import br.com.fashionai.domain.repository.AssetPresetRepository;
import tools.jackson.core.type.TypeReference;
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
    private final Map<String, Object> defaultLogos;

    public AssetCatalogService(AssetPresetRepository repository,
                               @Value("${fashionai.assets.public-dir:public}") String publicDir) {
        this.repository = repository;
        this.publicDir = Path.of(publicDir).toAbsolutePath().normalize();
        this.manifest = load("catalog/asset-manifest.json");
        this.defaultLogos = load("catalog/default-piece-logos.json");
    }

    private Map<String, Object> load(String resource) {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                log.warn("{} não encontrado no classpath — catálogo vazio", resource);
                return new LinkedHashMap<>();
            }
            return Json.MAPPER.readValue(in, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (IOException ex) {
            throw new IllegalStateException("Catálogo de assets inválido: " + resource, ex);
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
        if (variantId == null) {
            return Optional.empty();
        }
        for (Map<String, Object> preset : list("auraPresets")) {
            Object variants = preset.get("variants");
            if (variants instanceof List<?> l) {
                for (Object o : l) {
                    if (o instanceof Map<?, ?> v && variantId.equals(v.get("id"))) {
                        return Optional.of(withPreset(v, preset));
                    }
                }
            }
        }
        return legacyAuraVariant(variantId);
    }

    /**
     * Id de uma coleção substituída (ex.: as 120 variantes "aura_geometry__gradientes_a001_coins" trocadas pelos 6
     * vídeos de Aura Geometry): o prefixo "preset__" aponta o preset e o hash do id escolhe, de forma estável, uma das
     * variantes atuais — o mesmo cálculo de auraVariantId em lib/card-art.ts, para card e backend desenharem a mesma
     * arte e o look antigo continuar salvável.
     */
    private Optional<Map<String, Object>> legacyAuraVariant(String variantId) {
        int sep = variantId.indexOf("__");
        String presetId = sep > 0 ? variantId.substring(0, sep) : variantId;
        return auraPreset(presetId).flatMap(preset -> {
            if (!(preset.get("variants") instanceof List<?> l) || l.isEmpty()) {
                return Optional.empty();
            }
            Object v = l.get((int) (Integer.toUnsignedLong(variantId.hashCode()) % l.size()));
            return v instanceof Map<?, ?> m ? Optional.of(withPreset(m, preset)) : Optional.empty();
        });
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> withPreset(Map<?, ?> variant, Map<String, Object> preset) {
        Map<String, Object> m = new LinkedHashMap<>((Map<String, Object>) variant);
        m.put("preset", preset);
        return m;
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

    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> combo(String kind, String auraVariantId, String materialId) {
        Object combos = manifest.get("auraMaterialCombos");
        if (!(combos instanceof Map<?, ?> m) || !(m.get(kind) instanceof List<?> l)) {
            return Optional.empty();
        }
        return ((List<Map<String, Object>>) l).stream().filter(c -> auraVariantId != null
                && auraVariantId.equals(c.get("auraVariantId")) && materialId != null && materialId.equals(c.get("materialId")))
                .findFirst();
    }

    /**
     * Resolução de uma combinação AURA × material conforme a disponibilidade real das pastas:
     * mosaico animado (/aura_com_material_mosaico_com_GIF) → material com aura animado
     * (/aura_com_material_com_GIF) → material com aura estático (pasta ainda ausente → fallback css-blend).
     */
    public Map<String, Object> resolveCombination(String auraVariantId, String materialId, boolean animated, boolean mosaic) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("auraVariantId", auraVariantId);
        out.put("materialId", materialId);
        String kind = mosaic ? "mosaic" : animated ? "animated" : "static";
        Optional<Map<String, Object>> asset = combo(kind, auraVariantId, materialId);
        if (asset.isPresent()) {
            out.put("strategy", "asset");
            out.put("kind", mosaic ? "mosaic-animated" : animated ? "aura-material-animated" : "aura-material-static");
            out.put("url", asset.get().get("url"));
            out.put("posterUrl", asset.get().getOrDefault("posterUrl", asset.get().get("previewUrl")));
            out.put("code", asset.get().get("code"));
            if (Boolean.TRUE.equals(asset.get().get("labelConflict"))) {
                out.put("labelNote", asset.get().get("labelNote"));
            }
            return out;
        }
        Optional<Map<String, Object>> aura = auraVariant(auraVariantId);
        Optional<Map<String, Object>> material = material(materialId);
        out.put("strategy", animated ? Msg.t("assetCatalog.css_blend_aura_static_material") : Msg.t("assetCatalog.css_blend_aura_static_material_2"));
        out.put("kind", animated ? "aura-material-animated" : "aura-material-static");
        aura.ifPresent(a -> out.put("auraLayer", a.get("static")));
        material.ifPresent(m -> out.put("materialLayer", animated ? m.getOrDefault("animated", m.get("static")) : m.get("static")));
        out.put("blendMode", "soft-light");
        out.put("materialOpacity", 0.42);
        return out;
    }

    public List<Map<String, Object>> skins() {
        return list("cardSkins");
    }

    public Optional<Map<String, Object>> skin(String id) {
        return cardSkin(id);
    }

    /** Cor nativa do container do skin (usada quando a Direção recomendada trava o container — RF11). */
    public String nativeContainer(String skinId) {
        return cardSkin(skinId).map(s -> (String) s.get("nativeContainer")).orElse("#FFFFFF");
    }

    /**
     * RF4 — imagem padrão da peça quando o usuário deixa a foto vazia: /public/assets_pecas por
     * subcategoria → categoria → genérica (silhueta gerada enquanto a pasta não tiver arquivos).
     */
    @SuppressWarnings("unchecked")
    public String defaultPieceImage(String category, String subcategory) {
        Object d = manifest.get("defaultPieceImages");
        if (!(d instanceof Map<?, ?> m)) {
            return "/_derived/pecas_default/generic.svg";
        }
        Map<String, Object> bySub = (Map<String, Object>) m.get("bySubcategory");
        if (bySub != null && bySub.get(subcategory) instanceof Map<?, ?> e) {
            return (String) e.get("url");
        }
        Map<String, Object> byCat = (Map<String, Object>) m.get("byCategory");
        if (byCat != null && byCat.get(category) instanceof Map<?, ?> e) {
            return (String) e.get("url");
        }
        Object generic = m.get("generic");
        return generic instanceof Map<?, ?> g ? (String) g.get("url") : "/_derived/pecas_default/generic.svg";
    }

    /**
     * RF4 — imagem de referência de cada subtipo, na ordem da taxonomia: subcategoria → [categoria, url]. É a mesma arte
     * da imagem padrão; a análise da foto compara a peça com essas referências para detectar o subtipo.
     */
    @SuppressWarnings("unchecked")
    public Map<String, String[]> pieceReferenceImages() {
        Map<String, String[]> out = new LinkedHashMap<>();
        if (manifest.get("defaultPieceImages") instanceof Map<?, ?> m && m.get("bySubcategory") instanceof Map<?, ?> bySub) {
            ((Map<String, Object>) bySub).forEach((sub, v) -> {
                if (v instanceof Map<?, ?> e && e.get("url") instanceof String url && e.get("category") instanceof String cat) {
                    out.put(sub, new String[]{cat, url});
                }
            });
        }
        return out;
    }

    /**
     * RF4 · Estúdio da imagem padrão — caixa do selo FAI na arte (relativa à peça, 0–1), conferida nas folhas de
     * contato; vazio para arquivos fora do catálogo.
     */
    public java.util.Optional<double[]> defaultPieceLogo(String url) {
        if (url == null || !(defaultLogos.get(url) instanceof Map<?, ?> m) || !(m.get("box") instanceof List<?> b) || b.size() != 4) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(b.stream().mapToDouble(v -> ((Number) v).doubleValue()).toArray());
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
