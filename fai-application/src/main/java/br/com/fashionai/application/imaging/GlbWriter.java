package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF16 — serialização glTF 2.0 binária (.glb) da malha em relevo do {@link ReliefModelGenerator}: cabeçalho, bloco JSON
 * (cena, malha, material PBR com a foto como textura) e bloco binário (posições, normais, UV, índices, PNG).
 */
final class GlbWriter {
    private static final int FLOAT = 5126, UINT = 5125, ARRAY = 34962, ELEMENTS = 34963;

    private GlbWriter() {
    }

    /** glTF 2.0 binário: um nó, uma malha, material PBR com a foto como baseColorTexture (alpha MASK, dupla face). */
    static byte[] write(List<float[]> pos, float[][] normals, List<float[]> uv, List<int[]> tris, byte[] png) {
        int nv = pos.size(), ni = tris.size() * 3;
        int posLen = nv * 12, nrmLen = nv * 12, uvLen = nv * 8, idxLen = ni * 4, imgLen = png.length;
        int posOff = 0, nrmOff = posOff + posLen, uvOff = nrmOff + nrmLen, idxOff = uvOff + uvLen, imgOff = idxOff + idxLen;
        int binLen = pad4(imgOff + imgLen);
        ByteBuffer bin = ByteBuffer.allocate(binLen).order(ByteOrder.LITTLE_ENDIAN);
        float[] min = {Float.MAX_VALUE, Float.MAX_VALUE, Float.MAX_VALUE}, maxv = {-Float.MAX_VALUE, -Float.MAX_VALUE, -Float.MAX_VALUE};
        for (float[] p : pos) {
            for (int k = 0; k < 3; k++) {
                bin.putFloat(p[k]);
                min[k] = Math.min(min[k], p[k]);
                maxv[k] = Math.max(maxv[k], p[k]);
            }
        }
        for (float[] n : normals) {
            bin.putFloat(n[0]).putFloat(n[1]).putFloat(n[2]);
        }
        for (float[] t : uv) {
            bin.putFloat(t[0]).putFloat(t[1]);
        }
        for (int[] t : tris) {
            bin.putInt(t[0]).putInt(t[1]).putInt(t[2]);
        }
        bin.put(png);

        Map<String, Object> gltf = new LinkedHashMap<>();
        gltf.put("asset", Map.of("version", "2.0", "generator", Msg.t("reliefModelGenerator.fashion_ai_rf16_relevo_local")));
        gltf.put("scene", 0);
        gltf.put("scenes", List.of(Map.of("nodes", List.of(0))));
        gltf.put("nodes", List.of(Map.of("mesh", 0, "name", "peca")));
        gltf.put("meshes", List.of(Map.of("name", "peca", "primitives", List.of(Map.of(
                "attributes", Map.of("POSITION", 0, "NORMAL", 1, "TEXCOORD_0", 2), "indices", 3, "material", 0)))));
        gltf.put("materials", List.of(Map.of("name", "foto-da-peca", "doubleSided", true, "alphaMode", "MASK", "alphaCutoff", 0.4,
                "pbrMetallicRoughness", Map.of("baseColorTexture", Map.of("index", 0), "metallicFactor", 0.0, "roughnessFactor", 0.82))));
        gltf.put("textures", List.of(Map.of("source", 0, "sampler", 0)));
        gltf.put("samplers", List.of(Map.of("magFilter", 9729, "minFilter", 9987, "wrapS", 33071, "wrapT", 33071)));
        gltf.put("images", List.of(Map.of("bufferView", 4, "mimeType", "image/png")));
        gltf.put("buffers", List.of(Map.of("byteLength", binLen)));
        gltf.put("bufferViews", List.of(
                Map.of("buffer", 0, "byteOffset", posOff, "byteLength", posLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", nrmOff, "byteLength", nrmLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", uvOff, "byteLength", uvLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", idxOff, "byteLength", idxLen, "target", ELEMENTS),
                Map.of("buffer", 0, "byteOffset", imgOff, "byteLength", imgLen)));
        gltf.put("accessors", List.of(
                Map.of("bufferView", 0, "componentType", FLOAT, "count", nv, "type", "VEC3",
                        "min", List.of(min[0], min[1], min[2]), "max", List.of(maxv[0], maxv[1], maxv[2])),
                Map.of("bufferView", 1, "componentType", FLOAT, "count", nv, "type", "VEC3"),
                Map.of("bufferView", 2, "componentType", FLOAT, "count", nv, "type", "VEC2"),
                Map.of("bufferView", 3, "componentType", UINT, "count", ni, "type", "SCALAR")));
        byte[] json = Json.write(gltf).getBytes(StandardCharsets.UTF_8);
        int jsonLen = pad4(json.length);
        ByteBuffer out = ByteBuffer.allocate(12 + 8 + jsonLen + 8 + binLen).order(ByteOrder.LITTLE_ENDIAN);
        out.putInt(0x46546C67).putInt(2).putInt(12 + 8 + jsonLen + 8 + binLen);
        out.putInt(jsonLen).putInt(0x4E4F534A).put(json);
        for (int i = json.length; i < jsonLen; i++) {
            out.put((byte) ' ');
        }
        out.putInt(binLen).putInt(0x004E4942).put(bin.array());
        return out.array();
    }

    private static int pad4(int n) {
        return (n + 3) & ~3;
    }

    /** Leitura mínima do cabeçalho GLB (validação de arquivos de provedores externos). */
    static boolean isGlb(byte[] bytes) {
        if (bytes == null || bytes.length < 20) {
            return false;
        }
        ByteBuffer b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        return b.getInt(0) == 0x46546C67 && b.getInt(4) == 2 && b.getInt(8) <= bytes.length;
    }
}
