package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CouponService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Card Trello RF38 — Cupons Fashion AI: meus cupons resgatados (usuário) e meus cupons promocionais (marca/celebridade). */
@RestController
@Tag(name = "Cupons Fashion AI — direitos promocionais, resgate, carteira e administração")
public class CouponController {
    private final CouponService coupons;

    public CouponController(CouponService coupons) {
        this.coupons = coupons;
    }

    public record CodeRequest(String code) {
    }

    @GetMapping("/api/me/coupons")
    @Operation(summary = "RF38 — cupons conquistados à espera de resgate (\"Parabéns! Deseja resgatar?\") e a aba Meus cupons resgatados")
    public Map<String, Object> mine(CurrentUser user) {
        return coupons.mine(user);
    }

    @PostMapping("/api/me/coupon-rights/{id}/redeem")
    @Operation(summary = "RF38 — sim, resgatar: emite o cupom Fashion AI da marca/celebridade")
    public Map<String, Object> redeem(CurrentUser user, @PathVariable UUID id) {
        return coupons.redeem(user, id);
    }

    @PostMapping("/api/me/coupon-rights/{id}/dismiss")
    @Operation(summary = "RF38 — dispensar o cupom conquistado")
    public Map<String, Object> dismiss(CurrentUser user, @PathVariable UUID id) {
        return coupons.dismiss(user, id);
    }

    @GetMapping("/api/me/coupons/admin")
    @Operation(summary = "RF38 — aba Meus cupons promocionais: cupons emitidos, direitos pendentes e Todas as promoções (selos RF25 + FLAIR)")
    public Map<String, Object> admin(CurrentUser user) {
        return coupons.admin(user);
    }

    @PostMapping("/api/me/coupons/validate")
    @Operation(summary = "RF38 — confere o código de um cupom Fashion AI no caixa e marca como usado")
    public Map<String, Object> validate(CurrentUser user, @RequestBody CodeRequest body) {
        return coupons.validate(user, body.code());
    }
}
