package br.com.fashionai.application.multiplatform;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.UserAvatar3d;
import br.com.fashionai.domain.model.enums.IdentityStatus;
import br.com.fashionai.domain.repository.AvatarIdentityVersionRepository;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * MP-2 — Manifesto canônico do avatar da própria pessoa, para os clientes instalados. O dono recebe a versão atual e,
 * quando ela ainda não foi aprovada, também o hash da aprovada (a que outras pessoas veem). A foto de origem nunca é
 * enviada ao servidor: o app extrai a forma no aparelho e envia só o modelo e o atlas do rosto (privado).
 */
@Service
public class AvatarCanonicalService {
    private final UserAvatar3dRepository avatars;
    private final AvatarIdentityVersionRepository versions;

    public AvatarCanonicalService(UserAvatar3dRepository avatars, AvatarIdentityVersionRepository versions) {
        this.avatars = avatars;
        this.versions = versions;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        return avatars.findByUserId(user.id()).map(a -> {
            String status = a.getIdentityStatus() == null ? IdentityStatus.APPROVED.name() : a.getIdentityStatus().name();
            Map<String, Object> out = new LinkedHashMap<>(AvatarCanonicalManifest.build(new AvatarCanonicalManifest.Input(
                    a.getIdentityId(), a.getCurrentVersion(), status, a.getApprovedVersion(),
                    Json.map(a.getModelJson()), a.getAdjustJson() == null ? Map.of() : Json.map(a.getAdjustJson()))));
            out.put("exists", true);
            out.put("approvedIdentityHash", approvedHash(user, a));
            out.put("privacy", privacy());
            return out;
        }).orElseGet(() -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("exists", false);
            out.put("requests", java.util.List.of(Map.of("kind", "CREATE_AVATAR",
                    "reason", "Crie o avatar com uma foto do rosto de frente; outras vistas melhoram a fidelidade.")));
            out.put("privacy", privacy());
            return out;
        });
    }

    private String approvedHash(CurrentUser user, UserAvatar3d a) {
        Integer approved = a.getApprovedVersion();
        if (approved == null) {
            return null;
        }
        if (approved == a.getCurrentVersion()) {
            return AvatarCanonicalManifest.hash(a.getIdentityId(), approved, Json.map(a.getModelJson()),
                    a.getAdjustJson() == null ? Map.of() : Json.map(a.getAdjustJson()));
        }
        return versions.findByUserIdAndVersionNo(user.id(), approved)
                .map(v -> AvatarCanonicalManifest.hash(v.getIdentityId(), v.getVersionNo(), Json.map(v.getModelJson()),
                        v.getAdjustJson() == null ? Map.of() : Json.map(v.getAdjustJson())))
                .orElse(null);
    }

    private static Map<String, Object> privacy() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("sourcePhotosUploaded", false);
        p.put("faceTexture", "PRIVATE_OWNER_OR_APPROVED_PUBLIC");
        p.put("versions", "GET /api/me/avatar3d/versions");
        p.put("deleteAll", "DELETE /api/me/avatar3d");
        return p;
    }
}
