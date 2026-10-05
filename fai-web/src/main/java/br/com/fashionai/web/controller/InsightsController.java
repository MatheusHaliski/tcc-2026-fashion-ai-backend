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

import java.util.Map;

/**
 * Insights dinâmicos e contextualizados (RF53). GET público para os contextos do Explorador (só agregados de itens
 * públicos); os contextos pessoais (CAPSULE, COPILOT, AUTOPILOT, HISTORY, CLOSET, LOOKS) exigem login — checado aqui e de
 * novo no serviço.
 */
@RestController
@Tag(name = "RF53 — Insights dinâmicos")
public class InsightsController {
    private final InsightService insights;

    public InsightsController(InsightService insights) {
        this.insights = insights;
    }

    @GetMapping("/api/insights")
    @Operation(summary = "Insights da aba (EXPLORER_* sem login; CAPSULE, COPILOT, AUTOPILOT, HISTORY, CLOSET e LOOKS com login) — Hype como contexto, ao lado do estilo e do uso")
    public Map<String, Object> insights(CurrentUser viewer, @RequestParam String context,
                                        @RequestParam(required = false) Integer window,
                                        @RequestParam(required = false) String region,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String subcategory,
                                        @RequestParam(defaultValue = "false") boolean withAi) {
        InsightContext ctx = InsightContext.parse(context);
        if (ctx != null && !ctx.isPublic() && viewer == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        return insights.insights(viewer, context, window, region, category, subcategory, withAi);
    }
}
