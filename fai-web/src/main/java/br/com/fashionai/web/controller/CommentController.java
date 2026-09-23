package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SocialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF8/RF17/RF19 — Interações sociais (reações, comentários, salvar, compartilhar)")
public class CommentController {
    private final SocialService social;

    public CommentController(SocialService social) {
        this.social = social;
    }

    @DeleteMapping("/api/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "RF8 — Apagar comentário (autor ou dono do conteúdo)")
    public void delete(CurrentUser user, @PathVariable UUID commentId) {
        social.deleteComment(user, commentId);
    }

    @PostMapping("/api/pieces/{pieceId}/return-to-origin")
    @Operation(summary = "RF7.CA04 — Voltar da peça para o esquema de origem")
    public Map<String, Object> returnToOrigin(CurrentUser user, @PathVariable UUID pieceId, @RequestParam UUID fromScheme) {
        return social.returnToOrigin(user, pieceId, fromScheme);
    }
}
