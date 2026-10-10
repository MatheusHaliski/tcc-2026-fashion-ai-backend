package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairCollectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** FLAIR-UT F3 — "Converter para FLAIR" (a carta é uma cópia da peça) e "Minhas cartas FLAIR". */
@RestController
@Tag(name = "FLAIR-UT — cartas FLAIR geradas pela pessoa (cópia da peça)")
public class FlairCollectionController {
    private final FlairCollectionService collection;

    public FlairCollectionController(FlairCollectionService collection) {
        this.collection = collection;
    }

    /** Com {@code pieceId}: prévia da peça salva. Sem: prévia do rascunho do criador (os campos do formulário). */
    public record PreviewRequest(UUID pieceId, String category, String subcategory, BigDecimal price, String brandName, UUID brandId,
                                 UUID catalogProductId, List<String> styles, List<String> occasions, String color, String material) {
    }

    public record ConvertRequest(UUID pieceId) {
    }

    @PostMapping("/api/flair/cards/preview")
    @Operation(summary = "FLAIR-UT §4 — prévia da nota e do nível da carta (sem gravar)")
    public Map<String, Object> preview(CurrentUser user, @RequestBody PreviewRequest body) {
        if (body.pieceId() != null) {
            return collection.previewPiece(user, body.pieceId());
        }
        return collection.previewDraft(new FlairCollectionService.Draft(body.category(), body.subcategory(), body.price(), body.brandName(),
                body.brandId(), body.catalogProductId(), body.styles(), body.occasions(), body.color(), body.material()));
    }

    @PostMapping("/api/flair/cards")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "FLAIR-UT §5 — converter a peça em carta FLAIR (cópia; uma por temporada; nunca publica no feed)")
    public Map<String, Object> convert(CurrentUser user, @RequestBody ConvertRequest body) {
        return collection.convertPiece(user, body.pieceId());
    }

    @GetMapping("/api/me/flair/cards")
    @Operation(summary = "FLAIR-UT §5 — minhas cartas FLAIR, por nível (originId filtra a carta de uma peça)")
    public Map<String, Object> mine(CurrentUser user, @RequestParam(required = false) UUID originId) {
        return collection.mine(user, originId);
    }

    @GetMapping("/api/users/{ownerId}/flair/cards")
    @Operation(summary = "FLAIR-UT §5 — cartas FLAIR do perfil (visitante vê só as de peças que pode abrir)")
    public Map<String, Object> ofUser(CurrentUser viewer, @PathVariable UUID ownerId) {
        return collection.ofUser(viewer, ownerId);
    }
}
