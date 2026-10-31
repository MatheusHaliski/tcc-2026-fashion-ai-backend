package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.PipelineJob;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF4 — nova tentativa de ler a marca de um rascunho: a peça é dividida numa grade de sub-retângulos sobrepostos (e a
 * região do logo em quatro), cada um ampliado. Primeiro o OCR local lê todos; se não achar marca do catálogo, a IA
 * de visão recebe os recortes. A cada nova tentativa a grade fica mais fina (3×3 → 4×4 → 5×5). A posse do rascunho é
 * conferida antes, no {@link WardrobeService}.
 */
final class DraftBrandRetry {
    private final MediaService media;
    private final AiEngine ai;
    private final BrandReader brandReader;

    DraftBrandRetry(MediaService media, AiEngine ai, BrandReader brandReader) {
        this.media = media;
        this.ai = ai;
        this.brandReader = brandReader;
    }

    Map<String, Object> retry(CurrentUser user, UUID draftId, PipelineJob draft, int grid) {
        Map<String, Object> r = new LinkedHashMap<>(Json.map(draft.getResultJson()));
        byte[] png = DraftRecorder.cutout(media, r);
        BufferedImage piece = ImageOps.toArgb(ImageOps.decode(png));
        Map<String, Object> pf = r.get("prefill") instanceof Map<?, ?> m ? new LinkedHashMap<>(Json.map(Json.write(m))) : new LinkedHashMap<>();
        double[] logoRel = AiResponseJson.boxOf(pf.get("logo"));
        int g = Math.max(3, Math.min(5, grid));
        List<BrandRegions.Zone> tiles = BrandRegions.tiles(piece, logoRel, g);
        br.com.fashionai.application.imaging.BrandReader.Found found = brandReader == null ? null : brandReader.find(piece, tiles).orElse(null);
        String source = found == null ? null : "ocr";
        if (found == null || !found.confirmed()) {
            List<BrandRegions.Zone> sent = tiles.stream().filter(z -> !z.id().startsWith("logo_q")).limit(12).toList();
            List<AiRequest.AiImage> images = sent.stream()
                    .map(z -> new AiRequest.AiImage(ImageOps.jpeg(BrandRegions.crop(piece, z, 640), 0.9f), "image/jpeg")).toList();
            StringBuilder legend = new StringBuilder(Msg.t("wardrobe.recortes_da_peca_legenda"));
            for (int i = 0; i < sent.size(); i++) {
                legend.append("\n").append(i + 1).append(": ").append(sent.get(i).id());
            }
            AiOutcome<Map<String, Object>> out = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.PIECE_ANALYZER, PieceAnalyzerPrompts.BRAND_TILES_SYSTEM,
                    legend.toString(), images, 300, List.of(Msg.t("wardrobe.recortes_da_peca")), PieceAnalysisParser::parseBrandTiles, () -> null, null));
            Map<String, Object> v = out.value();
            if (v != null && v.get("brand") instanceof String b) {
                int idx = v.get("image") instanceof Number n ? n.intValue() - 1 : -1;
                BrandRegions.Zone z = idx >= 0 && idx < sent.size() ? sent.get(idx) : sent.get(0);
                double conf = v.get("confidence") instanceof Number n ? n.doubleValue() : 0.7;
                found = new br.com.fashionai.application.imaging.BrandReader.Found(b, z.id(), String.valueOf(v.getOrDefault("text", b)), conf, true, z.box());
                source = "ia";
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("grid", g);
        result.put("regions", tiles.size());
        result.put("source", source);
        result.put("ocrAvailable", brandReader != null && brandReader.available());
        if (found != null) {
            result.put("brand", found.brand());
            result.put("region", found.region());
            result.put("evidence", found.evidence());
            result.put("certainty", found.confirmed() ? "confirmada" : "possivel");
            result.put("box", java.util.Arrays.stream(found.box()).boxed().toList());
            BrandRegions.Zone at = new BrandRegions.Zone(found.region(), found.box());
            MediaStoragePort.StoredObject crop = media.put("users/" + user.id() + "/drafts/" + draftId + "/marca-" + System.currentTimeMillis() + ".jpg",
                    ImageOps.jpeg(BrandRegions.crop(piece, at, 640), 0.9f), "image/jpeg");
            result.put("regionUrl", crop.url());
            Map<String, Object> bs = pf.get("brandSearch") instanceof Map<?, ?> m ? new LinkedHashMap<>(Json.map(Json.write(m))) : new LinkedHashMap<>();
            if (found.confirmed()) {
                pf.put("brand", found.brand());
                bs.put("brand", found.brand());
                bs.remove("suggestion");
            } else {
                bs.put("suggestion", found.brand());
            }
            bs.put("foundIn", found.region());
            bs.put("evidence", found.evidence());
            bs.put("certainty", result.get("certainty"));
            bs.put("logoSource", source);
            pf.put("brandSearch", bs);
            if (logoRel == null) {
                pf.put("logo", Map.of("box", result.get("box"), "source", source));
            }
            r.put("prefill", pf);
            draft.setResultJson(Json.write(r));
        }
        return result;
    }
}
