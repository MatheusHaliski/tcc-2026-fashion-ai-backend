package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.FaiPointsService.Level;
import br.com.fashionai.domain.model.FlairChallenge;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR 3D — bloqueio por nível (integridade no servidor): cada jogo exige um nível FAI (pontos vitalícios,
 * {@link FaiPointsService#level}) e uma faixa do guarda-roupa (Inventory Score, {@link InventoryScoreService#compute}).
 * {@link #me} lê os dois UMA vez por requisição; {@link #check} só informa (catálogo e detalhe nunca bloqueiam a
 * leitura); {@link #require} é a primeira instrução de check/submit e devolve 403 com código e detalhes.
 */
@Component
public class Flair3dAccess {
    /** Faixas do Inventory Score (0–1000) que o catálogo usa como "nível do guarda-roupa". */
    public enum WardrobeLevel {
        EM_MONTAGEM(0, 299), ORGANIZADO(300, 499), VERSATIL(500, 649), BEM_CURADO(650, 799),
        CLOSET_INTELIGENTE(800, 899), CLOSET_ASSINATURA(900, 959), MAISON_CLOSET(960, 1000);

        public final int min;
        public final int max;

        WardrobeLevel(int min, int max) {
            this.min = min;
            this.max = max;
        }

        /** Faixa de um score; nulo (sem score ou inelegível) = EM_MONTAGEM; acima de 1000 = MAISON_CLOSET. */
        public static WardrobeLevel of(Integer score) {
            if (score == null) {
                return EM_MONTAGEM;
            }
            WardrobeLevel out = EM_MONTAGEM;
            for (WardrobeLevel l : values()) {
                if (score >= l.min) {
                    out = l;
                }
            }
            return out;
        }

        public boolean atLeast(WardrobeLevel other) {
            return ordinal() >= other.ordinal();
        }
    }

    /** O que a pessoa tem: nível FAI, faixa do guarda-roupa e o score (nulo sem avaliação). */
    public record Me(Level tier, WardrobeLevel wardrobe, Integer wardrobeScore) {
        public static final Me ANONYMOUS = new Me(Level.ESTREIA, WardrobeLevel.EM_MONTAGEM, null);

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tier", tier.name());
            m.put("wardrobeLevel", wardrobe.name());
            m.put("wardrobeScore", wardrobeScore);
            return m;
        }
    }

    public record Access(boolean allowed, boolean tierOk, boolean wardrobeOk, String requiredTier, String currentTier,
                         String requiredWardrobeLevel, String currentWardrobeLevel) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("allowed", allowed);
            m.put("tierOk", tierOk);
            m.put("wardrobeOk", wardrobeOk);
            m.put("requiredTier", requiredTier);
            m.put("currentTier", currentTier);
            m.put("requiredWardrobeLevel", requiredWardrobeLevel);
            m.put("currentWardrobeLevel", currentWardrobeLevel);
            return m;
        }
    }

    private final FaiPointsService points;
    private final InventoryScoreService inventory;

    public Flair3dAccess(FaiPointsService points, InventoryScoreService inventory) {
        this.points = points;
        this.inventory = inventory;
    }

    /** Nível e guarda-roupa da pessoa (uma leitura de cada); sem pessoa, o mínimo. */
    public Me me(UUID userId) {
        if (userId == null) {
            return Me.ANONYMOUS;
        }
        Level tier = points.level(userId);
        InventoryScoreService.Result r = inventory.compute(userId, true);
        Integer score = r == null || !r.eligible() ? null : r.score();
        return new Me(tier == null ? Level.ESTREIA : tier, WardrobeLevel.of(score), score);
    }

    /** Nível exigido pelo jogo: leitura estrita (um valor fora de ESTREIA/STUDIO/LOFT é erro de catálogo, não "aberto"). */
    public static Level requiredTier(FlairChallenge game) {
        String raw = game.getRequiredLevel();
        if (raw == null || raw.isBlank()) {
            return Level.ESTREIA;
        }
        try {
            return Level.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("required_level inválido no jogo " + game.getSlug() + ": " + raw, e);
        }
    }

    public static WardrobeLevel requiredWardrobe(FlairChallenge game) {
        String raw = game.getRequiredWardrobeLevel();
        if (raw == null || raw.isBlank()) {
            return WardrobeLevel.EM_MONTAGEM;
        }
        try {
            return WardrobeLevel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("required_wardrobe_level inválido no jogo " + game.getSlug() + ": " + raw, e);
        }
    }

    /** Só informa: {@code allowed} exige sessão e os dois requisitos; visitante vê os motivos mas nunca "pode jogar". */
    public Access check(FlairChallenge game, Me me, boolean authenticated) {
        Me m = me == null ? Me.ANONYMOUS : me;
        Level tier = requiredTier(game);
        WardrobeLevel wardrobe = requiredWardrobe(game);
        boolean tierOk = m.tier().atLeast(tier);
        boolean wardrobeOk = m.wardrobe().atLeast(wardrobe);
        return new Access(authenticated && tierOk && wardrobeOk, tierOk, wardrobeOk, tier.name(), m.tier().name(),
                wardrobe.name(), m.wardrobe().name());
    }

    /** Primeira instrução de check/submit: 403 FAI_LEVEL_REQUIRED ou WARDROBE_LEVEL_REQUIRED, com o exigido e o atual. */
    public void require(FlairChallenge game, Me me) {
        Access a = check(game, me, true);
        if (!a.tierOk()) {
            throw new ApiException(403, "FAI_LEVEL_REQUIRED", Msg.t("flair3d.level_required", Msg.t("flair3d.tier." + a.requiredTier())),
                    Map.of("requiredTier", a.requiredTier(), "currentTier", a.currentTier()));
        }
        if (!a.wardrobeOk()) {
            throw new ApiException(403, "WARDROBE_LEVEL_REQUIRED",
                    Msg.t("flair3d.wardrobe_required", Msg.t("flair3d.wardrobe." + a.requiredWardrobeLevel())),
                    Map.of("requiredWardrobeLevel", a.requiredWardrobeLevel(), "currentWardrobeLevel", a.currentWardrobeLevel()));
        }
    }
}
