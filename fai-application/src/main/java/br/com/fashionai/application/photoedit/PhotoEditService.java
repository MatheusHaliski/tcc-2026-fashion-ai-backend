package br.com.fashionai.application.photoedit;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.QualityMetrics;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.PieceImage;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CaptureView;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.enums.PieceImageStatus;
import br.com.fashionai.domain.model.enums.PieceImageType;
import br.com.fashionai.domain.repository.PieceImageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.UnaryOperator;

/**
 * RF15 · Editor de fotografia da peça (docs/novos-rf/RF15_Editor_Fotografia_Pecas.md). A foto original da pessoa nunca
 * muda: cada salvamento é uma versão com a receita reeditável em {@code piece_images.analysis_json}. A versão CANONICAL
 * vira a imagem da peça (guarda-roupa, provador, 3D, IA); a PRESENTATION fica ao lado, rotulada.
 */
@Service
public class PhotoEditService {
    static final String SPEC = "RF15_EDITOR";
    static final String MODEL = "PHOTO_RECIPE_V" + PhotoRecipe.CURRENT_VERSION;
    static final int PREVIEW_SIDE = 1000;

    private final WardrobeService wardrobe;
    private final MediaService media;
    private final PieceImageRepository images;
    private final PhotoRecipeRenderer renderer;

    public PhotoEditService(WardrobeService wardrobe, MediaService media, PieceImageRepository images) {
        this(wardrobe, media, images, img -> ImageOps.removeBackgroundLocal(img).image());
    }

    PhotoEditService(WardrobeService wardrobe, MediaService media, PieceImageRepository images, UnaryOperator<BufferedImage> cutter) {
        this.wardrobe = wardrobe;
        this.media = media;
        this.images = images;
        this.renderer = new PhotoRecipeRenderer(cutter);
    }

    /** Foto própria da pessoa (a original); peça do catálogo ou com a ilustração padrão não tem o que editar. */
    BufferedImage source(WardrobeItem w) {
        if (w.isDefaultImage() || w.getImageOrigin() == ImageOrigin.CATALOG) {
            throw ApiException.conflict("SEM_FOTO_PROPRIA", "Esta peça não tem foto sua para editar. Envie uma foto primeiro.");
        }
        String url = w.getOriginalImageUrl() != null ? w.getOriginalImageUrl() : w.getImageUrl();
        return media.readImage(url).orElseThrow(() -> ApiException.conflict("SEM_FOTO_PROPRIA",
                "A foto original desta peça não está disponível para edição."));
    }

    static PhotoRecipe parse(Map<String, Object> json) {
        try {
            return PhotoRecipe.parse(json);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("RECEITA_INVALIDA", e.getMessage());
        }
    }

    void validate(PhotoRecipe recipe, BufferedImage src) {
        List<String> v = RecipePolicy.violations(recipe, (double) src.getHeight() / src.getWidth());
        if (!v.isEmpty()) {
            throw ApiException.badRequest("RECEITA_FORA_DA_POLITICA", String.join(", ", v), Map.of("violations", v));
        }
    }

    /** Resultado medido: imagem, ΔE da cor da peça (ajustes de cor × só geometria/fundo), qualidade e avisos. */
    record Measured(BufferedImage image, double deltaE, Map<String, Object> quality, List<String> warnings, boolean syntheticShadow) {
    }

