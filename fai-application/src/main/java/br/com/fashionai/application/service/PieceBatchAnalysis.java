package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

final class PieceBatchAnalysis {
    private PieceBatchAnalysis() {
    }

    static WardrobeService.Draft rejected(ApiException exception) {
        Map<String, Object> rejection = new LinkedHashMap<>(exception.details() == null ? Map.of() : exception.details());
        rejection.put("code", exception.code());
        rejection.put("message", exception.getMessage());
        return new WardrobeService.Draft(null, null, null, null, null, null, null, null, List.of(), BigDecimal.ZERO,
                0, false, false, null, exception.getMessage(), null, null, null, rejection);
    }

    static List<WardrobeService.Draft> analyze(List<byte[]> files, Function<byte[], WardrobeService.Draft> analyzer) {
        if (files == null || files.isEmpty()) {
            throw ApiException.badRequest("SEM_FOTOS", Msg.t("wardrobe.envie_ao_menos_uma_foto"));
        }
        if (files.size() > 12) {
            throw ApiException.badRequest("LOTE_GRANDE", Msg.t("wardrobe.envie_no_maximo_12_fotos"));
        }
        List<WardrobeService.Draft> drafts = new ArrayList<>();
        for (byte[] file : files) {
            try {
                drafts.add(analyzer.apply(file));
            } catch (PhotoRejectedException exception) {
                drafts.add(WardrobeService.Draft.rejected(exception));
            }
        }
        return drafts;
    }
}
