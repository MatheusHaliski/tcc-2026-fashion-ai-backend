package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.IssuerReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@Tag(name = "RF1 — Análise do perfil de marca/celebridade (Painel do examinador)")
public class IssuerReviewController {
    private final IssuerReviewService review;

    public IssuerReviewController(IssuerReviewService review) {
        this.review = review;
    }

    @GetMapping("/api/me/issuer-review")
    @Operation(summary = "Status da análise do próprio perfil de marca/celebridade: em análise, aprovado ou recusado (com o motivo). Funciona com o perfil ainda pendente.")
    public Map<String, Object> status(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        return review.status(user);
    }
}
