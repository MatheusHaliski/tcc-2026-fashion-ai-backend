package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SignaturePieceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Exercício 18 — Peça Assinatura do perfil e histórico. Quem escolhe é sempre a pessoa da sessão
 * ({@link CurrentUser}): o corpo não aceita userId, então ninguém escolhe a peça de outra conta.
 */
@RestController
@Tag(name = "RF17 — Peça Assinatura do perfil")
public class SignaturePieceController {
    private final SignaturePieceService service;

    public SignaturePieceController(SignaturePieceService service) {
        this.service = service;
    }

    public record ChooseRequest(UUID pieceId, Long expectedVersion) {
    }

    @GetMapping("/api/me/signature-piece")
    @Operation(summary = "Minha Peça Assinatura e a revisão a informar na próxima gravação")
    public Map<String, Object> mine(CurrentUser user) {
        return service.mine(user);
    }

    @PutMapping("/api/me/signature-piece")
    @Operation(summary = "Escolhe ou troca a Peça Assinatura por uma peça do próprio guarda-roupa")
    public Map<String, Object> choose(CurrentUser user, @RequestBody ChooseRequest body) {
        return service.choose(user, body.pieceId(), body.expectedVersion());
    }

    @DeleteMapping("/api/me/signature-piece")
    @Operation(summary = "Remove a Peça Assinatura atual; o histórico é mantido")
    public Map<String, Object> clear(CurrentUser user, @RequestParam(required = false) Long expectedVersion) {
        return service.clear(user, expectedVersion);
    }

    @GetMapping("/api/me/signature-piece/history")
    @Operation(summary = "Histórico das minhas escolhas de Peça Assinatura, paginado")
    public Map<String, Object> history(CurrentUser user, @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "10") int size) {
        return service.history(user, page, size);
    }

    @GetMapping("/api/profiles/{idOrUsername}/signature-piece")
    @Operation(summary = "Peça Assinatura de um perfil, se o perfil e a peça forem visíveis para quem pede")
    public Map<String, Object> ofProfile(CurrentUser viewer, @PathVariable String idOrUsername) {
        return service.ofProfile(viewer, idOrUsername);
    }
}
