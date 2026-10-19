package br.com.fashionai.web.controller;

import br.com.fashionai.application.service.ExchangeRateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

@RestController
@Tag(name = "RF23 — Internacionalização")
public class ExchangeRateController {
    private final ExchangeRateService rates;

    public ExchangeRateController(ExchangeRateService rates) {
        this.rates = rates;
    }

    @GetMapping("/api/exchange-rates")
    @Operation(summary = "RF23.CA13 — Cotações de referência (base BRL → USD, EUR) para mostrar preços na moeda do usuário")
    public ResponseEntity<Map<String, Object>> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic()).body(rates.view());
    }
}
