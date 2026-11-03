package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.runwayTheme;
import static br.com.fashionai.application.service.ChallengeRules.today;

/**
 * Validação dos parâmetros de cada desafio ao criar (conjunto de peças do 10×10 e da Cápsula, metas e limites).
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeParams {
    private final WardrobeItemRepository pieces;
    private final StyleDnaRepository dnas;

    ChallengeParams(WardrobeItemRepository pieces, StyleDnaRepository dnas) {
        this.pieces = pieces;
        this.dnas = dnas;
    }

    /** Parâmetros por desafio (ex.: as 10 peças do 10×10). */

    Map<String, Object> validateParams(CurrentUser user, ChallengeTemplate t, String mode, Map<String, Object> params) {
        switch (t.getCode()) {
            case "TEN_X_TEN" -> params.put("piece_ids", ownPieceSet(user, params.get("piece_ids"), 10, 10, Msg.t("challenge.o_10x10_usa_exatamente")));
            case "CAPSULE_SEASON" -> {
                params.put("piece_ids", ownPieceSet(user, params.get("piece_ids"), 33, 33, Msg.t("challenge.a_temporada_capsula_usa_exatamente")));
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 60;
                params.put("target_days", Math.max(30, Math.min(90, target)));
            }
            case "SECOND_CHANCE" -> {
                int pct = params.get("percent") instanceof Number n ? n.intValue() : 30;
                params.put("percent", Math.max(10, Math.min(100, pct)));
            }
            case "NO_REPEAT" -> {
                int target = params.get("target_days") instanceof Number n ? n.intValue() : 7;
                params.put("target_days", Math.max(3, Math.min(60, target)));
                if (mode.equals("DUELO")) {
                    params.put("duel_days", params.get("duel_days") instanceof Number n ? Math.max(7, Math.min(30, n.intValue())) : 14);
                }
            }
            case "MY_SEASON" -> {
                var dna = dnas.findByUserId(user.id()).orElse(null);
                if (dna == null || (dna.getColorPalette() == null && dna.getColorSeason() == null)) {
                    throw new ApiException(409, "SEM_COLORACAO", Msg.t("challenge.minha_estacao_usa_a_cartela"), Map.of("href", "/dna"));
                }
            }
            case "RUNWAY_BATTLE" -> params.put("theme", runwayTheme(today()));
            case "REAL_MIRROR" -> params.put("window_minutes", 30);
            default -> {
                if ("COMMUNITY".equals(t.getOrigin()) || t.getRuleBlocksJson() != null) {
                    params.put("blocks", Json.list(t.getRuleBlocksJson()));
                }
            }
        }
        return params;
    }

    List<String> ownPieceSet(CurrentUser user, Object raw, int min, int max, String rule) {
        List<UUID> ids = new ArrayList<>();
        if (raw instanceof Collection<?> c) {
            for (Object o : c) {
                try {
                    ids.add(UUID.fromString(String.valueOf(o)));
                } catch (IllegalArgumentException ignored) {
                    // ignorado
                }
            }
        }
        List<UUID> distinct = ids.stream().distinct().toList();
        if (distinct.size() < min || distinct.size() > max) {
            throw ApiException.badRequest("PECAS_INVALIDAS", Msg.t("challenge.escolha_as_pecas_do_desafio", rule));
        }
        List<WardrobeItem> found = pieces.findByIdIn(distinct);
        if (found.size() != distinct.size() || found.stream().anyMatch(w -> !w.getUser().getId().equals(user.id())
                || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED)) {
            throw ApiException.badRequest("PECAS_INVALIDAS", Msg.t("challenge.use_somente_pecas_do_seu"));
        }
        return distinct.stream().map(UUID::toString).toList();
    }
}