    Measured renderMeasured(BufferedImage src, PhotoRecipe recipe, int maxSide) {
        PhotoRecipeRenderer.Rendered full = renderer.render(src, recipe.ops(), maxSide);
        List<PhotoRecipe.Op> geometry = recipe.ops().stream().filter(o -> !o.colorOp()).toList();
        double de = geometry.size() == recipe.ops().size() ? 0
                : ColorFidelity.deltaE(renderer.render(src, geometry, Math.min(maxSide, 600)).image(), ImageOps.scaleToFit(full.image(), 600, 600));
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("sharpness", round(QualityMetrics.sharpness(full.image())));
        q.put("exposure", round(QualityMetrics.exposure(full.image())));
        q.put("width", full.image().getWidth());
        q.put("height", full.image().getHeight());
        q.put("aspect", round((double) full.image().getWidth() / full.image().getHeight()));
        if (full.backgroundRemoved()) {
            ImageOps.Box box = ImageOps.alphaBounds(renderer.render(src, geometry.stream()
                    .map(o -> o instanceof PhotoRecipe.Background b ? new PhotoRecipe.Background(PhotoRecipe.BackgroundKind.TRANSPARENT, "NONE", b.strokes()) : o)
                    .toList(), Math.min(maxSide, 600)).image());
            if (!box.empty()) {
                BufferedImage ref = ImageOps.scaleToFit(full.image(), 600, 600);
                q.put("occupancy", round(Math.max((double) box.w() / ref.getWidth(), (double) box.h() / ref.getHeight())));
                q.put("touchesEdge", box.x() <= 1 || box.y() <= 1 || box.x() + box.w() >= ref.getWidth() - 1 || box.y() + box.h() >= ref.getHeight() - 1);
            }
        }
        q.put("colorDeltaE", round(de));
        List<String> warnings = new ArrayList<>();
        if (de > ColorFidelity.WARN_DELTA_E) {
            warnings.add("COR_DIFERENTE_DA_PECA_REAL");
        }
        if (Boolean.TRUE.equals(q.get("touchesEdge"))) {
            warnings.add("PECA_ENCOSTA_NA_BORDA");
        }
        if (((Number) q.get("sharpness")).doubleValue() < 0.25) {
            warnings.add("FOTO_POUCO_NITIDA");
        }
        if (full.syntheticShadow()) {
            warnings.add("SOMBRA_SINTETICA_ROTULADA");
        }
        return new Measured(full.image(), de, q, warnings, full.syntheticShadow());
    }

