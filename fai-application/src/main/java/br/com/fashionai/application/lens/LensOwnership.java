package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.lens.LensDetectionFields.colors;
import static br.com.fashionai.application.lens.LensInputs.blankToNull;

/** "Quero" (lista de desejos das inspirações) e "Eu tenho" (liga a uma peça própria ou abre o cadastro pré-preenchido). */
final class LensOwnership {
    private final LensDetectionRepository detections;
    private final WardrobeItemRepository pieces;
    private final LensViewAssembler views;
    private final LensRequestContext.Sources live;

    LensOwnership(LensDetectionRepository detections, WardrobeItemRepository pieces, LensViewAssembler views,
                  LensRequestContext.Sources live) {
        this.detections = detections;
        this.pieces = pieces;
        this.views = views;
        this.live = live;
    }

    LensViews.DetectionView want(CurrentUser user, LensDetection d, Boolean wanted) {
        boolean on = Boolean.TRUE.equals(wanted);
        if (on && d.getWantedAt() == null) {
            d.setWantedAt(Instant.now());
        } else if (!on) {
            d.setWantedAt(null);
        }
        detections.save(d);
        return views.detectionView(live.open(user), d);
    }

    /** Com {@code itemId}, peça do próprio guarda-roupa (outra pessoa ou arquivada = 404); sem, o link do cadastro. */
    LensViews.OwnResult own(CurrentUser user, LensScan scan, LensDetection d, UUID itemId) {
        String href;
        if (itemId != null) {
            WardrobeItem w = pieces.findById(itemId).filter(p -> ownPiece(user, p))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            d.setOwnedItemId(w.getId());
            detections.save(d);
            href = "/pieces/" + w.getId();
        } else {
            href = prefillHref(scan.getId(), d);
        }
        return new LensViews.OwnResult(views.detectionView(live.open(user), d), href);
    }

    /** {@code /pieces/new} pré-preenchido com a leitura (categoria, subtipo, cor, material, estilos e o nome). */
    static String prefillHref(UUID scanId, LensDetection d) {
        Map<String, String> q = new LinkedHashMap<>();
        q.put("category", d.getCategory());
        q.put("subcategory", d.getSubcategory());
        List<LensViews.ColorShare> colors = colors(d);
        q.put("color", colors.isEmpty() ? null : colors.get(0).name());
        q.put("material", d.getMaterial());
        q.put("styles", blankToNull(d.getStyleTags()));
        q.put("q", d.getLabel());
        q.put("from", "lens");
        q.put("scan", scanId.toString());
        q.put("detection", d.getId() == null ? null : d.getId().toString());
        String query = q.entrySet().stream().filter(e -> e.getValue() != null && !e.getValue().isBlank())
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        return "/pieces/new?" + query;
    }

    private static boolean ownPiece(CurrentUser user, WardrobeItem w) {
        return w.getUser() != null && user.id().equals(w.getUser().getId()) && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED;
    }
}
