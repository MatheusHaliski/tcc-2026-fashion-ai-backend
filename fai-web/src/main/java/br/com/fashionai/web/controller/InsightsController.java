package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.insights.InsightContext;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Insights dinâmicos e contextualizados (RF53). GET público para os contextos do Explorador, do feed, da busca e dos
 * perfis (só agregados de itens públicos); os contextos pessoais (CAPSULE, COPILOT, AUTOPILOT, HISTORY, CLOSET, LOOKS,
 * LOOK_EDITOR) exigem login — checado aqui e de novo no serviço.
 */
@RestController
@Tag(name = "RF53 — Insights dinâmicos")
public class InsightsController {
    private final InsightService insights;

    public InsightsController(InsightService insights) {
        this.insights = insights;
    }

    /**
     * Lote A5 (P3-15): {@code key} é o perfil dos contextos BRAND_PROFILE (slug) e CREATOR_PROFILE (@ ou id);
     * {@code pieces} (ids separados por vírgula, até 30) são as peças escolhidas no editor de look (LOOK_EDITOR).
     */
    @GetMapping("/api/insights")
    @Operation(summary = "Insights da aba (EXPLORER_*, FEED, SEARCH, BRAND_PROFILE e CREATOR_PROFILE sem login; CAPSULE, COPILOT, AUTOPILOT, HISTORY, CLOSET, LOOKS e LOOK_EDITOR com login) — Hype como contexto, ao lado do estilo e do uso")
    public Map<String, Object> insights(CurrentUser viewer, @RequestParam String context,
                                        @RequestParam(required = false) Integer window,
                                        @RequestParam(required = false) String region,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String subcategory,
                                        @RequestParam(required = false) String key,
                                        @RequestParam(required = false) String pieces,
                                        @RequestParam(defaultValue = "false") boolean withAi) {
        InsightContext ctx = InsightContext.parse(context);
        if (ctx != null && !ctx.isPublic() && viewer == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        return insights.insights(viewer, context, window, region, category, subcategory, key, ids(pieces), withAi);
    }

    /** Ids das peças (malformado é ignorado; no máximo {@value #MAX_PIECES}). */
    static final int MAX_PIECES = 30;

    static List<UUID> ids(String csv) {
        List<UUID> out = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split(",")) {
            try {
                out.add(UUID.fromString(part.trim()));
            } catch (IllegalArgumentException ignored) {
                // id malformado: ignorado
            }
            if (out.size() >= MAX_PIECES) {
                break;
            }
        }
        return out;
    }
}
