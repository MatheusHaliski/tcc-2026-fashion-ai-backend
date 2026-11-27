package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.common.Json;

import java.util.Map;

/**
 * A família de Aura de uma carta, lida da arte do card da peça ({@code background_config_json}, a mesma que o estúdio
 * grava e o {@code MetamorphoseInventoryService} lê): Metamorfose quando a modalidade Metamorfose está ligada ou a
 * composição é da família Metamorfose; senão, a família da composição escolhida (COMMON, ELECTRO, SPLASH, HYPE). Sem
 * composição, nula (a carta não tem Aura). Só leitura. Puro.
 */
public final class Flair3dAuraDaCarta {
    private Flair3dAuraDaCarta() {
    }

    public static String familia(String backgroundConfigJson) {
        Map<String, Object> config = Json.map(backgroundConfigJson);
        if (config.get("auraMetamorphose") instanceof String modo && !"OFF".equals(modo)) {
            return Flair3dAuraRegras.METAMORPHOSE;
        }
        if (config.get("compositionPreset") instanceof Map<?, ?> preset && preset.get("family") instanceof String f
                && Flair3dAuraRegras.FAMILIAS.contains(f)) {
            return f;
        }
        return null;
    }
}
