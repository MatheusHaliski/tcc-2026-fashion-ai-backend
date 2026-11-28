package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.PieceActivityService;
import br.com.fashionai.application.marketplace.StoreSaleReportService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
public class PieceActivityController {
    private final PieceActivityService activity;
    private final StoreSaleReportService sales;

    public PieceActivityController(PieceActivityService activity, StoreSaleReportService sales) {
        this.activity = activity;
        this.sales = sales;
    }

    @PostMapping("/api/piece-activity/{entity}/{id}/{action}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activity(CurrentUser viewer, @PathVariable String entity, @PathVariable UUID id, @PathVariable String action) {
        activity.record(viewer, entity, id, action);
    }

    @PostMapping("/api/me/marketplace/stores/{storeId}/sales")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sale(CurrentUser viewer, @PathVariable UUID storeId, @RequestBody SaleReport report) {
        sales.record(viewer, storeId, report.pieceId(), report.reference(), report.pointsReceived());
    }

    @GetMapping("/api/me/marketplace/stores/{storeId}/sales")
    public StoreSaleReportService.SaleSummary summary(CurrentUser viewer, @PathVariable UUID storeId,
                                                      @RequestParam(required = false) Instant start,
                                                      @RequestParam(required = false) Instant end) {
        return sales.summary(viewer, storeId, start, end);
    }

    public record SaleReport(UUID pieceId, String reference, Long pointsReceived) {}
}
