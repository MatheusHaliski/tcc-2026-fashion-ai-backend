package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeStatus;
import java.util.List;
import java.util.Map;

/** Digital card level, separate from the six Hype score bands and physical authenticity. */
public final class FashionCardLevels {
    private FashionCardLevels() {}
    public static Map<String,Object> of(HypeScoreCurrent current) {
        if (current == null || current.getStatus() != HypeStatus.AVAILABLE || current.getScore() == null)
            return Map.of("status", "PENDING", "ruleVersion", 1);
        List<String> signals = HypeSeals.of(current);
        // Reuse existing server rules; do not introduce client score thresholds or edition claims.
        String tier = signals.contains(HypeSeals.RARE) && signals.contains(HypeSeals.CLASSIC) ? "LEGENDARY"
                : signals.contains(HypeSeals.RARE) || signals.contains(HypeSeals.TRENDING) ? "RARE" : "COMMON";
        return Map.of("status", "CLASSIFIED", "tier", tier, "ruleVersion", 1, "source", "HYPE_SIGNALS");
    }
}
