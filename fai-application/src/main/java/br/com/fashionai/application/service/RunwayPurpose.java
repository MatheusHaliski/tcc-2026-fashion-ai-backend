package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;

import java.util.Locale;

/**
 * Look do Dia Vivido F2 (§4.2) — filtro da Passarela 3D por propósito do dia ("looks que funcionaram para entrevista"):
 * só registros com o propósito pedido, nunca sensíveis (CUIDADO) nem "só eu"; com {@code worked}, só os que deram certo
 * (feedback ADOREI). Sem propósito no filtro, não muda nada.
 */
public final class RunwayPurpose {
    private RunwayPurpose() {
    }

    public static boolean matches(DailyLook dl, ShowcaseService.RunwayFilter f) {
        if (f.purpose() == null || f.purpose().isBlank()) {
            return true;
        }
        DailyLookPurpose wanted;
        try {
            wanted = DailyLookPurpose.valueOf(f.purpose().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
        return shareable(dl) && dl.getPurpose() == wanted && (!Boolean.TRUE.equals(f.worked()) || dl.getFeedback() == DailyLookFeedback.ADOREI);
    }

    /** Registro que pode aparecer para outras pessoas: com propósito, não sensível e não "só eu". */
    public static boolean shareable(DailyLook dl) {
        return dl.getPurpose() != null && !dl.getPurpose().sensitive() && dl.getAudience() != DailyLookAudience.SO_EU;
    }
}
