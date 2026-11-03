package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.RankingOptIn;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.RankingOptInRepository;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static br.com.fashionai.application.service.InventoryScoreService.BANDS;
import static br.com.fashionai.application.service.InventoryScoreService.MIN_PIECES;
import static br.com.fashionai.application.service.InventoryScoreRubric.NAMES;

/** RF34 §4.1 — aba Destaques, desafios sugeridos para a dimensão mais fraca e dicas de melhoria (Copilot). */
final class InventoryHighlightsTab {
    private final InventoryProgress progress;
    private final InventoryHighlightCards cards;
    private final AchievementService achievements;
    private final RankingOptInRepository optIns;
    private final ChallengeTemplateRepository templates;

    InventoryHighlightsTab(InventoryProgress progress, InventoryHighlightCards cards, AchievementService achievements,
                           RankingOptInRepository optIns, ChallengeTemplateRepository templates) {
        this.progress = progress;
        this.cards = cards;
        this.achievements = achievements;
        this.optIns = optIns;
        this.templates = templates;
    }

    /** Aba Destaques (RF34 §4.1) a partir da nota já calculada. */
    Map<String, Object> highlightsTab(CurrentUser user, Result r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", r.eligible());
        out.put("pieces", r.pieces());
        if (!r.eligible()) {
            // RF34.CA02 — progresso no padrão do RF13.CA02, sem nota parcial
            out.put("progress", Map.of("missing", MIN_PIECES - r.pieces(), "target", MIN_PIECES,
                    "message", Msg.t("inventoryScore.faltam_pecas_para_o_seu", (MIN_PIECES - r.pieces())),
                    "steps", List.of(Map.of("label", Msg.t("inventoryScore.conta_criada"), "done", true), Map.of("label", Msg.t("inventoryScore.primeira_peca_cadastrada"), "done", r.pieces() > 0),
                            Map.of("label", Msg.t("inventoryScore.n10_pecas_no_acervo"), "done", false))));
            out.put("manifesto", Msg.t("inventoryScore.vista_o_que_voce_tem"));
            return out;
        }
        out.put("score", r.score());
        out.put("band", r.band());
        out.put("bands", BANDS);
        out.put("k", r.k());
        out.put("kNote", r.k() < 1 ? Msg.t("inventoryScore.sua_nota_cresce_ate_20", Math.round(r.k() * 100)) : null);
        out.put("dimensions", r.dimensions());
        out.put("dims", r.dims());
        out.put("delta", progress.monthDelta(user.id(), r));
        out.put("highlights", cards.highlights(user.id(), r));
        out.put("evolution", progress.evolution(user.id(), r));
        out.put("records", progress.records(user.id(), r));
        out.put("achievements", achievements.list(user));
        out.put("suggestedChallenges", suggestedChallenges(r));
        out.put("rankingsOptIn", optIns.findById(user.id()).map(RankingOptIn::isOptedIn).orElse(false));
        out.put("computedAt", r.computedAt());
        out.put("manifesto", Msg.t("inventoryScore.vista_o_que_voce_tem"));
        return out;
    }

    /** RF36.CA15 / RF34 — até 2 desafios para a dimensão mais fraca (< 70). */
    List<Map<String, Object>> suggestedChallenges(Result r) {
        Optional<Map.Entry<String, Integer>> weakest = r.dims().entrySet().stream().min(Map.Entry.comparingByValue());
        if (weakest.isEmpty() || weakest.get().getValue() >= 70) {
            return List.of();
        }
        String dim = weakest.get().getKey();
        return templates.findByActiveTrueOrderByName().stream().filter(t -> Json.strings(t.getScoreDimensionsJson()).contains(dim)).limit(2)
                .map(t -> Map.<String, Object>of("code", t.getCode(), "name", t.getName(), "rule", t.getRuleText(), "dimension", dim,
                        "reason", Msg.t("inventoryScore.que_tal_o", (NAMES.get(dim)), weakest.get().getValue(), t.getName()))).toList();
    }

    /** RF10.CA13 — as 2 dimensões mais fracas com números e ações diretas, a partir da nota já calculada. */
    Map<String, Object> improvementHints(Result r) {
        List<Dimension> weakest = r.dimensions().stream().filter(d -> d.value() != null).sorted(Comparator.comparingInt(Dimension::value)).limit(2).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", r.score());
        out.put("eligible", r.eligible());
        out.put("weakest", weakest);
        out.put("actions", List.of(Map.of("label", Msg.t("inventoryScore.ver_pecas_esquecidas"), "filter", "state:forgotten"),
                Map.of("label", Msg.t("common.criar_look_com_elas"), "action", "compose_forgotten"), Map.of("label", Msg.t("inventoryScore.abrir_meu_quarto"), "href", "/room")));
        out.put("suggestedChallenges", suggestedChallenges(r));
        return out;
    }
}
