package br.com.fashionai.application.multiplatform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MP-1 — Configuração que o aplicativo instalado lê ao abrir: versão mínima suportada (atualização obrigatória quando a
 * API muda de forma incompatível), perfil de qualidade, o que o aparelho faz e o que vai para outro aparelho.
 * Pública (sem sessão): é lida antes do login.
 */
@Service
public class ClientConfigService {
    /** Versão do contrato que os clientes instalados usam (docs/multiplataforma/02-arquitetura-e-contratos.md). */
    public static final String CONTRACT_VERSION = "1.0";

    private final String minVersion;

    public ClientConfigService(@Value("${fashionai.clients.min-version:0.1.0}") String minVersion) {
        this.minVersion = minVersion;
    }

    public Map<String, Object> config(ClientPlatform platform, String appVersion, String qualityHeader) {
        QualityProfile quality = QualityProfile.resolve(platform, qualityHeader);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("contractVersion", CONTRACT_VERSION);
        out.put("platform", platform.name());
        out.put("family", platform.family().name());
        out.put("minVersion", minVersion);
        out.put("updateRequired", appVersion != null && !appVersion.isBlank() && compare(appVersion, minVersion) < 0);
        out.put("qualityProfile", quality.name());
        out.put("qualityProfiles", QualityProfile.of(platform.family()).stream().map(Enum::name).toList());
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("targetFps", quality.targetFps());
        q.put("avatarLod", quality.avatarLod());
        q.put("hair", quality.hair());
        q.put("clothSimulation", quality.clothSimulation());
        q.put("maxGarmentBytes", quality.maxGarmentBytes());
        out.put("quality", q);
        out.put("inputs", platform.inputs());
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("camera", platform.camera());
        caps.put("photoLibrary", platform.photoLibrary());
        caps.put("longForms", platform.longForms());
        out.put("capabilities", caps);
        // o que este aparelho não faz vai para o celular ou o computador da mesma conta (continuação, marco 5)
        out.put("continueElsewhere", platform.family() == ClientPlatform.Family.CONSOLE
                ? List.of("AVATAR_PHOTOS", "PIECE_PHOTO", "PROFILE_EDIT", "ACCOUNT_REGISTRATION", "ACCOUNT_DELETION")
                : List.of());
        out.put("tryOnSlots", List.of("TOP", "BOTTOM", "SHOES", "ACCESSORY"));
        // comércio: nenhum produto pago no lançamento 1; a política por loja está em 05-lojas-e-comercio.md
        out.put("commerce", Map.of("enabled", false));
        return out;
    }

    /** Compara versões "1.2.3" número a número (partes ausentes valem 0; sufixos como "-beta" são ignorados). */
    static int compare(String a, String b) {
        String[] x = a.split("[.-]");
        String[] y = b.split("[.-]");
        for (int i = 0; i < 3; i++) {
            int c = Integer.compare(num(x, i), num(y, i));
            if (c != 0) {
                return c;
            }
        }
        return 0;
    }

    private static int num(String[] parts, int i) {
        if (i >= parts.length) {
            return 0;
        }
        try {
            return Integer.parseInt(parts[i].trim());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
