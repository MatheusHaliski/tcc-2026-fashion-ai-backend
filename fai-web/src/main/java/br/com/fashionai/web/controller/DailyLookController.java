package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DailyLookService;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * RF6/RF10 — histórico dos Looks do Dia, look anterior aguardando feedback e o feedback que alimenta as preferências.
 * A marcação do Look do Dia e a aba com o painel de Hype ficam em {@link LookbookController}; mesma tag do OpenAPI.
 */
@RestController
@Tag(name = "RF6 — Lookbook, Look do Dia e HypeScore (painel em v2; agrupamentos por similaridade)")
public class DailyLookController {
    private final DailyLookService dailyLooks;

    public DailyLookController(DailyLookService dailyLooks) {
        this.dailyLooks = dailyLooks;
    }

    @GetMapping("/api/me/daily-looks")
    @Operation(summary = "RF6 — Histórico de Looks do Dia")
    public List<Map<String, Object>> history(CurrentUser user) {
        return dailyLooks.history(user);
    }

    @GetMapping("/api/me/daily-looks/pending-feedback")
    @Operation(summary = "RF10 — Look do dia anterior aguardando feedback")
    public Map<String, Object> pendingFeedback(CurrentUser user) {
        return dailyLooks.pendingFeedback(user);
    }

    public record FeedbackRequest(@NotNull DailyLookFeedback feedback) {
    }

    @PutMapping("/api/me/daily-looks/{date}/feedback")
    @Operation(summary = "RF10 — Feedback do look (ADOREI / OK / NAO_CURTI) alimenta as preferências")
    public Map<String, Object> feedback(CurrentUser user, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                        @RequestBody FeedbackRequest body) {
        return dailyLooks.feedback(user, date, body.feedback());
    }
}
