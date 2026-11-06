package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.Piece3dCustomization;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import br.com.fashionai.domain.repository.Piece3dCustomizationRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF — editor 3D da peça. A personalização é por pessoa e vinculada à peça original: o GLB nunca é modificado; só o
 * proprietário salva; modelos em quarentena (asset não aprovado) não são oferecidos como aprovados para o provador;
 * escala é identificada como ajuste visual e não altera medidas oficiais, tamanhos comerciais nem o passaporte.
 */
@Service
@Transactional
public class PieceCustomizationService {
    public record SaveCmd(long expectedRevision, CustomizationDocument document, String requestId) { }

    private final Piece3dCustomizationRepository customizations;
    private final WardrobeItemRepository pieces;
    private final GarmentAsset3dRepository assets;
    private final Guard guard;

    public PieceCustomizationService(Piece3dCustomizationRepository customizations, WardrobeItemRepository pieces, GarmentAsset3dRepository assets, Guard guard) {
        this.customizations = customizations; this.pieces = pieces; this.assets = assets; this.guard = guard;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user, UUID pieceId) {
        WardrobeItem w = visible(user, pieceId);
        boolean owner = user != null && w.getUser().getId().equals(user.id());
        Piece3dCustomization c = owner ? customizations.findByPieceIdAndOwnerId(pieceId, user.id()).orElse(null) : null;
        return view(w, c, owner);
    }

    public Map<String, Object> save(CurrentUser user, UUID pieceId, SaveCmd cmd) {
        WardrobeItem w = owned(user, pieceId);
        if (cmd == null || cmd.requestId() == null || !cmd.requestId().matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Envie uma chave de pedido válida.");
        String base = baseModel(w);
        if (base == null) throw ApiException.conflict("CUSTOMIZATION_NO_MODEL", "Esta peça ainda não tem modelo 3D compatível para editar.");
        CustomizationDocument document = (cmd.document() == null ? CustomizationDocument.empty() : cmd.document()).validated();
        Piece3dCustomization c = customizations.lockByPieceIdAndOwnerId(pieceId, user.id()).orElseGet(() -> {
            Piece3dCustomization fresh = new Piece3dCustomization();
            fresh.setPieceId(pieceId); fresh.setOwnerId(user.id()); fresh.setRevision(0); fresh.setRequestId("");
            return fresh;
        });
        if (cmd.requestId().equals(c.getRequestId())) return view(w, c, true);
        if (c.getRevision() != cmd.expectedRevision()) throw ApiException.conflict("CUSTOMIZATION_REVISION_CONFLICT", "A personalização mudou em outra sessão. Recarregue antes de salvar.");
        c.setBaseModelUrl(base); c.setDocumentJson(Json.write(document)); c.setRevision(c.getRevision() + 1); c.setRequestId(cmd.requestId());
        return view(w, customizations.saveAndFlush(c), true);
    }

    /** Restaurar a configuração inicial: remove a personalização; o original nunca foi alterado. */
    public void reset(CurrentUser user, UUID pieceId) {
        owned(user, pieceId);
        customizations.findByPieceIdAndOwnerId(pieceId, user.id()).ifPresent(customizations::delete);
    }

    private Map<String, Object> view(WardrobeItem w, Piece3dCustomization c, boolean owner) {
        String base = baseModel(w);
        List<GarmentAsset3d> found = assets.findByPieceIdOrderByCreatedAtDesc(w.getId());
        GarmentAsset3d approved = found.stream().filter(a -> a.getStatus() == GarmentAssetStatus.APPROVED).findFirst().orElse(null);
        GarmentAsset3d other = found.stream().filter(a -> a.getStatus() != GarmentAssetStatus.APPROVED).findFirst().orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pieceId", w.getId());
        out.put("baseModelUrl", base);
        out.put("modelAvailable", base != null);
        out.put("editable", owner && base != null);
        out.put("viewOnly", !owner);
        out.put("assetApproval", approved != null ? "APPROVED" : other != null ? other.getStatus().name() : "NONE");
        out.put("quarantine", approved == null && other != null);
        out.put("tryOnApproved", approved != null);
        out.put("supports", Map.of("camera", true, "materials", true, "transforms", true, "undoRedo", true, "vertices", true));
        out.put("document", c == null ? CustomizationDocument.empty() : Json.read(c.getDocumentJson(), CustomizationDocument.class));
        out.put("revision", c == null ? 0 : c.getRevision());
        out.put("savedAt", c == null ? null : c.getUpdatedAt());
        out.put("baseChanged", c != null && base != null && !base.equals(c.getBaseModelUrl()));
        out.put("scaleIsVisualOnly", true);
        out.put("affectsOfficialMeasurements", false);
        out.put("affectsPassport", false);
        out.put("fitClaim", "NONE");
        return out;
    }

    private static String baseModel(WardrobeItem w) {
        return w.getModel3dStatus() == Model3dStatus.COMPLETED && w.getModel3dUrl() != null ? w.getModel3dUrl() : null;
    }

    private WardrobeItem visible(CurrentUser user, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound("Peça"));
        boolean owner = user != null && w.getUser().getId().equals(user.id());
        if (!owner && (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED || !guard.canView(user, w.getUser().getId(), w.getVisibility()))) throw ApiException.notFound("Peça");
        return w;
    }

    private WardrobeItem owned(CurrentUser user, UUID pieceId) {
        guard.requireCanCreate(user);
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound("Peça"));
        if (!w.getUser().getId().equals(user.id())) throw ApiException.forbidden("Somente o proprietário personaliza esta peça.");
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) throw ApiException.conflict("PIECE_ARCHIVED", "Peça arquivada.");
        return w;
    }
}
