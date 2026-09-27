package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.PhotoAcceptance;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF4 — foto da peça recusada pelos critérios de aceite (422 FOTO_RECUSADA). {@code details.checks} traz todos os
 * critérios avaliados (id, ok, medida, limite e, nos reprovados, a orientação para refazer a foto).
 */
public class PhotoRejectedException extends ApiException {
    public PhotoRejectedException(String message, List<PhotoAcceptance.Check> checks) {
        super(422, "FOTO_RECUSADA", message, details(checks));
    }

    private static Map<String, Object> details(List<PhotoAcceptance.Check> checks) {
        Map<String, Object> d = new LinkedHashMap<>(new PhotoAcceptance.Report(false, checks).toMap());
        d.put("failed", checks.stream().filter(c -> !c.ok()).map(PhotoAcceptance.Check::id).toList());
        return d;
    }
}