    /** Prévia em baixa resolução renderizada pelo mesmo código do salvamento (o que a pessoa vê é o que será salvo). */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, UUID pieceId, Map<String, Object> json) {
        WardrobeItem w = wardrobe.owned(user, pieceId);
        BufferedImage src = source(w);
        PhotoRecipe recipe = parse(json);
        validate(recipe, src);
        Measured m = renderMeasured(src, recipe, PREVIEW_SIDE);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("png", Base64.getEncoder().encodeToString(ImageOps.png(m.image())));
        out.put("quality", m.quality());
        out.put("warnings", m.warnings());
        return out;
    }

    /** Fonte para o editor: a foto original (URL), dimensões e a receita da canônica vigente, para reabrir e continuar. */
    @Transactional(readOnly = true)
    public Map<String, Object> session(CurrentUser user, UUID pieceId) {
        WardrobeItem w = wardrobe.owned(user, pieceId);
        BufferedImage src = source(w);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("originalUrl", w.getOriginalImageUrl() != null ? w.getOriginalImageUrl() : w.getImageUrl());
        out.put("width", src.getWidth());
        out.put("height", src.getHeight());
        out.put("category", w.getCategory());
        out.put("currentRecipe", current(pieceId).map(v -> Json.map(v.getAnalysisJson()).get("recipe")).orElse(null));
        out.put("limits", Map.of("straightenDeg", RecipePolicy.MAX_STRAIGHTEN_DEG, "exposureEv", RecipePolicy.MAX_EXPOSURE_EV,
                "canonicalSaturation", RecipePolicy.MAX_CANONICAL_SATURATION, "canonicalContrast", RecipePolicy.MAX_CANONICAL_CONTRAST,
                "canonicalSharpen", RecipePolicy.MAX_CANONICAL_SHARPEN, "healArea", RecipePolicy.MAX_HEAL_AREA, "warnDeltaE", ColorFidelity.WARN_DELTA_E));
        return out;
    }

    /**
     * Salva uma versão. CANONICAL: valida a lista branca, grava a versão e troca a imagem da peça (a original segue em
     * Minhas Fotos); PRESENTATION: grava a versão rotulada ao lado, sem tocar na peça.
     */
    @Transactional
    public Map<String, Object> save(CurrentUser user, UUID pieceId, Map<String, Object> json) {
        WardrobeItem w = wardrobe.owned(user, pieceId);
        BufferedImage src = source(w);
        PhotoRecipe recipe = parse(json);
        validate(recipe, src);
        Measured m = renderMeasured(src, recipe, PhotoRecipeRenderer.MAX_SIDE);
        byte[] png = ImageOps.png(m.image());
        boolean canonical = recipe.target() == PhotoRecipe.Target.CANONICAL;
        String key = "users/" + user.id() + "/pieces/" + pieceId + "/edits/" + System.currentTimeMillis() + "-"
                + recipe.target().name().toLowerCase() + ".png";
        MediaStoragePort.StoredObject stored = media.put(key, png, "image/png");
        if (canonical) {
            images.findByPieceIdOrderByCreatedAtAsc(pieceId).stream()
                    .filter(i -> SPEC.equals(i.getPhotographySpec()) && i.getImageType() == PieceImageType.CANONICAL && !i.isSuperseded())
                    .forEach(i -> {
                        i.setSuperseded(true);
                        images.save(i);
                    });
        }
        PieceImage v = new PieceImage();
        v.setPieceId(pieceId);
        v.setUserId(user.id());
        v.setImageType(canonical ? PieceImageType.CANONICAL : PieceImageType.PRESENTATION);
        v.setViewType(CaptureView.FRONT_VIEW);
        v.setStorageKey(key);
        v.setUrl(stored.url());
        v.setMimeType("image/png");
        v.setWidth(m.image().getWidth());
        v.setHeight(m.image().getHeight());
        v.setOrientation(m.image().getWidth() >= m.image().getHeight() ? "LANDSCAPE" : "PORTRAIT");
        v.setBytesSize((long) png.length);
        v.setSha256(br.com.fashionai.application.catalog.image.CatalogImagePipeline.sha256(png));
        v.setPhotographySpec(SPEC);
        v.setModelVersion(MODEL);
        v.setProcessingStatus(m.warnings().contains("PECA_ENCOSTA_NA_BORDA") ? PieceImageStatus.NEEDS_REVIEW : PieceImageStatus.COMPLETED);
        v.setBlurScore(BigDecimal.valueOf(((Number) m.quality().get("sharpness")).doubleValue()).setScale(4, RoundingMode.HALF_UP));
        v.setLightingScore(BigDecimal.valueOf(((Number) m.quality().get("exposure")).doubleValue()).setScale(4, RoundingMode.HALF_UP));
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("recipe", json);
        analysis.put("target", recipe.target().name());
        analysis.put("generative", false);
        analysis.put("syntheticShadow", m.syntheticShadow());
        analysis.put("quality", m.quality());
        analysis.put("warnings", m.warnings());
        v.setAnalysisJson(Json.write(analysis));
        images.save(v);
        Views.PieceView piece = canonical ? wardrobe.replaceImage(user, pieceId, png, null) : null;
        Map<String, Object> out = new LinkedHashMap<>(versionView(v, canonical));
        out.put("piece", piece);
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> versions(CurrentUser user, UUID pieceId) {
        wardrobe.owned(user, pieceId);
        List<PieceImage> list = new ArrayList<>(images.findByPieceIdOrderByCreatedAtAsc(pieceId).stream()
                .filter(i -> SPEC.equals(i.getPhotographySpec())).toList());
        java.util.Collections.reverse(list);
        return list.stream().map(i -> versionView(i, i.getImageType() == PieceImageType.CANONICAL && !i.isSuperseded())).toList();
    }

    /** Volta a imagem da peça para uma versão canônica anterior (as demais ficam no histórico). */
    @Transactional
    public Map<String, Object> restore(CurrentUser user, UUID pieceId, UUID versionId) {
        wardrobe.owned(user, pieceId);
        PieceImage v = images.findById(versionId).filter(i -> pieceId.equals(i.getPieceId()) && SPEC.equals(i.getPhotographySpec()))
                .orElseThrow(() -> ApiException.notFound("versão"));
        if (v.getImageType() != PieceImageType.CANONICAL) {
            throw ApiException.badRequest("VERSAO_DE_APRESENTACAO", "Versões de apresentação não substituem a foto da peça.");
        }
        byte[] png = media.read(v.getUrl()).orElseThrow(() -> ApiException.conflict("VERSAO_INDISPONIVEL", "O arquivo desta versão não está disponível."));
        images.findByPieceIdOrderByCreatedAtAsc(pieceId).stream()
                .filter(i -> SPEC.equals(i.getPhotographySpec()) && i.getImageType() == PieceImageType.CANONICAL)
                .forEach(i -> {
                    i.setSuperseded(!i.getId().equals(versionId));
                    images.save(i);
                });
        Views.PieceView piece = wardrobe.replaceImage(user, pieceId, png, null);
        Map<String, Object> out = new LinkedHashMap<>(versionView(v, true));
        out.put("piece", piece);
        return out;
    }

    /**
     * "Automático": endireita pelo eixo da peça, remove o fundo (branco), enquadra em 4:5 com a peça ocupando ~85% e
     * corrige a luz de leve. Devolve só a receita — a pessoa vê a prévia e decide.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> auto(CurrentUser user, UUID pieceId) {
        WardrobeItem w = wardrobe.owned(user, pieceId);
        return Map.of("recipe", autoRecipe(source(w)));
    }

    Map<String, Object> autoRecipe(BufferedImage original) {
        BufferedImage src = ImageOps.scaleToFit(original, 900, 900);
        List<Map<String, Object>> ops = new ArrayList<>();
        ImageOps.Cutout cut = ImageOps.removeBackgroundLocal(src);
        double[] axis = ImageOps.principalAxis(cut.image());
        double deg = axis[1] >= ImageOps.DESKEW_MIN_ELONGATION ? ImageOps.deskewAngle(axis[0]) : 0;
        deg = Math.max(-RecipePolicy.MAX_STRAIGHTEN_DEG, Math.min(RecipePolicy.MAX_STRAIGHTEN_DEG, deg));
        BufferedImage work = src;
        if (Math.abs(deg) >= 0.5) {
            ops.add(Map.of("op", "straighten", "deg", round(deg)));
            work = PhotoRecipeRenderer.straighten(ImageOps.toArgb(src), deg);
        }
        ImageOps.Box box = ImageOps.alphaBounds(cut.confidence() >= 0.45 && Math.abs(deg) < 0.5 ? cut.image()
                : ImageOps.removeBackgroundLocal(work).image());
        int ww = work.getWidth(), wh = work.getHeight();
        if (box.empty()) {
            box = new ImageOps.Box(0, 0, ww, wh);
        }
        // quadro 4:5 com a peça ocupando ~85% do maior lado; encolhe a folga até caber na foto (nunca padding aqui)
        double fill = 0.85;
        double ch = Math.max(box.h() / fill, box.w() / (fill * 0.8)), cw = ch * 0.8;
        if (cw > ww) {
            cw = ww;
            ch = cw / 0.8;
        }
        if (ch > wh) {
            ch = wh;
            cw = ch * 0.8;
        }
        double cx = box.x() + box.w() / 2.0, cy = box.y() + box.h() / 2.0;
        double x = Math.max(0, Math.min(ww - cw, cx - cw / 2)), y = Math.max(0, Math.min(wh - ch, cy - ch / 2));
        ops.add(Map.of("op", "crop", "rect", Map.of("x", round4(x / ww), "y", round4(y / wh), "w", round4(cw / ww), "h", round4(ch / wh)), "aspect", "4:5"));
        if (cut.confidence() >= 0.45) {
            ops.add(Map.of("op", "background", "kind", "WHITE", "shadow", "NONE", "strokes", List.of()));
        }
        double exposure = QualityMetrics.exposure(work);
        double mean = meanLuma(work);
        if (exposure < 0.7 && mean < 0.4) {
            ops.add(Map.of("op", "tone", "exposureEv", 0.4, "highlights", 0, "shadows", 15, "contrast", 0, "saturation", 0));
        } else if (exposure < 0.7 && mean > 0.8) {
            ops.add(Map.of("op", "tone", "exposureEv", -0.3, "highlights", -15, "shadows", 0, "contrast", 0, "saturation", 0));
        }
        Map<String, Object> recipe = new LinkedHashMap<>();
        recipe.put("version", PhotoRecipe.CURRENT_VERSION);
        recipe.put("target", "CANONICAL");
        recipe.put("ops", ops);
        return recipe;
    }

    static double meanLuma(BufferedImage img) {
        BufferedImage s = ImageOps.scaleToFit(img, 200, 200);
        int[] px = s.getRGB(0, 0, s.getWidth(), s.getHeight(), null, 0, s.getWidth());
        double sum = 0;
        for (int p : px) {
            sum += (((p >> 16) & 0xFF) * 0.299 + ((p >> 8) & 0xFF) * 0.587 + (p & 0xFF) * 0.114) / 255;
        }
        return sum / px.length;
    }

    Map<String, Object> versionView(PieceImage v, boolean current) {
        Map<String, Object> a = v.getAnalysisJson() == null ? Map.of() : Json.map(v.getAnalysisJson());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("target", a.getOrDefault("target", v.getImageType().name()));
        m.put("url", v.getUrl());
        m.put("current", current);
        m.put("createdAt", v.getCreatedAt());
        m.put("recipe", a.get("recipe"));
        m.put("quality", a.get("quality"));
        m.put("warnings", a.getOrDefault("warnings", List.of()));
        m.put("generative", a.getOrDefault("generative", false));
        m.put("syntheticShadow", a.getOrDefault("syntheticShadow", false));
        return m;
    }

    java.util.Optional<PieceImage> current(UUID pieceId) {
        return images.findByPieceIdOrderByCreatedAtAsc(pieceId).stream()
                .filter(i -> SPEC.equals(i.getPhotographySpec()) && i.getImageType() == PieceImageType.CANONICAL && !i.isSuperseded())
                .reduce((a, b) -> b);
    }

    static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }

    static double round4(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
