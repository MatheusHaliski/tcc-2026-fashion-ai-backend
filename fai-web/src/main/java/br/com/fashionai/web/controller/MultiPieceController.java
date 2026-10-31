package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.web.support.Uploads;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * RF4 — várias peças numa foto ({@code MultiPieceService}): detecção, rascunho de cada peça (recorte ou foto inteira) e a
 * cópia da peça por IA. Nada é cadastrado aqui: o rascunho volta para o POST /api/pieces de {@link WardrobeController}.
 */
@RestController
@Tag(name = "RF4/RF7/RF15/RF16 — Peças do guarda-roupa")
public class MultiPieceController {
    private final MultiPieceService multiPiece;

    public MultiPieceController(MultiPieceService multiPiece) {
        this.multiPiece = multiPiece;
    }

    @PostMapping(value = "/api/pieces/analysis/multi", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4 — Várias peças numa foto: a IA acha cada peça e devolve nome, tipo, cor, material, estilo, "
            + "ocasião e a caixa da peça (em % da foto). Nada é cadastrado: a pessoa revisa antes")
    public MultiPieceService.Detection analyzeMulti(CurrentUser user, @RequestPart("file") MultipartFile file) {
        return multiPiece.detect(user, Uploads.image(file));
    }

    @PostMapping(value = "/api/pieces/analysis/multi/{draftId}/pieces", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4 — Rascunho de uma peça da foto com várias peças: o recorte da peça (ou a foto inteira) passa "
            + "pelo Flat Lay e pela moderação; o draftId devolvido é cadastrado pelo POST /api/pieces")
    public MultiPieceService.PieceDraft multiPieceDraft(CurrentUser user, @PathVariable UUID draftId,
                                                        @RequestPart("file") MultipartFile file,
                                                        @RequestParam(value = "index", required = false) Integer index) {
        return multiPiece.pieceDraft(user, draftId, index, Uploads.image(file));
    }

    @PostMapping(value = "/api/pieces/analysis/multi/{draftId}/ai-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "RF4 — Cópia da peça por IA: recria a foto da peça (recorte ou foto inteira) como foto de produto. "
            + "A prévia já vem com o selo \"gerada por IA\"; nada é cadastrado. Sem IA de imagem → 503 IA_INDISPONIVEL")
    public MultiPieceService.AiImage multiPieceAiImage(CurrentUser user, @PathVariable UUID draftId,
                                                       @RequestPart("file") MultipartFile file,
                                                       @RequestParam(value = "index", required = false) Integer index,
                                                       @RequestParam(value = "name", required = false) String name,
                                                       @RequestParam(value = "category", required = false) String category,
                                                       @RequestParam(value = "color", required = false) String color) {
        return multiPiece.recreate(user, draftId, index, Uploads.image(file), name, category, color);
    }

    @PostMapping("/api/pieces/analysis/multi/{draftId}/ai-images/{aiImageId}/piece")
    @Operation(summary = "RF4 — Rascunho da peça com a cópia por IA no lugar da foto: todas as versões levam o selo de IA e "
            + "a peça é cadastrada com aiGeneratedImage = true pelo POST /api/pieces")
    public MultiPieceService.PieceDraft multiPieceAiDraft(CurrentUser user, @PathVariable UUID draftId, @PathVariable UUID aiImageId) {
        return multiPiece.aiPieceDraft(user, draftId, aiImageId);
    }
}
