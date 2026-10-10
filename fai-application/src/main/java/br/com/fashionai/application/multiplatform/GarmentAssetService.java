package br.com.fashionai.application.multiplatform;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * MP-2 — Ciclo de vida do asset 3D de roupa (administração): registrar com métricas → gate automático
 * ({@link GarmentFitGate}) → revisão humana de cor, estampa e logo → aprovado. Aprovar uma versão aposenta a anterior
 * da mesma peça/produto. Os arquivos (FBX/USD convertidos para o formato do cliente) são enviados ao storage pela
 * ferramenta de importação; aqui entram só as chaves, tamanhos e hashes.
 */
@Service
public class GarmentAssetService {
    static final Set<String> SOURCES = Set.of("ARTIST", "PATTERN", "SCAN", "GENERATED");
    static final Set<String> LOGO = Set.of("NONE", "AUTHORIZED", "PENDING");

    private final GarmentAsset3dRepository assets;
    private final Guard guard;

    public GarmentAssetService(GarmentAsset3dRepository assets, Guard guard) {
        this.assets = assets;
        this.guard = guard;
    }

    public record RegisterCommand(UUID pieceId, UUID catalogProductId, String rigStandard, String source,
                                  String logoAuthorization, String logoAuthorizationRef,
                                  Map<String, Object> metrics, Map<String, Object> renditions) {
    }

    @Transactional
    public Map<String, Object> register(CurrentUser admin, RegisterCommand cmd) {
        guard.requireAdmin(admin);
        if (cmd == null || (cmd.pieceId() == null && cmd.catalogProductId() == null)) {
            throw ApiException.badRequest("VALIDACAO", "Informe a peça ou o produto do catálogo.");
        }
        if (cmd.rigStandard() == null || cmd.rigStandard().isBlank() || !SOURCES.contains(cmd.source())) {
            throw ApiException.badRequest("VALIDACAO", "Informe o esqueleto (rigStandard) e a origem: " + SOURCES + ".");
        }
        String logo = cmd.logoAuthorization() == null ? "NONE" : cmd.logoAuthorization();
        if (!LOGO.contains(logo)) {
            throw ApiException.badRequest("VALIDACAO", "Autorização de logo inválida: " + LOGO + ".");
        }
        validateRenditions(cmd.renditions());
        GarmentAsset3d a = new GarmentAsset3d();
        a.setPieceId(cmd.pieceId());
        a.setCatalogProductId(cmd.catalogProductId());
        a.setRigStandard(cmd.rigStandard().trim());
        a.setSource(cmd.source());
        a.setLogoAuthorization(logo);
        a.setLogoAuthorizationRef(cmd.logoAuthorizationRef());
        a.setMetricsJson(cmd.metrics() == null ? null : Json.write(cmd.metrics()));
        a.setRenditionsJson(Json.write(cmd.renditions()));
        GarmentFitGate.Result gate = GarmentFitGate.evaluate(cmd.metrics(), logo);
        a.setStatus(gate.passed() ? GarmentAssetStatus.IN_REVIEW : GarmentAssetStatus.REJECTED);
        a.setReviewNotes(gate.passed() ? null : String.join("; ", gate.failures()));
        return view(assets.save(a), gate);
    }

    /** Revisão humana: confere cor, estampa, logo e detalhes contra a foto da peça; só depois disso a peça veste. */
    @Transactional
    public Map<String, Object> review(CurrentUser admin, UUID assetId, boolean approve, String notes) {
        guard.requireAdmin(admin);
        GarmentAsset3d a = assets.findById(assetId).orElseThrow(() -> ApiException.notFound("Asset 3D"));
        if (a.getStatus() != GarmentAssetStatus.IN_REVIEW) {
            throw ApiException.conflict("ESTADO_INVALIDO", "Só um asset em revisão pode ser aprovado ou reprovado.");
        }
        GarmentFitGate.Result gate = GarmentFitGate.evaluate(
                a.getMetricsJson() == null ? null : Json.map(a.getMetricsJson()), a.getLogoAuthorization());
        if (approve && !gate.passed()) {
            throw new ApiException(422, "GATE_REPROVADO", "As métricas de vestir não passam no gate.", Map.of("failures", gate.failures()));
        }
        a.setReviewNotes(notes);
        if (approve) {
            if (a.getPieceId() != null) {
                retire(assets.findByPieceIdInAndStatus(List.of(a.getPieceId()), GarmentAssetStatus.APPROVED));
            } else {
                retire(assets.findByCatalogProductIdInAndStatus(List.of(a.getCatalogProductId()), GarmentAssetStatus.APPROVED));
            }
            a.setStatus(GarmentAssetStatus.APPROVED);
            a.setApprovedAt(Instant.now());
            a.setApprovedBy(admin.username());
        } else {
            a.setStatus(GarmentAssetStatus.REJECTED);
        }
        return view(assets.save(a), gate);
    }

    private void retire(List<GarmentAsset3d> previous) {
        previous.forEach(p -> {
            p.setStatus(GarmentAssetStatus.RETIRED);
            assets.save(p);
        });
    }

    private static void validateRenditions(Map<String, Object> renditions) {
        if (renditions == null || renditions.isEmpty()) {
            throw ApiException.badRequest("VALIDACAO", "Envie ao menos um arquivo por perfil de qualidade.");
        }
        for (Map.Entry<String, Object> e : renditions.entrySet()) {
            QualityProfile p;
            try {
                p = QualityProfile.valueOf(e.getKey());
            } catch (IllegalArgumentException ex) {
                throw ApiException.badRequest("VALIDACAO", "Perfil desconhecido: " + e.getKey());
            }
            if (!(e.getValue() instanceof Map<?, ?> r) || r.get("key") == null || !(r.get("bytes") instanceof Number bytes)) {
                throw ApiException.badRequest("VALIDACAO", "Cada perfil precisa de key e bytes: " + e.getKey());
            }
            String key = r.get("key").toString();
            if (key.contains("..") || key.startsWith("/") || key.startsWith("restricted/")) {
                throw ApiException.badRequest("VALIDACAO", "Chave de arquivo inválida: " + e.getKey());
            }
            if (bytes.longValue() > p.maxGarmentBytes()) {
                throw new ApiException(422, "ARQUIVO_GRANDE_DEMAIS", "O arquivo de " + p.name() + " passa do limite de "
                        + p.maxGarmentBytes() + " bytes.");
            }
        }
    }

    private static Map<String, Object> view(GarmentAsset3d a, GarmentFitGate.Result gate) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("pieceId", a.getPieceId());
        m.put("catalogProductId", a.getCatalogProductId());
        m.put("status", a.getStatus().name());
        m.put("rigStandard", a.getRigStandard());
        m.put("source", a.getSource());
        m.put("logoAuthorization", a.getLogoAuthorization());
        m.put("gate", gate.view());
        m.put("reviewNotes", a.getReviewNotes());
        m.put("approvedAt", a.getApprovedAt());
        return m;
    }
}
