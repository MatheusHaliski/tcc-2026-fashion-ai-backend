package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SocialService;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/interactions/{type}/{id}")
@Tag(name = "RF8/RF17/RF19 — Interações sociais (reações, comentários, salvar, compartilhar)")
public class SocialController {
    private final SocialService social;

    public SocialController(SocialService social) {
        this.social = social;
    }

    public record ReactionRequest(@NotNull ReactionType reaction) {
    }

    @PostMapping("/reactions")
    @Operation(summary = "RF8 — Reagir (curtir etc.) a esquema, peça ou comentário; repetir remove")
    public Map<String, Object> react(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id, @RequestBody ReactionRequest body) {
        return social.react(user, type, id, body.reaction());
    }

    @GetMapping("/comments")
    @Operation(summary = "RF8 — Comentários do conteúdo")
    public List<Map<String, Object>> comments(CurrentUser viewer, @PathVariable TargetType type, @PathVariable UUID id) {
        return social.comments(viewer, type, id);
    }

    public record CommentRequest(@NotBlank String content, UUID parentId) {
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF8 — Comentar (ou responder a um comentário)")
    public Map<String, Object> comment(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id, @RequestBody CommentRequest body) {
        return social.comment(user, type, id, body.content(), body.parentId());
    }

    @PostMapping("/saves")
    @Operation(summary = "RF6/RF8 — Salvar/remover dos salvos")
    public Map<String, Object> save(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id) {
        return social.toggleSave(user, type, id);
    }

    public record FavoriteRequest(boolean favorite) {
    }

    @PutMapping("/saves/favorite")
    @Operation(summary = "RF6 — Marcar item salvo como favorito")
    public Map<String, Object> favorite(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id, @RequestBody FavoriteRequest body) {
        return social.favoriteSaved(user, type, id, body.favorite());
    }

    /** {@code publish}: a dona confirmou que o conteúdo privado vira público para sair no feed (RF19.CA08). */
    public record ShareRequest(@NotNull ShareChannel channel, String caption, Boolean publish) {
    }

    @PostMapping("/shares")
    @Operation(summary = "RF8/RF19 — Compartilhar: publicar no feed do FashionAI ou copiar o link")
    public Map<String, Object> share(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id, @RequestBody ShareRequest body) {
        return social.share(user, type, id, body.channel(), body.caption(), Boolean.TRUE.equals(body.publish()));
    }

    @PostMapping("/remixes")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "RF19 — Remixar conteúdo público para o meu acervo")
    public Map<String, Object> remix(CurrentUser user, @PathVariable TargetType type, @PathVariable UUID id) {
        return social.remix(user, type, id);
    }

    @GetMapping("/counters")
    @Operation(summary = "RF8 — Contadores (reações, comentários, salvos, compartilhamentos)")
    public Map<String, Object> counters(CurrentUser viewer, @PathVariable TargetType type, @PathVariable UUID id) {
        return social.counters(viewer, type, id);
    }
}
