package br.com.fashionai.web.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CouponHypeOffers;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Circuito Aura — cupom por Hype na carteira: as ofertas que a pessoa só não resgata porque o card ainda não chegou à
 * faixa de Hype pedida ("travado"). Só leitura; fica sob /api/me/** (exige sessão).
 */
@RestController
@Tag(name = "Circuito Aura — cupons travados por Hype")
public class CouponHypeController {
    private final CouponHypeOffers offers;

    public CouponHypeController(CouponHypeOffers offers) {
        this.offers = offers;
    }

    @GetMapping("/api/me/coupons/hype-locked")
    @Operation(summary = "Cupons travados por Hype: oferta disponível, selo ou deck em ordem, falta só a faixa de Hype do card")
    public Map<String, Object> locked(CurrentUser user) {
        return offers.lockedView(user);
    }
}
