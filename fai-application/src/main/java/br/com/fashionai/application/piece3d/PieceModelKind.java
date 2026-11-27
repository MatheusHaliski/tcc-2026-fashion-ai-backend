package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.common.Json;
import tools.jackson.databind.JsonNode;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Origem do modelo 3D da peça, lida do próprio GLB (só o bloco JSON; nada é executado nem baixado de fora).
 * <ul>
 *   <li>{@code PROPRIO}: GLB criado pelo motor de peças (services/garment_blender): materiais nomeados por papel
 *   ({@code corpo}, {@code linha}, {@code dentes}…). É o único editável: tem partes de verdade para recolorir.</li>
 *   <li>{@code RELEVO_FOTO}: "relevo" da foto (RF16, {@code ReliefModelGenerator}): um bloco com a foto colada, de
 *   formato quadrado. Não é editável — mudar cor ou costura de uma foto não tem sentido.</li>
 *   <li>{@code EXTERNO}: GLB de outra origem (provedor de IA a partir da foto), sem partes de peça.</li>
 *   <li>{@code DESCONHECIDO}: não foi possível ler o arquivo.</li>
 * </ul>
 */
public enum PieceModelKind {
    PROPRIO, RELEVO_FOTO, EXTERNO, DESCONHECIDO;

    /** Material do motor que marca o tecido principal da peça. */
    static final String ENGINE_BODY = "corpo";
    /** Material único do relevo da foto (GlbWriter). */
    static final String RELIEF_MATERIAL = "foto-da-peca";

    public boolean editable() {
        return this == PROPRIO;
    }

    /** Código de erro (i18n no front: {@code editor3d.blocked.<código>}); nulo quando a edição é permitida. */
    public String blockedCode() {
        return switch (this) {
            case PROPRIO -> null;
            case RELEVO_FOTO -> "CUSTOMIZATION_PHOTO_RELIEF";
            case EXTERNO, DESCONHECIDO -> "CUSTOMIZATION_NOT_OWN_MODEL";
        };
    }

    /** Chave da mensagem do servidor (messages*.properties) para o motivo do bloqueio. */
    public String blockedMessageKey() {
        return this == RELEVO_FOTO ? "piece3d.bloqueio_relevo_foto" : "piece3d.bloqueio_sem_glb_proprio";
    }

    public static PieceModelKind of(byte[] glb) {
        JsonNode root = jsonChunk(glb);
        if (root == null) {
            return DESCONHECIDO;
        }
        String generator = root.path("asset").path("generator").asText("").toLowerCase(Locale.ROOT);
        boolean reliefGenerator = generator.contains("rf16") && (generator.contains("relevo") || generator.contains("relief") || generator.contains("relieve"));
        JsonNode materials = root.path("materials");
        boolean reliefShape = root.path("meshes").size() == 1 && materials.size() == 1
                && RELIEF_MATERIAL.equals(materials.get(0).path("name").asText(""));
        if (reliefGenerator || reliefShape) {
            return RELEVO_FOTO;
        }
        for (JsonNode material : materials) {
            if (ENGINE_BODY.equals(material.path("name").asText("").trim().toLowerCase(Locale.ROOT))) {
                return PROPRIO;
            }
        }
        return EXTERNO;
    }

    private static JsonNode jsonChunk(byte[] glb) {
        if (glb == null || glb.length < 20) {
            return null;
        }
        ByteBuffer b = ByteBuffer.wrap(glb).order(ByteOrder.LITTLE_ENDIAN);
        if (b.getInt(0) != 0x46546c67 || b.getInt(16) != 0x4e4f534a) {
            return null;
        }
        int length = b.getInt(12);
        if (length <= 0 || length > 2 * 1024 * 1024 || 20 + length > glb.length) {
            return null;
        }
        try {
            return Json.MAPPER.readTree(new String(glb, 20, length, StandardCharsets.UTF_8).trim());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
