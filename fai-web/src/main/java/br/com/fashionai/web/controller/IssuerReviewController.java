package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.IssuerReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@Tag(name = "RF1 — Verificação do perfil de marca/celebridade (Central do emissor)")
public class IssuerReviewController {
    private final IssuerReviewService review;

    public IssuerReviewController(IssuerReviewService review) {
        this.review = review;
    }

    @GetMapping("/api/me/issuer-review")
    @Operation(summary = "Central do emissor: status da verificação do próprio perfil (em análise, ajustes, aprovado, recusado — com motivos), "
            + "critérios da política, código de verificação e envios. Funciona com o perfil ainda pendente.")
    public Map<String, Object> status(CurrentUser user) {
        return review.status(user);
    }

    @PostMapping("/api/me/issuer-review/resubmit")
    @Operation(summary = "Reenviar o perfil para a fila de verificação depois de um pedido de ajustes ou de uma recusa: links, "
            + "contato, novo documento (envio de POST /api/auth/uploads) e mensagem ao analista. Até 5 envios por perfil.")
    public Map<String, Object> resubmit(CurrentUser user, @RequestBody(required = false) IssuerReviewService.ResubmitCommand body) {
        return review.resubmit(user, body);
    }
}
