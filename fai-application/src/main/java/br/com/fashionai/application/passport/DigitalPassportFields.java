package br.com.fashionai.application.passport;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Campo do passaporte digital com procedência explícita: VERIFIED (revisado/autorizado), SOURCE_DECLARED (marca ou
 * fonte oficial), OWNER_DECLARED (proprietário), ESTIMATED (derivado de foto/modelo 3D) ou NOT_INFORMED. Dado
 * estimado nunca é apresentado como certificação ou informação oficial da marca.
 */
final class DigitalPassportFields {
    private DigitalPassportFields() {
    }

    static final String VERIFIED = "VERIFIED";
    static final String SOURCE_DECLARED = "SOURCE_DECLARED";
    static final String OWNER_DECLARED = "OWNER_DECLARED";
    static final String ESTIMATED = "ESTIMATED";
    static final String NOT_INFORMED = "NOT_INFORMED";

    static Map<String, Object> field(Object value, String provenance) {
        Map<String, Object> out = new LinkedHashMap<>();
        boolean informed = value != null && !(value instanceof String s && s.isBlank());
        out.put("value", informed ? value : null);
        out.put("provenance", informed ? provenance : NOT_INFORMED);
        out.put("informed", informed);
        return out;
    }

    static Instant latest(Instant... candidates) {
        Instant best = null;
        for (Instant c : candidates) if (c != null && (best == null || c.isAfter(best))) best = c;
        return best;
    }
}
